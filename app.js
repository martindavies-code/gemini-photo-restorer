/**
 * Atelier 8K - Forensic Photo Restoration & Upscaling
 * Client-Side Engine with File System Access API & Gemini 3 Pro Image Integration
 */

const DEFAULT_PROMPT = `You are a Senior High-End Photo Retoucher and AI Restoration Specialist with 20 years of experience working for top-tier publications like National Geographic and Vogue. You possess expert knowledge of photogrammetry, texture reconstruction, and professional studio lighting setups.

I have a low-quality source image that suffers from severe JPEG compression, digital noise, and lack of definition. It needs to be transformed into a gallery-quality asset suitable for large-format printing.

Perform a forensic restoration and massive upscale of this image to 8K resolution. Specifically:

1. Aggressively strip away all compression artefacts, colour banding, and sensor noise.

2. Reconstruct missing high-frequency details (such as skin pores, fabric weave, or surface textures) to eliminate any "soft" or blurry areas.

3. Re-light the scene to mimic a professional softbox setup, introducing gentle, volumetric shadows that add depth.

The final output must be a hyper-realistic, 8K resolution image. The aesthetic should match a RAW file taken with a high-end medium format camera (like a Phase One) and a prime lens at f/2.8.

Do not alter the fundamental composition or the identity of the subject. Strictly avoid the "waxy," "plastic," or overly smooth look common in AI upscaling. Do not over-saturate colours. Do not introduce over-sharpening halos. Ensure facial features remain anatomically correct and true to the original.`;

// Application State
const state = {
  apiKey: localStorage.getItem('lumina_api_key') || '',
  model: localStorage.getItem('lumina_model') || 'gemini-3-pro-image',
  resolution: localStorage.getItem('lumina_res') || '4K',
  prompt: localStorage.getItem('lumina_prompt') || DEFAULT_PROMPT,
  dirHandle: null,
  fullsizeHandle: null,
  filesQueue: [], // Array of { id, file, originalUrl, restoredUrl, restoredBlob, status, duration, error }
  isProcessing: false,
  shouldStop: false,
  activeCompareItem: null
};

// DOM Elements
const el = {
  step1: document.getElementById('stepIndicator1'),
  step2: document.getElementById('stepIndicator2'),
  step3: document.getElementById('stepIndicator3'),
  pickFolderBtn: document.getElementById('pickFolderBtn'),
  pickFilesBtn: document.getElementById('pickFilesBtn'),
  fallbackFolderInput: document.getElementById('fallbackFolderInput'),
  fallbackFilesInput: document.getElementById('fallbackFilesInput'),
  startBatchBtn: document.getElementById('startBatchBtn'),
  stopBatchBtn: document.getElementById('stopBatchBtn'),
  currentFolderLabel: document.getElementById('currentFolderLabel'),
  outputFolderLabel: document.getElementById('outputFolderLabel'),
  progressSection: document.getElementById('progressSection'),
  progressText: document.getElementById('progressText'),
  progressPercent: document.getElementById('progressPercent'),
  progressBar: document.getElementById('progressBar'),
  dropzoneContainer: document.getElementById('dropzoneContainer'),
  dropzoneBox: document.getElementById('dropzoneBox'),
  dropzoneFolderBtn: document.getElementById('dropzoneFolderBtn'),
  queueSection: document.getElementById('queueSection'),
  queueCount: document.getElementById('queueCount'),
  galleryGrid: document.getElementById('galleryGrid'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  downloadZipBtn: document.getElementById('downloadZipBtn'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  modelSelect: document.getElementById('modelSelect'),
  resolutionSelect: document.getElementById('resolutionSelect'),
  promptInput: document.getElementById('promptInput'),
  resetPromptBtn: document.getElementById('resetPromptBtn'),
  activeModelLabel: document.getElementById('activeModelLabel'),
  compareDialog: document.getElementById('compareDialog'),
  closeCompareBtn: document.getElementById('closeCompareBtn'),
  compareFilename: document.getElementById('compareFilename'),
  beforeImg: document.getElementById('beforeImg'),
  afterImg: document.getElementById('afterImg'),
  afterWrapper: document.getElementById('afterWrapper'),
  splitDivider: document.getElementById('splitDivider'),
  sliderContainer: document.getElementById('sliderContainer'),
  downloadRestoredBtn: document.getElementById('downloadRestoredBtn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await tryFetchLocalConfig();

  // Populate UI with saved settings
  el.apiKeyInput.value = state.apiKey;
  el.modelSelect.value = state.model;
  el.resolutionSelect.value = state.resolution;
  el.promptInput.value = state.prompt;
  updateModelLabel();

  setupEventListeners();
  setupSplitSlider();
  updateWorkflowStep();
});

// Sync local API key from server if running through server.py
async function tryFetchLocalConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey && !state.apiKey) {
        state.apiKey = data.apiKey;
        localStorage.setItem('lumina_api_key', data.apiKey);
      }
    }
  } catch (e) {
    // Static mode, ignore
  }
}

