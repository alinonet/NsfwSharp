# NsfwSharp WebExample

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![C# .NET 9.0](https://img.shields.io/badge/C%23-.NET%209.0-blue)](https://dotnet.microsoft.com/download/dotnet/9.0)
[![YOLOv11](https://img.shields.io/badge/YOLOv11-ONNX%20Model-blueviolet)](#)

> **La migliore libreria open source per C# .NET 9.0 che utilizza YOLOv11 con YoloDotNet (Microsoft.ML.OnnxRuntime), basata su un modello ONNX addestrato su un vasto insieme di immagini NSFW!**

NsfwSharp è la **prima implementazione al mondo** di un modello ONNX con YOLOv11 per il rilevamento di oggetti in C# .NET 9.0, progettata con cura per rilevare nudità, contenuti inappropriati e NSFW con una precisione senza pari.

---

## Indice

- [Funzionalità](#funzionalità)
- [Installazione](#installazione)
- [Utilizzo](#utilizzo)
- [Contribuire](#contribuire)
- [Segnalare problemi](#segnalare-problemi)
- [Licenza](#licenza)
- [Ringraziamenti](#ringraziamenti)
- [Contatti](#contatti)

---

## Funzionalità

- **Rilevamento all'avanguardia:** utilizza YOLOv11 per rilevare in modo affidabile i contenuti NSFW.
- **Integrazione ONNX:** basata su Microsoft.ML.OnnxRuntime per prestazioni elevate.
- **Sviluppo moderno in C#:** realizzata esclusivamente per C# .NET 9.0.
- **Vasto insieme di dati:** addestrata su un enorme insieme di dati per garantire un'elevata accuratezza.
- **Esempio interattivo:** una Web App locale che permette di selezionare e trascinare immagini e mostrare i risultati dell'analisi annotati.

---

## Installazione

Integra NsfwSharp nel tuo progetto seguendo questi semplici passaggi:

1. **Clona il repository:**

   ```bash
   git clone https://github.com/ZygoteCode/NsfwSharp.git
   cd NsfwSharp
   ```

2. **Installa le dipendenze:**

   Assicurati di aver installato [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0). Poi ripristina i pacchetti NuGet:

   ```bash
   dotnet restore
   ```

3. **Dipendenza YoloDotNet:**

   NsfwSharp richiede **YoloDotNet** per l'integrazione con YOLOv11. La dipendenza è già dichiarata in `NsfwSharp/NsfwSharp.csproj` e viene installata con `dotnet restore`; non è necessario eseguire `dotnet add package` dalla directory principale del repository.

4. **Compila il progetto:**

   ```bash
   dotnet build
   ```

---

## Utilizzo

### Compilare i modelli

Installa Python 3 e Ultralytics. Su Linux aggiungi OpenCV headless per evitare la dipendenza da `libGL.so.1`; installalo dopo Ultralytics:

```bash
python3 -m pip install ultralytics
python3 -m pip install opencv-python-headless
```

Su Windows basta `python -m pip install ultralytics`. Poi converti un modello `.pt` con il programma C#:

```bash
dotnet run --project Torch2Onnx -- models/erax_nsfw_yolo11n.pt
```

Il modello ONNX viene creato accanto al file `.pt` e compare nel selettore della Web App. Avviala dalla root con `./scripts/start_web_app.sh` oppure `scripts\start_web_app.bat`. Puoi caricare 12 immagini oppure un video: l'app estrae nel browser 6 frame nei sei punti interni che dividono la durata in 7 parti uguali.

### Avviare la Web App

La Web App accetta fino a 12 immagini (10 MB ciascuna) oppure un video (500 MB). Per un video estrae nel browser 6 frame ai punti interni che dividono la durata in 7 parti. Passando il puntatore sopra un'immagine nei risultati, l'anteprima viene ingrandita. I contenuti vengono elaborati in memoria e non sono salvati dall'app.

1. Installa il [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) e Python 3.
2. Installa Ultralytics per l'interprete Python usato dal convertitore. Su Linux installa OpenCV headless dopo Ultralytics per evitare la dipendenza da `libGL.so.1`:

   ```bash
   python3 -m pip install ultralytics
   python3 -m pip install opencv-python-headless
   ```

   Su Windows basta `python -m pip install ultralytics`.
3. Converti un peso `.pt` in ONNX. Il file `.onnx` viene creato accanto al modello sorgente:

   ```bash
   dotnet run --project Torch2Onnx -- models/erax_nsfw_yolo11n.pt
   ```

   Imposta `NSFWSHARP_PYTHON` se Python non è disponibile come `python3` (o `python` su Windows).
4. Dalla root del repository, avvia `./scripts/start_web_app.sh` oppure `scripts\start_web_app.bat` e apri l'indirizzo locale mostrato nel terminale. Il selettore carica i file `.onnx` presenti in `models`.

In un Codespace la Web App si avvia automaticamente all'avvio dell'ambiente e la porta 5000 viene aperta nel browser.

In ambiente Development è disponibile la specifica OpenAPI all'indirizzo `/openapi/v1.json`.

---

## Contribuire

Accogliamo con piacere i contributi di sviluppatori e appassionati. Per contribuire, segui questi passaggi:

1. **Crea un fork del repository:**

   Fai clic sul pulsante **Fork** in alto a destra in questa pagina.

2. **Crea un nuovo branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Apporta le modifiche:**

   Registra le modifiche con messaggi di commit chiari e concisi:

   ```bash
   git commit -m "Add: [description of your changes]"
   ```

4. **Invia le modifiche al tuo fork:**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Crea una pull request:**

   - Vai al tuo fork su GitHub.
   - Fai clic sul pulsante **Compare & pull request**.
   - Compila il modello della PR descrivendo le modifiche.
   - Invia la pull request.

I tuoi contributi sono molto apprezzati e aiutano a migliorare NsfwSharp per tutti!

---

## Segnalare problemi

Hai trovato un bug o vuoi proporre una funzionalità? Ci fa piacere ricevere il tuo feedback. Segui questi passaggi:

1. **Vai alla sezione Issues:**

   Fai clic sulla scheda **Issues** del repository.

2. **Crea una nuova issue:**

   Fai clic sul pulsante **New Issue**.

3. **Compila il modello della issue:**

   Inserisci un titolo chiaro e una descrizione dettagliata, includendo i passaggi per riprodurre il problema.

4. **Invia la issue:**

   Dopo l'invio, esamineremo la segnalazione e ce ne occuperemo il prima possibile.

---

## Licenza

NsfwSharp è distribuita con la [licenza MIT](LICENSE). Questa licenza permissiva consente di utilizzare, modificare e distribuire la libreria.

---

## Ringraziamenti

Un sentito ringraziamento all'autore originale del modello pre-addestrato. Per maggiori informazioni, consulta il modello su [HuggingFace](https://huggingface.co/erax-ai/EraX-NSFW-V1.0?not-for-all-audiences=true).

---

## Contatti

Per domande, suggerimenti o commenti, contattaci tramite [GitHub Issues](https://github.com/ZygoteCode/NsfwSharp/issues) oppure rivolgiti direttamente al responsabile del repository.

---

Buon lavoro! 🚀
