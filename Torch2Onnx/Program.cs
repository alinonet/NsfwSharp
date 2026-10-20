using System.Diagnostics;

if (args.Length is < 1 or > 2)
{
    Console.Error.WriteLine("Uso: dotnet run --project Torch2Onnx -- <modello.pt> [python]");
    return 2;
}

var modelPath = Path.GetFullPath(args[0]);
if (!File.Exists(modelPath) || !Path.GetExtension(modelPath).Equals(".pt", StringComparison.OrdinalIgnoreCase))
{
    Console.Error.WriteLine($"File .pt non trovato: {modelPath}");
    return 2;
}

var python = args.Length == 2
    ? args[1]
    : Environment.GetEnvironmentVariable("NSFWSHARP_PYTHON")
        ?? (OperatingSystem.IsWindows() ? "python" : "python3");
const string exportScript = "from ultralytics import YOLO; import sys; model = YOLO(sys.argv[1]); print(model.export(format='onnx', imgsz=640, opset=12, dynamic=False))";

var startInfo = new ProcessStartInfo(python)
{
    UseShellExecute = false,
    RedirectStandardOutput = true,
    RedirectStandardError = true
};
startInfo.ArgumentList.Add("-c");
startInfo.ArgumentList.Add(exportScript);
startInfo.ArgumentList.Add(modelPath);

try
{
    using var process = Process.Start(startInfo);
    if (process is null)
    {
        Console.Error.WriteLine("Impossibile avviare Python.");
        return 1;
    }

    var outputTask = process.StandardOutput.ReadToEndAsync();
    var errorTask = process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    var output = await outputTask;
    var error = await errorTask;

    if (!string.IsNullOrWhiteSpace(output)) Console.Write(output);
    if (!string.IsNullOrWhiteSpace(error)) Console.Error.Write(error);
    if (process.ExitCode != 0) return process.ExitCode;

    var onnxPath = Path.ChangeExtension(modelPath, ".onnx");
    if (!File.Exists(onnxPath))
    {
        Console.Error.WriteLine($"Conversione terminata senza creare il file previsto: {onnxPath}");
        return 1;
    }

    Console.WriteLine($"Modello ONNX creato: {onnxPath}");
    return 0;
}
catch (System.ComponentModel.Win32Exception exception)
{
    Console.Error.WriteLine($"Impossibile avviare '{python}'. Installa Python e Ultralytics, quindi riprova. Dettaglio: {exception.Message}");
    return 1;
}