function updateModelLabel() {
  const modelName = state.model === 'gemini-3-pro-image' ? 'Gemini 3 Pro Image' : 'Gemini 3.1 Flash Image';
  el.activeModelLabel.textContent = `${modelName} (${state.resolution} Studio)`;
}

function updateWorkflowStep() {
  el.step1.classList.remove('active');
  el.step2.classList.remove('active');
  el.step3.classList.remove('active');

  if (state.isProcessing || state.filesQueue.some(i => i.status === 'restored')) {
    el.step3.classList.add('active');
  } else if (state.filesQueue.length > 0) {
    el.step2.classList.add('active');
  } else {
    el.step1.classList.add('active');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Folder & File Picking
  el.pickFolderBtn.addEventListener('click', handleFolderPick);
  el.dropzoneFolderBtn.addEventListener('click', handleFolderPick);
  el.pickFilesBtn.addEventListener('click', () => el.fallbackFilesInput.click());

  el.fallbackFolderInput.addEventListener('change', (e) => handleFallbackInput(e.target.files));
  el.fallbackFilesInput.addEventListener('change', (e) => handleFallbackInput(e.target.files));

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(name => {
    el.dropzoneBox.addEventListener(name, (e) => {
      e.preventDefault();
      el.dropzoneBox.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    el.dropzoneBox.addEventListener(name, (e) => {
      e.preventDefault();
      el.dropzoneBox.classList.remove('drag-over');
    });
  });
  el.dropzoneBox.addEventListener('drop', handleFileDrop);

  // Batch Execution
  el.startBatchBtn.addEventListener('click', startBatchProcessing);
  el.stopBatchBtn.addEventListener('click', () => { state.shouldStop = true; });

  // Queue tools
  el.clearAllBtn.addEventListener('click', clearQueue);
  el.downloadZipBtn.addEventListener('click', handleDownloadAllZip);

  // Preferences
  el.openSettingsBtn.addEventListener('click', () => {
    el.apiKeyInput.value = state.apiKey;
    el.modelSelect.value = state.model;
    el.resolutionSelect.value = state.resolution;
    el.promptInput.value = state.prompt;
    el.settingsDialog.showModal();
  });
  el.closeSettingsBtn.addEventListener('click', () => el.settingsDialog.close());
  el.resetPromptBtn.addEventListener('click', () => { el.promptInput.value = DEFAULT_PROMPT; });
  el.saveSettingsBtn.addEventListener('click', () => {
    state.apiKey = el.apiKeyInput.value.trim();
    state.model = el.modelSelect.value;
    state.resolution = el.resolutionSelect.value;
    state.prompt = el.promptInput.value.trim() || DEFAULT_PROMPT;

    localStorage.setItem('lumina_api_key', state.apiKey);
    localStorage.setItem('lumina_model', state.model);
    localStorage.setItem('lumina_res', state.resolution);
    localStorage.setItem('lumina_prompt', state.prompt);

    updateModelLabel();
    el.settingsDialog.close();
  });

  // Compare Dialog
  el.closeCompareBtn.addEventListener('click', () => el.compareDialog.close());
}

// Directory Picking via File System Access API
async function handleFolderPick() {
  if ('showDirectoryPicker' in window) {
    try {
      state.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      el.currentFolderLabel.textContent = state.dirHandle.name;
      el.outputFolderLabel.innerHTML = `Outputs will save directly to <mark>${state.dirHandle.name}/FULLSIZE/</mark>`;

      // Get or create FULLSIZE directory handle
      state.fullsizeHandle = await state.dirHandle.getDirectoryHandle('FULLSIZE', { create: true });

      const files = [];
      for await (const entry of state.dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          if (isImageFile(file.name)) {
            files.push(file);
          }
        }
      }

      addFilesToQueue(files);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('File system access error:', err);
        el.fallbackFolderInput.click();
      }
    }
  } else {
    el.fallbackFolderInput.click();
  }
}

function handleFallbackInput(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList).filter(f => isImageFile(f.name));
  if (files.length > 0) {
    const folderPath = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Manual Selection';
    el.currentFolderLabel.textContent = folderPath;
    el.outputFolderLabel.textContent = 'Outputs available for immediate PNG download';
    addFilesToQueue(files);
  }
}

async function handleFileDrop(e) {
  const items = e.dataTransfer.items;
  const files = [];

  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && isImageFile(file.name)) files.push(file);
      }
    }
  } else if (e.dataTransfer.files) {
    for (const file of e.dataTransfer.files) {
      if (isImageFile(file.name)) files.push(file);
    }
  }

  if (files.length > 0) {
    el.currentFolderLabel.textContent = 'Imported Images';
    el.outputFolderLabel.textContent = 'Outputs available for individual download';
    addFilesToQueue(files);
  }
}

