# Lumina 8K — Gemini Forensic Photo Restorer & Upscaler

A gallery-grade AI photo restoration and forensic upscaling platform powered by **Gemini 3 Pro Image** (`gemini-3-pro-image`, Nano Banana Pro).

---

## Highlights

- **Stunning Glassmorphism Web App**: Real-time batch processing, interactive split-screen Before/After slider, image queue management, and dark obsidian UI.
- **Direct `FULLSIZE/` Folder Sync**: Uses the modern browser **File System Access API** to read your chosen directory and write restored 4K/8K uncompressed PNGs directly to `<YourFolder>/FULLSIZE`.
- **Directory Memory**: Remembers your previously selected folder across sessions.
- **Forensic Retouching Engine**: Reconstructs high-frequency textures (skin pores, fabric weave), corrects compression artifacts, and relights with softbox studio lighting mimicking a Phase One medium-format camera at f/2.8.
- **Dual Interface**: Includes both a modern **Web UI** and a headless/native **CLI Batch Tool**.

---

## Quick Start (Web Interface)

### 1. One-Click Launch
Double-click:
```
run_web.bat
```
This automatically starts the local server and opens your browser at `http://localhost:8000`.

*(Or in PowerShell: `.\run_web.ps1`)*

### 2. Using the Web UI
1. Click **Choose Folder** to select your target photo directory.
2. Grant read/write permission (enables direct writing to the `FULLSIZE/` subfolder).
3. Click **Start Restoration**.
4. Click **Compare** on any card to slide between the original low-res and the restored 4K asset!

---

## Quick Start (CLI Batch Tool)

### 1. One-Click Launch
Double-click:
```
run.bat
```
*(Or in PowerShell: `.\run.ps1` or `.\.venv\Scripts\python.exe restore_images.py -f "C:\Path\To\Photos"`)*

---

## Configuration

Your Gemini API key is stored locally in `.env` (which is git-ignored and never committed):
```env
GEMINI_API_KEY=your_key_here
```
Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
