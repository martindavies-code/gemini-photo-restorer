# Atelier 8K — Forensic Photo Restoration Studio

A gallery-grade photo restoration and photographic upscaling platform powered by **Gemini 3 Pro Image** (`gemini-3-pro-image`, Nano Banana Pro).

Designed intentionally to avoid the 10 common pitfalls of AI "vibe-coded" dashboards:
1. **Guided User Journey**: Replaces unstructured data dumps with a focused 3-step workflow (Select Folder ➔ Review Queue ➔ Forensic 4K Output).
2. **Intentional Visual Hierarchy**: Distinct elevations, purposeful contrast, and clear primary calls-to-action.
3. **No Wasted Hero Space**: Compact, high-utility session bar and upload shelf without bloated blank space.
4. **Structured Inspection**: Clean, concise image cards with tabular alignment and instant status clarity.
5. **In-Situ Comparison Labels**: Interactive Before/After split slider with direct on-image labelling—no detached legends.
6. **Key Metrics Forefronted**: Highlights resolution (`4K Studio`), file size, and processing duration prominently.
7. **No Duplicated Information**: Single unified status readout and progress metrics without redundant badges.
8. **Editorial Darkroom Palette**: Dark slate charcoal and warm Leica amber/tungsten tones in place of generic neon cyberpunk orbs.
9. **Distinguished Typography**: *Fraunces* editorial display serif paired with *Plus Jakarta Sans* and tabular numerals.
10. **Disciplined 4/8pt Spacing Scale**: Strict design token system with unified radii and padding throughout.

---

## Features

- **Direct `FULLSIZE/` Folder Sync**: Uses the browser **File System Access API** (`showDirectoryPicker`) to read your folder and write restored 4K/8K uncompressed PNGs directly to `<YourFolder>/FULLSIZE`.
- **Interactive Before/After Slider**: Side-by-side forensic split-slider to inspect high-frequency skin pores, fabric weaves, and softbox relighting.
- **Gemini 3 Pro Image Engine**: Native 4K output with forensic restoration prompting.
- **Dual Interface**: Includes both the **Web Studio** and a **CLI Batch Tool**.

---

## Quick Start (Web Studio)

### One-Click Launch (Recommended)
Double-click:
```
run_web.bat
```
*(Or in PowerShell: `.\run_web.ps1`)*

The local studio server will start and open `http://localhost:8000` in your browser.

---

## Quick Start (CLI Batch Tool)

Double-click:
```
run.bat
```
*(Or in PowerShell: `.\run.ps1`)*

---

## Configuration

Your Gemini API key is stored locally in `.env` (git-ignored, never committed):
```env
GEMINI_API_KEY=your_key_here
```
Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