function isImageFile(filename) {
  return /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(filename);
}

// Queue Management
function addFilesToQueue(newFiles) {
  newFiles.forEach(file => {
    const existing = state.filesQueue.find(item => item.file.name === file.name);
    if (!existing) {
      const item = {
        id: 'img_' + Math.random().toString(36).substr(2, 9),
        file: file,
        originalUrl: URL.createObjectURL(file),
        restoredUrl: null,
        restoredBlob: null,
        status: 'ready', // 'ready' | 'processing' | 'restored' | 'error'
        duration: null,
        error: null
      };
      state.filesQueue.push(item);
    }
  });

  renderQueue();
  updateWorkflowStep();
}

function clearQueue() {
  state.filesQueue.forEach(item => {
    if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    if (item.restoredUrl) URL.revokeObjectURL(item.restoredUrl);
  });
  state.filesQueue = [];
  renderQueue();
  updateWorkflowStep();
}

function renderQueue() {
  const count = state.filesQueue.length;
  el.queueCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;

  if (count === 0) {
    el.dropzoneContainer.style.display = 'block';
    el.queueSection.style.display = 'none';
    el.startBatchBtn.disabled = true;
    return;
  }

  el.dropzoneContainer.style.display = 'none';
  el.queueSection.style.display = 'flex';
  el.startBatchBtn.disabled = state.isProcessing;

  el.galleryGrid.innerHTML = '';
  state.filesQueue.forEach(item => {
    const card = createCardElement(item);
    el.galleryGrid.appendChild(card);
  });

  const hasRestored = state.filesQueue.some(i => i.status === 'restored');
  el.downloadZipBtn.style.display = hasRestored && !state.dirHandle ? 'inline-block' : 'none';
}

function createCardElement(item) {
  const card = document.createElement('div');
  card.className = `card-item status-${item.status}`;
  card.id = `card_${item.id}`;

  const sizeKb = (item.file.size / 1024).toFixed(1);
  const displayUrl = item.restoredUrl || item.originalUrl;
  const statusLabel = item.status === 'restored' ? 'RESTORED' : item.status.toUpperCase();

  const metricsText = item.status === 'restored' && item.duration
    ? `${sizeKb} KB • ${item.duration.toFixed(1)}s`
    : `${sizeKb} KB`;

  card.innerHTML = `
    <div class="card-preview">
      <img src="${displayUrl}" alt="${item.file.name}" loading="lazy">
      <span class="status-badge badge-${item.status}">${statusLabel}</span>
    </div>
    <div class="card-info">
      <span class="card-name" title="${item.file.name}">${item.file.name}</span>
      <div class="card-metrics">
        <span>${metricsText}</span>
        <span>${item.status === 'restored' ? `${state.resolution} Studio` : 'Source'}</span>
      </div>
    </div>
    <div class="card-actions-bar">
      ${item.status === 'restored' ? `
        <button type="button" class="btn-studio btn-studio-secondary compare-btn" data-id="${item.id}">Inspect Detail</button>
        <a class="btn-studio btn-studio-primary" href="${item.restoredUrl}" download="${item.file.name.replace(/\.[^/.]+$/, '')}_restored.png">Download</a>
      ` : `
        <button type="button" class="btn-studio btn-studio-ghost" disabled>Pending Queue</button>
      `}
    </div>
  `;

  const compareBtn = card.querySelector('.compare-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', () => openCompareModal(item));
  }

  return card;
}

