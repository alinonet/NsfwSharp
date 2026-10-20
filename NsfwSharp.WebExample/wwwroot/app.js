const imageLimit = 12;
const videoFrameCount = 6;
const imageSizeLimit = 10 * 1024 * 1024;
const videoSizeLimit = 500 * 1024 * 1024;

const modelSelect = document.querySelector("#model-select");
const imageInput = document.querySelector("#image-input");
const videoInput = document.querySelector("#video-input");
const imageDropzone = document.querySelector("#image-dropzone");
const videoDropzone = document.querySelector("#video-dropzone");
const imagePanel = document.querySelector("#image-panel");
const videoPanel = document.querySelector("#video-panel");
const selection = document.querySelector("#selection");
const selectionCount = document.querySelector("#selection-count");
const fileList = document.querySelector("#file-list");
const clearSelection = document.querySelector("#clear-selection");
const formError = document.querySelector("#form-error");
const analyzeButton = document.querySelector("#analyze-button");
const buttonLabel = document.querySelector(".button-label");
const progressState = document.querySelector("#progress-state");
const progressMessage = document.querySelector("#progress-message");
const progressBar = document.querySelector("#progress-bar");
const resultGrid = document.querySelector("#result-grid");
const resultsSubtitle = document.querySelector("#results-subtitle");
const resultCount = document.querySelector("#result-count");
const videoName = document.querySelector("#video-name");

let requestToken = "";
let selectedFiles = [];
let selectedMode = "images";
let isBusy = false;

async function initialize() {
  try {
    const [tokenResponse, modelsResponse] = await Promise.all([
      fetch("/api/antiforgery"),
      fetch("/api/models")
    ]);

    if (!tokenResponse.ok || !modelsResponse.ok) {
      throw new Error("Non è stato possibile inizializzare la pagina.");
    }

    const token = await tokenResponse.json();
    const models = await modelsResponse.json();
    requestToken = token.requestToken;
    modelSelect.replaceChildren();

    if (models.length === 0) {
      modelSelect.add(new Option("Nessun modello ONNX disponibile", ""));
      showError("Nessun modello ONNX trovato. Converti un file .pt oppure aggiungi un modello .onnx nella cartella models.");
      return;
    }

    for (const model of models) {
      modelSelect.add(new Option(model.name, model.id));
    }
    const mediumModel = models.find(model => /medium|11m/i.test(model.name));
    if (mediumModel) {
      modelSelect.value = mediumModel.id;
    }
    modelSelect.disabled = false;
    updateAnalyzeState();
  } catch (error) {
    showError(error.message || "Impossibile collegarsi all'applicazione.");
  }
}

function formatSize(size) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = "";
  formError.hidden = true;
}

function setFiles(files) {
  clearError();
  const incoming = [...files];
  if (incoming.length > imageLimit) {
    showError("Puoi selezionare al massimo 12 immagini.");
    return;
  }
  const oversizedFile = incoming.find(file => file.size === 0 || file.size > imageSizeLimit);
  if (oversizedFile) {
    showError(`"${oversizedFile.name}" è vuoto o supera il limite di 10 MB.`);
    return;
  }
  if (incoming.some(file => !file.type.startsWith("image/"))) {
    showError("Seleziona solo file immagine supportati dal browser.");
    return;
  }

  selectedFiles = incoming;
  videoInput.value = "";
  videoName.hidden = true;
  updateFileList();
}

function updateFileList() {
  selection.hidden = selectedFiles.length === 0;
  selectionCount.textContent = `${selectedFiles.length} ${selectedFiles.length === 1 ? "immagine" : "immagini"}`;
  fileList.replaceChildren();

  for (const file of selectedFiles) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    const size = document.createElement("span");
    name.textContent = file.name;
    size.textContent = formatSize(file.size);
    item.append(name, size);
    fileList.append(item);
  }

  updateAnalyzeState();
}

function updateAnalyzeState() {
  analyzeButton.disabled = isBusy || !requestToken || !modelSelect.value || selectedFiles.length === 0;
}

function clearFiles() {
  selectedFiles = [];
  imageInput.value = "";
  videoInput.value = "";
  videoName.hidden = true;
  updateFileList();
  clearError();
}

