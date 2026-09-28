# Atelier 8K — Forensic Photo Restoration Studio

A gallery-grade photo restoration and photographic upscaling platform powered by **Gemini 3 Pro Image** (`gemini-3-pro-image`, Nano Banana Pro) and **Gemini 3.1 Flash Image** (`gemini-3.1-flash-image`, Nano Banana 2).

Live Web Application: **[https://martindavies-code.github.io/gemini-photo-restorer/](https://martindavies-code.github.io/gemini-photo-restorer/)**

---

## 🌟 Key Features

1. **Zero-Distortion Aspect Ratio Preservation**:
   - Automatically detects original image dimensions in-browser via `createImageBitmap` (with `Image` DOM fallback) and CLI via PIL / raw JPEG & PNG header parsing.
   - Computes scale-invariant logarithmic distance ($\Delta = |\ln(W/H) - \ln(\text{ratio})|$) across 14 Gemini-supported aspect ratios.
   - Injects strict geometric non-distortion constraints into the forensic prompt to prevent stretching, squashing, letterboxing, or cropping.

2. **Enterprise Accessibility & Ergonomics (WCAG 2.1 AA/AAA)**:
   - Zero blocking browser `alert()` popups; replaced with an animated, non-blocking toast notification system and custom in-app confirmation dialogs.
   - Dedicated polite `aria-live` region announces batch processing steps to screen readers.
   - `WeakMap`-backed focus return restores keyboard focus to the exact trigger button when closing any modal dialog.
   - Full keyboard navigation for the comparison slider (`ArrowLeft`/`ArrowRight`, `Shift` for 10% jumps, `Home`/`End` bounds).
   - `@media (prefers-reduced-motion: reduce)` support disables all shimmers, animations, and transitions for vestibular sensitivity.

3. **In-Situ Forensic Comparison Slider**:
   - Subpixel-aligned before/after split slider to inspect reconstructed skin pores, fine fabric weaves, and studio softbox relighting.
   - Dynamically synchronized dimensions ensure zero distortion or misalignment during dragging or resizing.

4. **In-Browser Zero-Dependency ZIP Packaging Engine**:
   - Generates fully RFC 1951 / PKZip-compliant `.zip` archives directly in memory.
   - Computes standard CRC-32 checksums, sets Bit 11 UTF-8 encoding flags, and writes valid MS-DOS FAT timestamps for 100% compatibility with Windows File Explorer, macOS Archive Utility, and Linux unzip.

5. **Direct `FULLSIZE/` Folder Sync**:
   - Uses the browser **File System Access API** (`showDirectoryPicker`) to read local folders and automatically stream restored PNGs directly to `<YourFolder>/FULLSIZE`.
   - Remembers previously granted directory permissions via IndexedDB (`reopenSavedFolder`).

6. **Dual Mode**:
   - **Static Web Studio**: Hosted on GitHub Pages with zero backend required.
   - **Local Studio Server**: Lightweight Python HTTP server (`server.py`) with security headers and local `.env` pre-population.
   - **Headless CLI Batch Tool**: High-throughput automated batch restoration script (`restore_images.py`).

---

## 🚀 Quick Start

### 1. Hosted Web App (No Installation Needed)
Open: **[https://martindavies-code.github.io/gemini-photo-restorer/](https://martindavies-code.github.io/gemini-photo-restorer/)**

### 2. Local Studio Server
Double-click:
```bat
run_web.bat
```
*(Or in PowerShell: `.\run_web.ps1`)*

Opens `http://localhost:8000` with automatic local API key synchronization.

### 3. Headless CLI Batch Restoration
Double-click:
```bat
run.bat
```
*(Or in PowerShell: `.\run.ps1`)*

Or run directly with customized parameters:
```powershell
.venv\Scripts\python restore_images.py -f "C:\Path\To\Photos" -r 2K -a auto
```

CLI Arguments:
- `-f, --folder`: Folder path containing images.
- `-r, --resolution`: `4K` (highest detail), `2K` (recommended / cost-efficient), or `1K`.
- `-a, --aspect-ratio`: `auto` (preserves native source dimensions without distortion) or specific ratios (`1:1`, `4:3`, `3:2`, `16:9`, etc.).
- `--model`: `gemini-3-pro-image` or `gemini-3.1-flash-image`.
- `--force`: Re-process images even if already present in `FULLSIZE/`.

---

## 💡 API Cost Management & Optimization

Gemini image generation models are billed per image output tokens on Google Cloud:

| Model | Resolution | Tokens | Approx. Cost / Image |
|---|:---:|:---:|:---:|
| **Gemini 3 Pro Image** | **4K Studio** | 2,000 | ~$0.24 (~19p) |
| **Gemini 3 Pro Image** | **2K HD** | 1,120 | ~$0.13 (~10p) |
| **Gemini 3 Pro Image** | **1K SD** | 1,120 | ~$0.13 (~10p) |

> 💡 **Tip**: Running on **2K Resolution** in Studio Preferences halves your token bill compared to 4K while producing pin-sharp output for prints and albums.

---

## 🧪 Automated Test Suite (100% Pass Rate)

### Run Client Engine Tests (Node.js)
```powershell
node --test tests/test_app_engine.mjs
```
*Validates CRC-32 vectors, PKZip binary offsets, UTF-8 bit flags, path traversal sanitization, base64 decoding, XSS escaping, error parsing, and aspect ratio log-distance math.*

### Run Python Server & CLI Tests
```powershell
.venv\Scripts\python -m unittest discover -s tests -p "test_*.py"
```
*Validates server security headers, CORS origin reflection, health endpoints, config persistence, folder filtering, and binary header dimension extraction.*

---

## 🔒 Security & Privacy

- All API keys are stored only in your local browser `localStorage` or local `.env`.
- Strict Content Security Policy (`CSP`) locks down asset, script, and network origins.
- HTML entity escaping (`escapeHtml`) prevents XSS injection from untrusted filenames.
- Restored photos are written directly to your local disk or downloaded directly via memory blob URLs—images are never stored on any remote intermediary server.
