/**
 * Atelier 8K - Forensic Photo Restoration & Upscaling
 * ===================================================
 * Client-Side Engine with File System Access API, Gemini 3 Pro Image Integration,
 * Native In-Browser Zero-Dependency ZIP Packaging, and Memory Lifecycle Management.
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
  apiKey: (localStorage.getItem('lumina_api_key') || '').trim().replace(/^["']+|["']+$/g, ''),
  model: localStorage.getItem('lumina_model') || 'gemini-3-pro-image',
  resolution: localStorage.getItem('lumina_res') || '4K',
  prompt: localStorage.getItem('lumina_prompt') || DEFAULT_PROMPT,
  dirHandle: null,
  fullsizeHandle: null,
  filesQueue: [], // Array of { id, file, originalUrl, restoredUrl, restoredBlob, status, duration, error }
  isProcessing: false,
  shouldStop: false,
  activeCompareItem: null,
  allocatedUrls: new Set()
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

// CRC-32 Lookup Table for standard ZIP compliance
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function calculateCrc32(uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < uint8Array.length; i++) {
    crc = CRC32_TABLE[(crc ^ uint8Array[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Memory-Safe Object URL Allocator
function createManagedUrl(blobOrFile) {
  const url = URL.createObjectURL(blobOrFile);
  state.allocatedUrls.add(url);
  return url;
}

function revokeManagedUrl(url) {
  if (url && state.allocatedUrls.has(url)) {
    URL.revokeObjectURL(url);
    state.allocatedUrls.delete(url);
  }
}

function cleanupAllUrls() {
  state.allocatedUrls.forEach(url => URL.revokeObjectURL(url));
  state.allocatedUrls.clear();
}

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
  setupDialogBackdropDismiss();
  updateWorkflowStep();

  window.addEventListener('beforeunload', cleanupAllUrls);
});

// Sync local API key from server if running through server.py
async function tryFetchLocalConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey && !state.apiKey) {
        state.apiKey = data.apiKey.trim();
        localStorage.setItem('lumina_api_key', state.apiKey);
        el.apiKeyInput.value = state.apiKey;
      }
    }
  } catch (e) {
    // Static / standalone mode, ignore
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

// Light-Dismiss on Backdrop Click for Native <dialog>
function setupDialogBackdropDismiss() {
  [el.settingsDialog, el.compareDialog].forEach(dialog => {
    if (!dialog) return;
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
  });
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
    state.apiKey = el.apiKeyInput.value.trim().replace(/^["']|["']$/g, '');
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

  // Window resize to sync slider dimensions
  window.addEventListener('resize', () => {
    if (el.compareDialog.open) {
      syncSliderDimensions();
    }
  });
}

// Directory Picking via File System Access API
async function handleFolderPick() {
  if ('showDirectoryPicker' in window) {
    try {
      state.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      
      // Verify readwrite permission explicitly
      if (!(await verifyHandlePermission(state.dirHandle, true))) {
        throw new Error('Permission to write to chosen folder was denied.');
      }

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

async function verifyHandlePermission(handle, readWrite = true) {
  const options = {};
  if (readWrite) options.mode = 'readwrite';
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

function handleFallbackInput(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList).filter(f => isImageFile(f.name));
  if (files.length > 0) {
    const folderPath = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Manual Selection';
    el.currentFolderLabel.textContent = folderPath;
    el.outputFolderLabel.textContent = 'Outputs available for immediate PNG or ZIP download';
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
        originalUrl: createManagedUrl(file),
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
    if (item.originalUrl) revokeManagedUrl(item.originalUrl);
    if (item.restoredUrl) revokeManagedUrl(item.restoredUrl);
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
  el.downloadZipBtn.style.display = hasRestored ? 'inline-block' : 'none';
}

function removeItemFromQueue(id) {
  if (state.isProcessing) return;
  const idx = state.filesQueue.findIndex(i => i.id === id);
  if (idx !== -1) {
    const item = state.filesQueue[idx];
    if (item.originalUrl) revokeManagedUrl(item.originalUrl);
    if (item.restoredUrl) revokeManagedUrl(item.restoredUrl);
    state.filesQueue.splice(idx, 1);
    renderQueue();
    updateWorkflowStep();
  }
}

async function retrySingleImage(item) {
  if (state.isProcessing) return;
  if (!state.apiKey) {
    el.settingsDialog.showModal();
    alert('Please enter your Gemini API Key in Preferences to proceed.');
    return;
  }

  item.status = 'processing';
  item.error = null;
  updateCardStatus(item);

  const t0 = performance.now();
  try {
    const restoredBlob = await callGeminiImageRestoration(item.file);
    item.restoredBlob = restoredBlob;
    if (item.restoredUrl) revokeManagedUrl(item.restoredUrl);
    item.restoredUrl = createManagedUrl(restoredBlob);
    item.status = 'restored';
    item.duration = (performance.now() - t0) / 1000;

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
    console.error(`Error retrying ${item.file.name}:`, err);
    item.status = 'error';
    item.error = err.message || 'Restoration failed';
  }

  updateCardStatus(item);
  renderQueue();
}

function createCardElement(item) {
  const card = document.createElement('div');
  card.className = `card-item status-${item.status}`;
  card.id = `card_${item.id}`;

  const sizeKb = (item.file.size / 1024).toFixed(1);
  const displayUrl = item.restoredUrl || item.originalUrl;
  const statusLabel = item.status === 'restored' ? 'RESTORED' : item.status.toUpperCase();

  const metricsText = item.status === 'restored' && item.duration
    ? `${item.restoredBlob ? (item.restoredBlob.size / (1024 * 1024)).toFixed(2) + ' MB' : `${sizeKb} KB`} • ${item.duration.toFixed(1)}s`
    : item.status === 'error'
    ? (item.error ? (item.error.length > 25 ? item.error.slice(0, 25) + '...' : item.error) : 'Failed')
    : `${sizeKb} KB`;

  card.innerHTML = `
    <div class="card-preview">
      <img src="${displayUrl}" alt="${item.file.name}" loading="lazy">
      <span class="status-badge badge-${item.status}">${statusLabel}</span>
      <button type="button" class="btn-card-remove" data-id="${item.id}" title="Remove image from queue" aria-label="Remove image">✕</button>
    </div>
    <div class="card-info">
      <span class="card-name" title="${item.file.name}">${item.file.name}</span>
      <div class="card-metrics">
        <span>${metricsText}</span>
        <span>${item.status === 'restored' ? `${state.resolution} Studio` : item.status === 'error' ? 'Error' : 'Source'}</span>
      </div>
    </div>
    <div class="card-actions-bar">
      ${item.status === 'restored' ? `
        <button type="button" class="btn-studio btn-studio-secondary compare-btn" data-id="${item.id}">Inspect Detail</button>
        <a class="btn-studio btn-studio-primary" href="${item.restoredUrl}" download="${item.file.name.replace(/\.[^/.]+$/, '')}_restored.png">Download</a>
      ` : item.status === 'error' ? `
        <button type="button" class="btn-studio btn-studio-secondary retry-btn" data-id="${item.id}">Retry Image</button>
      ` : `
        <button type="button" class="btn-studio btn-studio-ghost" disabled>Pending Queue</button>
      `}
    </div>
  `;

  const removeBtn = card.querySelector('.btn-card-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItemFromQueue(item.id);
    });
  }

  const compareBtn = card.querySelector('.compare-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', () => openCompareModal(item));
  }

  const retryBtn = card.querySelector('.retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => retrySingleImage(item));
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
      if (item.restoredUrl) revokeManagedUrl(item.restoredUrl);
      item.restoredUrl = createManagedUrl(restoredBlob);
      item.status = 'restored';
      item.duration = (performance.now() - t0) / 1000;

      // Write directly to FULLSIZE directory if directory handle exists
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
  if (badge) {
    badge.className = `status-badge badge-${item.status}`;
    badge.textContent = item.status === 'restored' ? 'RESTORED' : item.status.toUpperCase();
  }

  if (item.status === 'restored') {
    const previewImg = card.querySelector('.card-preview img');
    if (previewImg) previewImg.src = item.restoredUrl;

    const sizeKb = (item.file.size / 1024).toFixed(1);
    const restoredSizeMb = item.restoredBlob ? (item.restoredBlob.size / (1024 * 1024)).toFixed(2) + ' MB' : `${sizeKb} KB`;
    const metricsDiv = card.querySelector('.card-metrics');
    if (metricsDiv) {
      metricsDiv.innerHTML = `
        <span>${restoredSizeMb} • ${item.duration ? item.duration.toFixed(1) + 's' : ''}</span>
        <span>${state.resolution} Studio</span>
      `;
    }

    const actions = card.querySelector('.card-actions-bar');
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn-studio btn-studio-secondary compare-btn" data-id="${item.id}">Inspect Detail</button>
        <a class="btn-studio btn-studio-primary" href="${item.restoredUrl}" download="${item.file.name.replace(/\.[^/.]+$/, '')}_restored.png">Download</a>
      `;
      actions.querySelector('.compare-btn').addEventListener('click', () => openCompareModal(item));
    }
  } else if (item.status === 'error') {
    const metricsDiv = card.querySelector('.card-metrics');
    if (metricsDiv) {
      const errMsg = item.error || 'Failed';
      metricsDiv.innerHTML = `
        <span class="error-msg" title="${errMsg}">${errMsg.length > 25 ? errMsg.slice(0, 25) + '...' : errMsg}</span>
        <span>Retry Available</span>
      `;
    }
    const actions = card.querySelector('.card-actions-bar');
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn-studio btn-studio-secondary retry-btn" data-id="${item.id}">Retry Image</button>
      `;
      actions.querySelector('.retry-btn').addEventListener('click', () => retrySingleImage(item));
    }
  }
}

// Call Gemini 3 Pro Image API with Memory-Efficient Binary Decoding
async function callGeminiImageRestoration(file) {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(state.model)}:generateContent?key=${encodeURIComponent(state.apiKey)}`;

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
      responseModalities: ["IMAGE"],
      imageConfig: {
        imageSize: state.resolution
      }
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errMessage = `API Error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errMessage = errJson.error.message;
      }
    } catch (_) {
      const text = await response.text();
      if (text) errMessage += `: ${text}`;
    }
    throw new Error(errMessage);
  }

  const json = await response.json();

  if (json.candidates && json.candidates[0].content && json.candidates[0].content.parts) {
    for (const part of json.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        const binaryString = atob(part.inlineData.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Blob([bytes], { type: part.inlineData.mimeType || 'image/png' });
      }
    }
  }

  const finishReason = json.candidates?.[0]?.finishReason || 'NO_IMAGE_RETURNED';
  throw new Error(`Model completed without image (${finishReason})`);
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

// Interactive In-Situ Comparison Slider with Pixel-Perfect Sync
function syncSliderDimensions() {
  const rect = el.sliderContainer.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    el.afterImg.style.width = `${rect.width}px`;
    el.afterImg.style.height = `${rect.height}px`;
    el.afterImg.style.maxWidth = 'none';
    el.afterImg.style.maxHeight = 'none';
  }
}

function setSliderPosition(percentage) {
  const pos = Math.max(0, Math.min(100, percentage));
  el.afterWrapper.style.width = `${pos}%`;
  el.splitDivider.style.left = `${pos}%`;
}

function setupSplitSlider() {
  let isDragging = false;

  const onMove = (clientX) => {
    if (!isDragging) return;
    const rect = el.sliderContainer.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(pos);
  };

  el.sliderContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    onMove(e.clientX);
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => onMove(e.clientX));

  el.sliderContainer.addEventListener('touchstart', (e) => {
    isDragging = true;
    if (e.touches && e.touches.length > 0) {
      onMove(e.touches[0].clientX);
    }
  }, { passive: true });
  window.addEventListener('touchend', () => { isDragging = false; });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 0) {
      onMove(e.touches[0].clientX);
    }
  }, { passive: true });

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => {
      if (el.compareDialog.open) {
        syncSliderDimensions();
      }
    });
    observer.observe(el.sliderContainer);
  }
}

function openCompareModal(item) {
  state.activeCompareItem = item;
  el.compareFilename.textContent = item.file.name;
  el.beforeImg.src = item.originalUrl;
  el.afterImg.src = item.restoredUrl;
  el.downloadRestoredBtn.href = item.restoredUrl;
  el.downloadRestoredBtn.download = `${item.file.name.replace(/\.[^/.]+$/, '')}_8K_restored.png`;

  el.compareDialog.showModal();

  el.beforeImg.onload = syncSliderDimensions;
  el.afterImg.onload = syncSliderDimensions;

  requestAnimationFrame(() => {
    syncSliderDimensions();
    setSliderPosition(50);
  });
}

// In-Browser Native Zero-Dependency ZIP Packaging
function createZipBlob(files) {
  const fileRecords = [];
  let offset = 0;
  const parts = [];
  const textEncoder = new TextEncoder();

  // Valid MS-DOS FAT Timestamp
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  const usedNames = new Set();

  for (const file of files) {
    let cleanName = (file.name || 'restored_image.png').replace(/^(\.\.[\/\\])+/, '').replace(/[\/\\]+/g, '_');
    if (usedNames.has(cleanName)) {
      const dotIdx = cleanName.lastIndexOf('.');
      const base = dotIdx !== -1 ? cleanName.slice(0, dotIdx) : cleanName;
      const ext = dotIdx !== -1 ? cleanName.slice(dotIdx) : '';
      let counter = 1;
      while (usedNames.has(`${base}_${counter}${ext}`)) {
        counter++;
      }
      cleanName = `${base}_${counter}${ext}`;
    }
    usedNames.add(cleanName);

    const nameBytes = textEncoder.encode(cleanName);
    const dataBytes = file.data;
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    // Local file header: 30 bytes + name length
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true);         // version needed
    view.setUint16(6, 0, true);          // flags
    view.setUint16(8, 0, true);          // compression (store = 0)
    view.setUint16(10, dosTime, true);   // valid MS-DOS mod time
    view.setUint16(12, dosDate, true);   // valid MS-DOS mod date
    view.setUint32(14, crc, true);       // crc-32
    view.setUint32(18, size, true);      // compressed size
    view.setUint32(22, size, true);      // uncompressed size
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);         // extra field length
    localHeader.set(nameBytes, 30);

    fileRecords.push({ nameBytes, crc, size, offset });
    offset += localHeader.length + size;

    parts.push(localHeader);
    parts.push(dataBytes);
  }

  const centralDirStart = offset;
  let centralDirSize = 0;

  // Central directory records
  for (const record of fileRecords) {
    const cdHeader = new Uint8Array(46 + record.nameBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // signature
    view.setUint16(4, 20, true);         // version made by
    view.setUint16(6, 20, true);         // version needed
    view.setUint16(8, 0, true);          // flags
    view.setUint16(10, 0, true);         // compression
    view.setUint16(10, dosTime, true);   // valid MS-DOS mod time
    view.setUint16(12, dosDate, true);   // valid MS-DOS mod date
    view.setUint32(16, record.crc, true);// crc-32
    view.setUint32(20, record.size, true);// compressed size
    view.setUint32(24, record.size, true);// uncompressed size
    view.setUint16(28, record.nameBytes.length, true);
    view.setUint16(30, 0, true);         // extra field length
    view.setUint16(32, 0, true);         // comment length
    view.setUint16(34, 0, true);         // disk start
    view.setUint16(36, 0, true);         // internal attrs
    view.setUint32(38, 0, true);         // external attrs
    view.setUint32(42, record.offset, true); // relative offset of local header
    cdHeader.set(record.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);                  // disk number
  eocdView.setUint16(6, 0, true);                  // start disk
  eocdView.setUint16(8, fileRecords.length, true); // total entries on disk
  eocdView.setUint16(10, fileRecords.length, true);// total entries
  eocdView.setUint32(12, centralDirSize, true);    // size of cd
  eocdView.setUint32(16, centralDirStart, true);   // offset of cd
  eocdView.setUint16(20, 0, true);                 // comment length

  parts.push(eocd);
  return new Blob(parts, { type: 'application/zip' });
}

// Download All Restored Photos as a Single ZIP File
async function handleDownloadAllZip() {
  const restoredItems = state.filesQueue.filter(item => item.status === 'restored' && item.restoredBlob);
  if (restoredItems.length === 0) {
    alert('No restored images available to package into ZIP.');
    return;
  }

  el.downloadZipBtn.disabled = true;
  el.downloadZipBtn.textContent = 'Packaging ZIP...';

  try {
    const filesForZip = [];
    for (const item of restoredItems) {
      const buffer = await item.restoredBlob.arrayBuffer();
      const outName = `${item.file.name.replace(/\.[^/.]+$/, '')}_restored.png`;
      filesForZip.push({
        name: outName,
        data: new Uint8Array(buffer)
      });
    }

    const zipBlob = createZipBlob(filesForZip);
    const zipUrl = createManagedUrl(zipBlob);

    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `Atelier_8K_Restorations_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => revokeManagedUrl(zipUrl), 10000);
  } catch (err) {
    console.error('ZIP generation error:', err);
    alert('Could not package ZIP: ' + err.message);
  } finally {
    el.downloadZipBtn.disabled = false;
    el.downloadZipBtn.textContent = 'Download Restored ZIP';
  }
}