function setMode(mode) {
  selectedMode = mode;
  for (const button of document.querySelectorAll(".mode-button")) {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  imagePanel.hidden = mode !== "images";
  videoPanel.hidden = mode !== "video";
  clearFiles();
}

function extractFrames(file, onFrameExtracted) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const cleanUp = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.onerror = () => {
      cleanUp();
      reject(new Error("Il browser non riesce a leggere questo video o il suo formato non è supportato."));
    };

    video.onloadedmetadata = async () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        cleanUp();
        reject(new Error("La durata del video non è valida."));
        return;
      }

      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        cleanUp();
        reject(new Error("Il browser non supporta l'estrazione dei frame."));
        return;
      }

      const frames = [];
      try {
        for (let index = 1; index <= videoFrameCount; index += 1) {
          progressMessage.textContent = `Estrazione frame ${index} di ${videoFrameCount}…`;
          await seekTo(video, video.duration * index / 7);
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise((resolveBlob, rejectBlob) => {
            canvas.toBlob(blob => blob ? resolveBlob(blob) : rejectBlob(new Error("Impossibile codificare un frame del video.")), "image/jpeg", 0.88);
          });
          frames.push(new File([blob], `${file.name}-frame-${String(index).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
          onFrameExtracted(index);
        }
        cleanUp();
        resolve(frames);
      } catch (error) {
        cleanUp();
        reject(error);
      }
    };
  });
}

function seekTo(video, time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Errore durante la lettura di un frame del video."));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = time;
  });
}

function showProgress(message, total) {
  resultGrid.replaceChildren();
  resultCount.hidden = true;
  progressMessage.textContent = message;
  progressBar.value = 0;
  progressBar.max = total;
  progressState.hidden = false;
}

function updateProgress(completed, total, message) {
  progressMessage.textContent = message;
  progressBar.value = completed;
  progressBar.max = total;
}

function displayResults(results) {
  progressState.hidden = true;
  resultGrid.replaceChildren();
  resultCount.textContent = `${results.length} ${results.length === 1 ? "risultato" : "risultati"}`;
  resultCount.hidden = false;
  resultsSubtitle.textContent = "Elaborazione completata.";

  for (const result of results) {
    const card = document.createElement("article");
    card.className = "result-card";
    const imageWrap = document.createElement("div");
    imageWrap.className = "result-image-wrap";
    const image = document.createElement("img");
    image.className = "result-image";
    image.src = result.annotatedImageDataUrl;
    image.alt = `Immagine annotata: ${result.fileName}`;
    image.loading = "lazy";
    imageWrap.append(image);

    const meta = document.createElement("div");
    meta.className = "result-meta";
    const fileName = document.createElement("p");
    fileName.className = "result-file";
    fileName.title = result.fileName;
    fileName.textContent = result.fileName;
    const status = document.createElement("div");
    status.className = "result-status";
    const pill = document.createElement("span");
    pill.className = `status-pill${result.isNsfw ? " is-flagged" : ""}`;
    pill.textContent = result.isNsfw ? "RILEVATO" : "NESSUN RILEVAMENTO";
    const detections = document.createElement("span");
    detections.className = "detection-text";
    detections.textContent = result.detections.length
      ? result.detections.map(item => `${item.name} ${(item.confidence * 100).toFixed(0)}%`).join(" · ")
      : "—";
    status.append(pill, detections);
    meta.append(fileName, status);
    card.append(imageWrap, meta);
    resultGrid.append(card);
  }
}

async function analyze() {
  if (isBusy || selectedFiles.length === 0 || !modelSelect.value) return;
  isBusy = true;
  clearError();
  updateAnalyzeState();
  analyzeButton.classList.add("is-loading");
  buttonLabel.textContent = "Analisi in corso";

  try {
    let filesToAnalyze = selectedFiles;
    const isVideo = selectedMode === "video";
    const totalSteps = isVideo ? videoFrameCount * 2 : filesToAnalyze.length;
    let completedSteps = 0;
    showProgress(isVideo ? "Preparazione video…" : "Preparazione analisi…", totalSteps);

    if (isVideo) {
      const videoFile = selectedFiles[0];
      filesToAnalyze = await extractFrames(videoFile, extractedFrames => {
        completedSteps = extractedFrames;
        updateProgress(completedSteps, totalSteps, `Estrazione frame ${extractedFrames} di ${videoFrameCount}…`);
      });
    }

    const results = [];
    for (let index = 0; index < filesToAnalyze.length; index += 1) {
      const formData = new FormData();
      formData.append("model", modelSelect.value);
      formData.append("files", filesToAnalyze[index]);
      updateProgress(
        completedSteps,
        totalSteps,
        `Analisi ${isVideo ? "frame" : "immagine"} ${index + 1} di ${filesToAnalyze.length}…`
      );
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "X-CSRF-TOKEN": requestToken },
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.title || "Analisi non riuscita.");
      results.push(...payload);
      completedSteps += 1;
      updateProgress(
        completedSteps,
        totalSteps,
        `Analizzate ${index + 1} di ${filesToAnalyze.length} ${isVideo ? "frame" : "immagini"}…`
      );
    }
    displayResults(results);
  } catch (error) {
    progressState.hidden = true;
    resultsSubtitle.textContent = "Le rilevazioni appariranno qui.";
    showError(error.message || "Si è verificato un errore durante l'analisi.");
  } finally {
    isBusy = false;
    analyzeButton.classList.remove("is-loading");
    buttonLabel.textContent = "Avvia analisi";
    updateAnalyzeState();
  }
}

for (const button of document.querySelectorAll(".mode-button")) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}

imageInput.addEventListener("change", () => setFiles(imageInput.files));
videoInput.addEventListener("change", () => setVideo(videoInput.files[0]));
modelSelect.addEventListener("change", updateAnalyzeState);
clearSelection.addEventListener("click", clearFiles);
analyzeButton.addEventListener("click", analyze);

function setVideo(file) {
  clearError();
  if (!file) return;
  if (!file.type.startsWith("video/")) {
    showError("Seleziona un file video supportato dal browser.");
    videoInput.value = "";
    return;
  }
  if (file.size === 0 || file.size > videoSizeLimit) {
    showError("Il video è vuoto o supera il limite di 500 MB.");
    videoInput.value = "";
    return;
  }
  selectedFiles = [file];
  videoName.textContent = `${file.name} · ${formatSize(file.size)}`;
  videoName.hidden = false;
  updateAnalyzeState();
}

function enableDropzone(dropzone, onFiles) {
  dropzone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dropzone.querySelector("input").click();
    }
  });
  for (const eventName of ["dragenter", "dragover"]) {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    dropzone.addEventListener(eventName, event => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  }
  dropzone.addEventListener("drop", event => onFiles(event.dataTransfer.files));
}

enableDropzone(imageDropzone, setFiles);
enableDropzone(videoDropzone, files => setVideo(files[0]));
initialize();