// Batch Execution
async function startBatchProcessing() {
  if (!state.apiKey) {
    el.settingsDialog.showModal();
    alert('Please enter your Gemini API Key in Preferences to proceed.');
    return;
  }

  state.isProcessing = true;
  state.shouldStop = false;
  el.startBatchBtn.disabled = true;
  el.stopBatchBtn.style.display = 'inline-flex';
  el.progressSection.style.display = 'flex';
  updateWorkflowStep();

  const total = state.filesQueue.length;
  let processed = 0;

  for (let i = 0; i < total; i++) {
    if (state.shouldStop) break;

    const item = state.filesQueue[i];
    if (item.status === 'restored') {
      processed++;
      updateProgress(processed, total, `Skipping already restored ${item.file.name}`);
      continue;
    }

    item.status = 'processing';
    updateCardStatus(item);
    updateProgress(processed, total, `Restoring [${i + 1} of ${total}] ${item.file.name}...`);

    const t0 = performance.now();
    try {
      const restoredBlob = await callGeminiImageRestoration(item.file);
      item.restoredBlob = restoredBlob;
      item.restoredUrl = URL.createObjectURL(restoredBlob);
      item.status = 'restored';
      item.duration = (performance.now() - t0) / 1000;

      // Write directly to FULLSIZE if directory handle exists
      if (state.fullsizeHandle) {
        try {
          const outName = `${item.file.name.replace(/\.[^/.]+$/, '')}.png`;
          const fileHandle = await state.fullsizeHandle.getFileHandle(outName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(restoredBlob);
          await writable.close();
        } catch (fsErr) {
          console.error('Failed writing to FULLSIZE directory:', fsErr);
        }
      }
    } catch (err) {
      console.error(`Error restoring ${item.file.name}:`, err);
      item.status = 'error';
      item.error = err.message || 'Restoration failed';
    }

    processed++;
    updateCardStatus(item);
    updateProgress(processed, total, `Finished ${item.file.name}`);

    // Standard rate limit buffer
    await new Promise(r => setTimeout(r, 1000));
  }

  state.isProcessing = false;
  el.startBatchBtn.disabled = false;
  el.stopBatchBtn.style.display = 'none';
  el.progressText.textContent = state.shouldStop ? 'Restoration paused.' : 'All restorations complete.';
  updateWorkflowStep();
}

function updateProgress(current, total, text) {
  const pct = Math.round((current / total) * 100);
  el.progressPercent.textContent = `${pct}% (${current}/${total})`;
  el.progressBar.style.width = `${pct}%`;
  el.progressText.textContent = text;
}

function updateCardStatus(item) {
  const card = document.getElementById(`card_${item.id}`);
  if (!card) return;

  card.className = `card-item status-${item.status}`;
  const badge = card.querySelector('.status-badge');
  badge.className = `status-badge badge-${item.status}`;
  badge.textContent = item.status === 'restored' ? 'RESTORED' : item.status.toUpperCase();

  if (item.status === 'restored') {
    const previewImg = card.querySelector('.card-preview img');
    previewImg.src = item.restoredUrl;

    const sizeKb = (item.file.size / 1024).toFixed(1);
    const metricsDiv = card.querySelector('.card-metrics');
    metricsDiv.innerHTML = `
      <span>${sizeKb} KB • ${item.duration ? item.duration.toFixed(1) + 's' : ''}</span>
      <span>${state.resolution} Studio</span>
    `;

    const actions = card.querySelector('.card-actions-bar');
    actions.innerHTML = `
      <button type="button" class="btn-studio btn-studio-secondary compare-btn" data-id="${item.id}">Inspect Detail</button>
      <a class="btn-studio btn-studio-primary" href="${item.restoredUrl}" download="${item.file.name.replace(/\.[^/.]+$/, '')}_restored.png">Download</a>
    `;
    actions.querySelector('.compare-btn').addEventListener('click', () => openCompareModal(item));
  }
}

// Call Gemini 3 Pro Image API
async function callGeminiImageRestoration(file) {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${state.apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: state.prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseFormat: {
        image: {
          imageSize: state.resolution
        }
      }
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText}`);
  }

  const json = await response.json();

  if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
    for (const part of json.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        const byteCharacters = atob(part.inlineData.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: part.inlineData.mimeType || 'image/png' });
      }
    }
  }

  throw new Error('No image was returned in the Gemini API response.');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Interactive In-Situ Comparison Slider
function setupSplitSlider() {
  let isDragging = false;

  const onMove = (clientX) => {
    if (!isDragging) return;
    const rect = el.sliderContainer.getBoundingClientRect();
    let pos = ((clientX - rect.left) / rect.width) * 100;
    pos = Math.max(0, Math.min(100, pos));

    el.afterWrapper.style.width = `${pos}%`;
    el.splitDivider.style.left = `${pos}%`;
  };

  el.sliderContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    onMove(e.clientX);
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => onMove(e.clientX));

  el.sliderContainer.addEventListener('touchstart', (e) => {
    isDragging = true;
    onMove(e.touches[0].clientX);
  }, { passive: true });
  window.addEventListener('touchend', () => { isDragging = false; });
  window.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
}

function openCompareModal(item) {
  state.activeCompareItem = item;
  el.compareFilename.textContent = item.file.name;
  el.beforeImg.src = item.originalUrl;
  el.afterImg.src = item.restoredUrl;
  el.downloadRestoredBtn.href = item.restoredUrl;
  el.downloadRestoredBtn.download = `${item.file.name.replace(/\.[^/.]+$/, '')}_8K_restored.png`;

  // Reset to 50% split
  el.afterWrapper.style.width = '50%';
  el.splitDivider.style.left = '50%';

  el.compareDialog.showModal();
}

// Download All ZIP
async function handleDownloadAllZip() {
  state.filesQueue.forEach(item => {
    if (item.status === 'restored' && item.restoredUrl) {
      const a = document.createElement('a');
      a.href = item.restoredUrl;
      a.download = `${item.file.name.replace(/\.[^/.]+$/, '')}_restored.png`;
      a.click();
    }
  });
}
