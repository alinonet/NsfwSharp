using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using NsfwSharp;
using SkiaSharp;
using System.Collections.Concurrent;

const int maxFileCount = 12;
const long maxFileSize = 10 * 1024 * 1024;
const long maxRequestSize = maxFileCount * maxFileSize + 1024 * 1024;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddAntiforgery(options => options.HeaderName = "X-CSRF-TOKEN");
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = maxRequestSize);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = maxRequestSize);

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAntiforgery();

var modelsDirectory = Path.GetFullPath(builder.Configuration["NsfwSharp:ModelsDirectory"]
    ?? Environment.GetEnvironmentVariable("NSFWSHARP_MODELS_DIRECTORY")
    ?? Path.Combine(app.Environment.ContentRootPath, "..", "models"));
var configuredModelPath = builder.Configuration["NsfwSharp:ModelPath"]
    ?? Environment.GetEnvironmentVariable("NSFWSHARP_MODEL_PATH")
    ?? Path.Combine(app.Environment.ContentRootPath, "yolo_11m_nsfw.onnx");
var analyzers = new ConcurrentDictionary<string, Lazy<AnalyzerEntry>>(StringComparer.OrdinalIgnoreCase);

IReadOnlyList<ModelOption> GetAvailableModels()
{
    var models = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    if (Directory.Exists(modelsDirectory))
    {
        foreach (var path in Directory.EnumerateFiles(modelsDirectory)
                     .Where(path => Path.GetExtension(path).Equals(".onnx", StringComparison.OrdinalIgnoreCase)))
        {
            models[Path.GetFileName(path)] = path;
        }
    }

    if (File.Exists(configuredModelPath)
        && !models.Values.Contains(Path.GetFullPath(configuredModelPath), StringComparer.OrdinalIgnoreCase))
    {
        models["configured"] = Path.GetFullPath(configuredModelPath);
    }

    return models.Select(model => new ModelOption(model.Key, Path.GetFileName(model.Value))).ToArray();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/api/antiforgery", (HttpContext context, IAntiforgery antiforgery) =>
{
    var tokens = antiforgery.GetAndStoreTokens(context);
    return TypedResults.Ok(new AntiforgeryTokenResponse(tokens.RequestToken!));
})
.WithName("GetAntiforgeryToken")
.WithSummary("Get an upload security token")
.WithDescription("Returns a request token required by the image upload endpoint.")
.Produces<AntiforgeryTokenResponse>();

app.MapGet("/api/models", () => TypedResults.Ok<IReadOnlyList<ModelOption>>(GetAvailableModels()))
    .WithName("GetModels")
    .WithSummary("List available ONNX models")
    .Produces<IReadOnlyList<ModelOption>>();

app.MapPost("/api/analyze", async Task<Results<
    Ok<IReadOnlyList<AnalysisResult>>,
    BadRequest<ProblemDetails>,
    ProblemHttpResult>> (
    IFormFileCollection files,
    [FromForm(Name = "model")] string model,
    CancellationToken cancellationToken) =>
{
    var selectedModel = GetAvailableModels().FirstOrDefault(option =>
        option.Id.Equals(model, StringComparison.Ordinal));
    if (selectedModel is null)
    {
        var availableModels = GetAvailableModels();
        if (availableModels.Count > 0)
        {
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Unknown model",
                Detail = "Select one of the available ONNX models.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        return TypedResults.Problem(
            title: "Model not found",
            detail: $"Place an ONNX model in '{modelsDirectory}' or set NSFWSHARP_MODEL_PATH.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (files.Count == 0)
    {
        return TypedResults.BadRequest(new ProblemDetails
        {
            Title = "No images selected",
            Detail = "Select at least one image to analyze.",
            Status = StatusCodes.Status400BadRequest
        });
    }

    if (files.Count > maxFileCount)
    {
        return TypedResults.BadRequest(new ProblemDetails
        {
            Title = "Too many images",
            Detail = $"Upload no more than {maxFileCount} images or extracted video frames at a time.",
            Status = StatusCodes.Status400BadRequest
        });
    }

    if (files.Any(file => file.Length == 0 || file.Length > maxFileSize))
    {
        return TypedResults.BadRequest(new ProblemDetails
        {
            Title = "Invalid image size",
            Detail = $"Each image must be non-empty and no larger than {maxFileSize / 1024 / 1024} MB.",
            Status = StatusCodes.Status400BadRequest
        });
    }

    var modelPath = selectedModel.Id == "configured"
        ? Path.GetFullPath(configuredModelPath)
        : Path.Combine(modelsDirectory, selectedModel.Id);
    var analyzer = analyzers.GetOrAdd(modelPath, path =>
        new Lazy<AnalyzerEntry>(() => new AnalyzerEntry(new NsfwAnalyzer(path)), LazyThreadSafetyMode.ExecutionAndPublication)).Value;
    var results = new List<AnalysisResult>(files.Count);
    foreach (var file in files)
    {
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, cancellationToken);
        var imageBytes = stream.ToArray();

        using var originalImage = SKImage.FromEncodedData(imageBytes);
        if (originalImage is null)
        {
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Unsupported image",
                Detail = $"'{Path.GetFileName(file.FileName)}' is not a supported image.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        NsfwAnalysis analysis;
        lock (analyzer.SyncRoot)
        {
            analysis = analyzer.Analyzer.GetNsfwAnalysis(originalImage);
        }
        using var annotatedImage = analysis.DetectionsImage;
        using var encodedImage = annotatedImage.Encode(SKEncodedImageFormat.Png, 100);
        results.Add(new AnalysisResult(
            Path.GetFileName(file.FileName),
            analysis.IsNsfw,
            analysis.Detections
                .Select(detection => new DetectionResult(detection.Name, detection.Confidence))
                .ToArray(),
            $"data:image/png;base64,{Convert.ToBase64String(encodedImage.ToArray())}"));
    }

    return TypedResults.Ok<IReadOnlyList<AnalysisResult>>(results);
})
.WithName("AnalyzeImages")
.WithSummary("Analyze uploaded images")
.WithDescription($"Analyzes up to {maxFileCount} images per request. Each image must be no larger than {maxFileSize / 1024 / 1024} MB.")
.Produces<IReadOnlyList<AnalysisResult>>()
.ProducesProblem(StatusCodes.Status400BadRequest)
.ProducesProblem(StatusCodes.Status503ServiceUnavailable);

app.Run();

/// <summary>A request token used to protect image uploads from cross-site requests.</summary>
public sealed record AntiforgeryTokenResponse(string RequestToken);

/// <summary>An ONNX model available to the web application.</summary>
public sealed record ModelOption(string Id, string Name);

/// <summary>A detected label and its confidence score.</summary>
public sealed record DetectionResult(string Name, double Confidence);

/// <summary>The analysis result and annotated preview for an uploaded image.</summary>
public sealed record AnalysisResult(
    string FileName,
    bool IsNsfw,
    IReadOnlyList<DetectionResult> Detections,
    string AnnotatedImageDataUrl);

public sealed class AnalyzerEntry(NsfwAnalyzer analyzer)
{
    public NsfwAnalyzer Analyzer { get; } = analyzer;
    public object SyncRoot { get; } = new();
}
