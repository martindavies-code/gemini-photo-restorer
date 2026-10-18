# LuminaRestorer AI — 8K Forensic Photo Restoration & Upscaler

An automated, zero-cost AI restoration studio powered by Google Gemini multimodal models and high-fidelity canvas super-sampling.

🌐 **Live Web Application**: **[https://martindavies-code.github.io/gemini-photo-restorer/](https://martindavies-code.github.io/gemini-photo-restorer/)**

---

## ✨ Features & Capabilities

- **100% Free**: Operates using Google AI Studio's free tier with personal rate limits (no credit card or paid subscription required).
- **Embedded Flagship Preset**: Pre-configured with the custom **20-Year Senior Retoucher (Vogue & National Geographic)** forensic prompt for high-frequency skin pore, fabric weave, and studio softbox relighting.
- **Multimodal AI Synthesis**: Supports `gemini-3.1-flash-image`, `gemini-2.5-flash-image`, and `gemini-3-pro-image`.
- **Canvas Resolution Master**: Export at **Native (1X)**, **2X Super-Resolution**, **4K Ultra HD (3840×2160)**, or **8K Gallery Master (7680×4320)**.
- **3 Comparison View Modes**:
  - **Split Slider**: Draggable interactive divider with HTML5 pointer capture and sub-pixel alignment.
  - **Side-by-Side**: Simultaneous dual-card darkroom view.
  - **Quick Flash (Hold to Compare)**: Press and hold to peek at raw original input; release for restored output.
- **Macro Zoom (100% – 400%)**: Deep zoom inspection for validating skin textures, eyelashes, and weave reconstruction.
- **One-Click Test Challenges**: Synthetic test cases included (*1968 Sepia Archival Portrait*, *360p JPEG Landscape*, *Editorial Vogue Fashion Shot*).
- **Universal Key Support**: Accepts standard `AIza...` and newer `AQ.Ab...` Google AI Studio API keys.
- **Security & Privacy**: Header-based authentication (`x-goog-api-key`), strict MIME whitelisting, SVG rejection (XSS defense), and in-browser local processing—no intermediate servers.

---

## 🚀 Running Locally

```bash
npm install
npm run dev
```

Open your browser to: **`http://localhost:5173/`**

### Running Tests
```bash
npm test
```
*Executes all 42 Vitest unit tests covering input sanitization, canvas super-sampling, and Gemini API integration.*

---

## 🔑 Getting a Free API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key** (instant, $0 free personal quota).
3. In LuminaRestorer, click **Connect Gemini API Key** and paste your key.
4. Key is stored locally in your browser memory and never leaked or logged.
