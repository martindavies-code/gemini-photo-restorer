/**
 * Atelier 8K - Forensic Photo Restoration & Upscaling
 * ===================================================
 * Client-Side Engine with File System Access API, Gemini 3 Pro Image Integration,
 * Native In-Browser Zero-Dependency ZIP Packaging, and Memory Lifecycle Management.
 */

// ─── Toast Notification System ───────────────────────────────────────────────
// Replaces all browser alert() calls. Non-blocking, screen-reader friendly,
// auto-dismisses. Types: 'success' | 'error' | 'warning' | 'info'
const TOAST_ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function showToast(message, type = 'info', durationMs = 4500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-message">${message}</span>
    <button type="button" class="toast-close" aria-label="Dismiss notification">✕</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
  container.appendChild(toast);

  // Trigger entrance animation on next frame
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  const timer = setTimeout(() => dismissToast(toast), durationMs);
  toast._timer = timer;
}

function dismissToast(toast) {
  clearTimeout(toast._timer);
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-hiding');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ─── ARIA Live Announcer ──────────────────────────────────────────────────────
// Announces status changes to screen readers without interrupting flow.
function announceToScreenReader(message) {
  const live = document.getElementById('ariaLive');
  if (!live) return;
  // Clear then re-set to force re-announcement of identical messages
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = message; });
}

// ─── API Key Status Indicator ────────────────────────────────────────────────
function updateApiKeyStatus() {
  const hasKey = Boolean(state.apiKey);
  const pill   = document.getElementById('apiKeyStatus');
  const text   = document.getElementById('apiKeyStatusText');
  const banner = document.getElementById('onboardingBanner');
  const liveStatus = document.getElementById('apiKeyLiveStatus');

  if (pill) {
    pill.className = `api-key-pill ${hasKey ? 'api-key-ok' : 'api-key-missing'}`;
    pill.title = hasKey ? 'API key configured — click to change' : 'No API key — click to add one';
    pill.setAttribute('aria-label', hasKey ? 'API key is configured. Click to open preferences.' : 'No API key set. Click to open preferences.');
  }
  if (text)       text.textContent = hasKey ? '✓ API Key Set' : '⚠ No API Key';
  if (banner)     banner.style.display = hasKey ? 'none' : 'flex';
  if (liveStatus) liveStatus.textContent = hasKey ? '✓ Key saved' : '';
}


const DEFAULT_PROMPT = `You are a Senior High-End Photo Retoucher and AI Restoration Specialist with 20 years of experience working for top-tier publications like National Geographic and Vogue. You possess expert knowledge of photogrammetry, texture reconstruction, and professional studio lighting setups.

I have a low-quality source image that suffers from severe JPEG compression, digital noise, and lack of definition. It needs to be transformed into a gallery-quality asset suitable for large-format printing.

Perform a forensic restoration and massive upscale of this image to 8K resolution. Specifically:

1. Aggressively strip away all compression artefacts, colour banding, and sensor noise.

2. Reconstruct missing high-frequency details (such as skin pores, fabric weave, or surface textures) to eliminate any "soft" or blurry areas.

3. Re-light the scene to mimic a professional softbox setup, introducing gentle, volumetric shadows that add depth.

The final output must be a hyper-realistic, 8K resolution image. The aesthetic should match a RAW file taken with a high-end medium format camera (like a Phase One) and a prime lens at f/2.8.

Do not alter the fundamental composition or the identity of the subject. Strictly avoid the "waxy," "plastic," or overly smooth look common in AI upscaling. Do not over-saturate colours. Do not introduce over-sharpening halos. Ensure facial features remain anatomically correct and true to the original. Strictly preserve the original aspect ratio, framing, and physical geometry. Do NOT stretch, squash, crop, letterbox, pillarbox, pad, or alter the geometric perspective of the source image in any way.`;

// Gemini-supported aspect ratios with their numeric values (width/height)
const GEMINI_ASPECT_RATIOS = [
  { label: '1:1',  value: 1.0 },
  { label: '4:3',  value: 4 / 3 },
  { label: '3:4',  value: 3 / 4 },
  { label: '3:2',  value: 3 / 2 },
  { label: '2:3',  value: 2 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '5:4',  value: 5 / 4 },
  { label: '4:5',  value: 4 / 5 },
  { label: '21:9', value: 21 / 9 },
];

/**
 * Given a File, resolves to the Gemini aspect ratio label that best
 * preserves the native geometry (log-scale, so 4:3 == 3:4 distance-wise).
 * Falls back to '1:1' if dimensions cannot be determined.
 * @param {File} file
 * @returns {Promise<string>}
 */
async function detectAspectRatio(file) {
  try {
    let width = 0;
    let height = 0;
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch (_) {}
    }
    if (!width || !height) {
      const dimensions = await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const dims = { width: img.naturalWidth, height: img.naturalHeight };
          URL.revokeObjectURL(url);
          resolve(dims);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({ width: 0, height: 0 });
        };
        img.src = url;
      });
      width = dimensions.width;
      height = dimensions.height;
    }
    if (!width || !height) return '1:1';
    const target = Math.log(width / height);
    let best = GEMINI_ASPECT_RATIOS[0];
    let bestDist = Infinity;
    for (const ratio of GEMINI_ASPECT_RATIOS) {
      const dist = Math.abs(target - Math.log(ratio.value));
      if (dist < bestDist) {
        bestDist = dist;
        best = ratio;
      }
    }
    return best.label;
  } catch {
    return '1:1';
  }
}

// ─── XSS Guard ───────────────────────────────────────────────────────────────
// Always escape user-controlled strings before injecting into innerHTML.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Gemini Error Classifier ─────────────────────────────────────────────────
// Converts raw API error messages into user-actionable English.
function parseGeminiError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted'))
    return 'Rate limit hit — wait a moment and retry';
  if (msg.includes('401') || msg.includes('api key not valid') || msg.includes('permission_denied'))
    return 'Invalid API key — check Preferences';
  if (msg.includes('403'))
    return 'API key lacks permission — check Google AI Studio';
  if (msg.includes('400') && msg.includes('request'))
    return 'Bad request — image may be too large or malformed';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed'))
    return 'Network error — check your connection';
  if (msg.includes('no image') || msg.includes('no_image') || msg.includes('finishreason'))
    return 'Model returned no image — try a different image or prompt';
  return err?.message || 'Restoration failed';
}

// ─── Focus Return Map & Dialog Manager ───────────────────────────────────────
// Stores the element that was focused when a dialog opened, so we can
// restore focus to it when the dialog closes — per WCAG 2.1 §3.2.2.
const dialogFocusReturn = new WeakMap();

function openDialog(dialog, triggerElement) {
  if (!dialog) return;
  dialogFocusReturn.set(dialog, triggerElement || document.activeElement);
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(dialog) {
  if (dialog && dialog.open) {
    dialog.close();
  }
}

// Robust API key sanitization (strips extraneous CLI flags, quotes, whitespace)
function sanitizeApiKey(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim()
    .replace(/^-m\s+/i, '')
    .replace(/^--key\s+/i, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

// Application State
const state = {
  apiKey: sanitizeApiKey(localStorage.getItem('lumina_api_key')),
  model: localStorage.getItem('lumina_model') || 'gemini-3-pro-image',
  resolution: localStorage.getItem('lumina_res') || '4K',
  aspectRatio: localStorage.getItem('lumina_aspect') || 'auto',
  prompt: localStorage.getItem('lumina_prompt') || DEFAULT_PROMPT,
  dirHandle: null,
  fullsizeHandle: null,
  filesQueue: [], // Array of { id, file, originalUrl, restoredUrl, restoredBlob, status, duration, error }
  isProcessing: false,
  shouldStop: false,
  activeAbortController: null,
  activeCompareItem: null,
  allocatedUrls: new Set()
};

// DOM Elements
const el = {
  step1: document.getElementById('stepIndicator1'),
  step2: document.getElementById('stepIndicator2'),
  step3: document.getElementById('stepIndicator3'),
  pickFolderBtn: document.getElementById('pickFolderBtn'),
  reopenFolderBtn: document.getElementById('reopenFolderBtn'),
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
  aspectRatioSelect: document.getElementById('aspectRatioSelect'),
  promptInput: document.getElementById('promptInput'),
  resetPromptBtn: document.getElementById('resetPromptBtn'),
  activeModelLabel: document.getElementById('activeModelLabel'),
  compareDialog: document.getElementById('compareDialog'),
  closeCompareBtn: document.getElementById('closeCompareBtn'),
  compareFilename: document.getElementById('compareFilename'),
  compareAspectBadge: document.getElementById('compareAspectBadge'),
  beforeImg: document.getElementById('beforeImg'),
  afterImg: document.getElementById('afterImg'),
  afterWrapper: document.getElementById('afterWrapper'),
  splitDivider: document.getElementById('splitDivider'),
  sliderContainer: document.getElementById('sliderContainer'),
  downloadRestoredBtn: document.getElementById('downloadRestoredBtn'),
  apiKeyStatus: document.getElementById('apiKeyStatus'),
  onboardingAddKeyBtn: document.getElementById('onboardingAddKeyBtn')
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

// Persistent Folder Memory via Zero-Dependency IndexedDB
const IDB_KEY = 'atelier_last_dir_handle';
function openHandleDb() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open('Atelier8K_Storage', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('handles');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function saveStoredDirectoryHandle(handle) {
  try {
    const db = await openHandleDb();
    if (!db) return;
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, IDB_KEY);
  } catch (_) {}
}

async function getStoredDirectoryHandle() {
  try {
    const db = await openHandleDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // Check for one-click setup via URL parameter (?key=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramKey = urlParams.get('key');
    if (paramKey) {
      const sanitized = sanitizeApiKey(paramKey);
      if (sanitized) {
        state.apiKey = sanitized;
        localStorage.setItem('lumina_api_key', state.apiKey);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('API key configured and saved securely.', 'success', 3500);
      }
    }
  } catch (_) {}

  await tryFetchLocalConfig();

  // Populate UI with saved settings
  el.apiKeyInput.value = state.apiKey;
  el.modelSelect.value = state.model;
  el.resolutionSelect.value = state.resolution;
  if (el.aspectRatioSelect) el.aspectRatioSelect.value = state.aspectRatio;
  el.promptInput.value = state.prompt;
  updateModelLabel();

  setupEventListeners();
  setupSplitSlider();
  setupDialogBackdropDismiss();
  updateWorkflowStep();
  updateApiKeyStatus();

  // API key show/hide toggle
  const toggleBtn = document.getElementById('toggleApiKeyBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = el.apiKeyInput;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      toggleBtn.setAttribute('aria-label', isHidden ? 'Hide API key' : 'Show API key');
    });
  }

  // Check if a previously selected directory handle exists in IndexedDB
  const storedHandle = await getStoredDirectoryHandle();
  if (storedHandle && el.reopenFolderBtn) {
    el.reopenFolderBtn.style.display = 'inline-flex';
    el.reopenFolderBtn.title = `Reopen previously chosen folder: ${storedHandle.name}`;
    const span = el.reopenFolderBtn.querySelector('span');
    if (span) span.textContent = `↺ Reopen ${storedHandle.name}`;
  }

  window.addEventListener('beforeunload', cleanupAllUrls);
});

// Sync local API key from server if running through server.py
async function tryFetchLocalConfig() {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalHost) return;

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey && !state.apiKey) {
        state.apiKey = sanitizeApiKey(data.apiKey);
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
      if (e.target === dialog) closeDialog(dialog);
    });
    // Restore focus when dialog is closed via Escape key
    dialog.addEventListener('close', () => {
      const returnEl = dialogFocusReturn.get(dialog);
      if (returnEl && typeof returnEl.focus === 'function') {
        requestAnimationFrame(() => returnEl.focus());
      }
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Folder & File Picking
  el.pickFolderBtn.addEventListener('click', handleFolderPick);
  if (el.reopenFolderBtn) {
    el.reopenFolderBtn.addEventListener('click', reopenSavedFolder);
  }
  el.dropzoneFolderBtn.addEventListener('click', handleFolderPick);
  el.pickFilesBtn.addEventListener('click', () => el.fallbackFilesInput.click());

  el.fallbackFolderInput.addEventListener('change', (e) => handleFallbackInput(e.target.files));
  el.fallbackFilesInput.addEventListener('change', (e) => handleFallbackInput(e.target.files));

  // Onboarding & Header Key Triggers
  if (el.onboardingAddKeyBtn) {
    el.onboardingAddKeyBtn.addEventListener('click', () => el.openSettingsBtn.click());
  }
  if (el.apiKeyStatus) {
    el.apiKeyStatus.addEventListener('click', () => el.openSettingsBtn.click());
    el.apiKeyStatus.setAttribute('role', 'button');
    el.apiKeyStatus.setAttribute('tabindex', '0');
    el.apiKeyStatus.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.openSettingsBtn.click();
      }
    });
  }

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
  el.stopBatchBtn.addEventListener('click', handleStopProcessing);

  // Queue tools
  el.clearAllBtn.addEventListener('click', clearQueue);
  el.downloadZipBtn.addEventListener('click', handleDownloadAllZip);

  // Preferences
  el.openSettingsBtn.addEventListener('click', () => {
    el.apiKeyInput.value = state.apiKey;
    el.modelSelect.value = state.model;
    el.resolutionSelect.value = state.resolution;
    if (el.aspectRatioSelect) el.aspectRatioSelect.value = state.aspectRatio;
    el.promptInput.value = state.prompt;
    openDialog(el.settingsDialog, el.openSettingsBtn);
  });
  el.closeSettingsBtn.addEventListener('click', () => closeDialog(el.settingsDialog));
  el.resetPromptBtn.addEventListener('click', () => { el.promptInput.value = DEFAULT_PROMPT; });
  el.saveSettingsBtn.addEventListener('click', () => {
    state.apiKey = sanitizeApiKey(el.apiKeyInput.value);
    state.model = el.modelSelect.value;
    state.resolution = el.resolutionSelect.value;
    state.aspectRatio = el.aspectRatioSelect ? el.aspectRatioSelect.value : 'auto';
    state.prompt = el.promptInput.value.trim() || DEFAULT_PROMPT;

    localStorage.setItem('lumina_api_key', state.apiKey);
    localStorage.setItem('lumina_model', state.model);
    localStorage.setItem('lumina_res', state.resolution);
    localStorage.setItem('lumina_aspect', state.aspectRatio);
    localStorage.setItem('lumina_prompt', state.prompt);

    updateModelLabel();
    updateApiKeyStatus();
    updateStartButtonState();
    closeDialog(el.settingsDialog);
    showToast('Preferences saved.', 'success', 2500);
  });

  // Compare Dialog
  el.closeCompareBtn.addEventListener('click', () => closeDialog(el.compareDialog));

  // Window resize to sync slider dimensions
  window.addEventListener('resize', () => {
    if (el.compareDialog.open) {
      syncSliderDimensions();
    }
  });
}

async function loadDirectoryHandle(dirHandle) {
  state.dirHandle = dirHandle;
  await saveStoredDirectoryHandle(dirHandle);

  if (el.reopenFolderBtn) {
    el.reopenFolderBtn.style.display = 'none';
  }

  el.currentFolderLabel.textContent = dirHandle.name;
  el.outputFolderLabel.innerHTML = `Outputs will save directly to <mark>${dirHandle.name}/FULLSIZE/</mark>`;

  state.fullsizeHandle = await dirHandle.getDirectoryHandle('FULLSIZE', { create: true });

  const files = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      if (isImageFile(file.name)) {
        files.push(file);
      }
    }
  }

  addFilesToQueue(files);
}

async function reopenSavedFolder() {
  const storedHandle = await getStoredDirectoryHandle();
  if (!storedHandle) return;
  try {
    if (!(await verifyHandlePermission(storedHandle, true))) {
      showToast('Permission to access the previously chosen folder was denied. Please choose the folder again.', 'warning', 6000);
      return;
    }
    await loadDirectoryHandle(storedHandle);
  } catch (err) {
    console.error('Error reopening stored folder:', err);
    if (el.reopenFolderBtn) el.reopenFolderBtn.style.display = 'none';
  }
}

// Directory Picking via File System Access API
async function handleFolderPick() {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      if (!(await verifyHandlePermission(handle, true))) {
        throw new Error('Permission to write to chosen folder was denied.');
      }
      await loadDirectoryHandle(handle);
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
  if (state.isProcessing) {
    showToast('Cannot clear the queue while processing is active. Stop processing first.', 'warning');
    return;
  }
  const count = state.filesQueue.length;
  if (count === 0) return;

  // Custom in-app confirmation — no browser confirm() which is also blocking
  const container = document.getElementById('toastContainer');
  if (!container) return;

  // Dismiss any existing confirm toasts
  container.querySelectorAll('.toast-confirm').forEach(t => t.remove());

  const confirmToast = document.createElement('div');
  confirmToast.className = 'toast toast-confirm toast-visible';
  confirmToast.setAttribute('role', 'alertdialog');
  confirmToast.setAttribute('aria-label', `Remove all ${count} images from queue?`);
  confirmToast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">⚠</span>
    <span class="toast-message">Remove all <strong>${count}</strong> image${count !== 1 ? 's' : ''} from the queue?</span>
    <div class="toast-actions">
      <button type="button" class="toast-btn-confirm">Clear All</button>
      <button type="button" class="toast-btn-cancel">Keep</button>
    </div>
  `;

  confirmToast.querySelector('.toast-btn-confirm').addEventListener('click', () => {
    confirmToast.remove();
    state.filesQueue.forEach(item => {
      if (item.originalUrl) revokeManagedUrl(item.originalUrl);
      if (item.restoredUrl) revokeManagedUrl(item.restoredUrl);
    });
    state.filesQueue = [];
    renderQueue();
    updateWorkflowStep();
    showToast(`Queue cleared — ${count} image${count !== 1 ? 's' : ''} removed.`, 'info', 3000);
    announceToScreenReader('Queue cleared.');
  });

  confirmToast.querySelector('.toast-btn-cancel').addEventListener('click', () => confirmToast.remove());
  container.appendChild(confirmToast);
  confirmToast.querySelector('.toast-btn-confirm').focus();
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
  // Only enable start if there are items not yet restored and we're not running
  const hasPending = state.filesQueue.some(i => i.status !== 'restored');
  el.startBatchBtn.disabled = state.isProcessing || !hasPending;

  // ── Incremental DOM update ──────────────────────────────────────────────────
  // 1. Build a set of current item IDs for fast lookup
  const currentIds = new Set(state.filesQueue.map(i => i.id));

  // 2. Remove cards that no longer exist in the queue
  for (const existingCard of Array.from(el.galleryGrid.children)) {
    if (!currentIds.has(existingCard.dataset.itemId)) {
      existingCard.remove();
    }
  }

  // 3. Append cards for new items (preserve existing ones in place to avoid flicker)
  state.filesQueue.forEach(item => {
    const existing = el.galleryGrid.querySelector(`[data-item-id="${item.id}"]`);
    if (!existing) {
      const card = createCardElement(item);
      el.galleryGrid.appendChild(card);
    }
  });

  const hasRestored = state.filesQueue.some(i => i.status === 'restored');
  el.downloadZipBtn.style.display = hasRestored ? 'inline-flex' : 'none';
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
    openDialog(el.settingsDialog, el.openSettingsBtn);
    showToast('Please add your Gemini API Key in Preferences to continue.', 'warning');
    return;
  }

  item.status = 'processing';
  item.error = null;
  updateCardStatus(item);

  const t0 = performance.now();
  state.activeAbortController = new AbortController();
  try {
    const restoredBlob = await callGeminiImageRestoration(item.file, state.activeAbortController.signal);
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
    if (err.name === 'AbortError') {
      item.status = 'ready';
      updateCardStatus(item);
      return;
    }
    console.error(`Error retrying ${item.file.name}:`, err);
    item.status = 'error';
    item.error = parseGeminiError(err);
  } finally {
    state.activeAbortController = null;
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
  const safeName    = escapeHtml(item.file.name);

  const metricsText = item.status === 'restored' && item.duration
    ? `${item.restoredBlob ? (item.restoredBlob.size / (1024 * 1024)).toFixed(2) + ' MB' : `${sizeKb} KB`} · ${item.duration.toFixed(1)}s`
    : item.status === 'error'
    ? escapeHtml(parseGeminiError({ message: item.error }))
    : `${sizeKb} KB`;

  card.dataset.itemId = item.id;
  card.innerHTML = `
    <div class="card-preview">
      <img src="${displayUrl}" alt="${safeName}" loading="lazy" decoding="async">
      <span class="status-badge badge-${item.status}" aria-label="Status: ${statusLabel}">${statusLabel}</span>
      <button type="button" class="btn-card-remove" data-id="${escapeHtml(item.id)}" title="Remove ${safeName} from queue" aria-label="Remove ${safeName} from queue">✕</button>
    </div>
    <div class="card-info">
      <span class="card-name" title="${safeName}">${safeName}</span>
      <div class="card-metrics">
        <span class="${item.status === 'error' ? 'error-msg' : ''}" title="${escapeHtml(metricsText)}">${metricsText}</span>
        <span>${item.status === 'restored' ? `${state.resolution} Studio` : item.status === 'error' ? 'Tap Retry' : 'Source'}</span>
      </div>
    </div>
    <div class="card-actions-bar">
      ${item.status === 'restored' ? `
        <button type="button" class="btn-studio btn-studio-secondary compare-btn" data-id="${escapeHtml(item.id)}" aria-label="Inspect before/after detail for ${safeName}">Inspect Detail</button>
        <a class="btn-studio btn-studio-primary" href="${item.restoredUrl}" download="${safeName.replace(/\.[^/.]+$/, '')}_restored.png" aria-label="Download restored ${safeName}">Download</a>
      ` : item.status === 'error' ? `
        <button type="button" class="btn-studio btn-studio-secondary retry-btn" data-id="${escapeHtml(item.id)}" aria-label="Retry restoration of ${safeName}">Retry Image</button>
      ` : `
        <button type="button" class="btn-studio btn-studio-ghost" disabled aria-label="${safeName} is pending in queue">Pending Queue</button>
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

  // Mark skeleton as resolved once image loads
  const previewImg = card.querySelector('.card-preview img');
  const previewWrap = card.querySelector('.card-preview');
  if (previewImg && previewWrap) {
    if (previewImg.complete && previewImg.naturalWidth > 0) {
      previewWrap.classList.add('img-loaded');
    } else {
      previewImg.addEventListener('load', () => previewWrap.classList.add('img-loaded'), { once: true });
    }
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
function handleStopProcessing() {
  state.shouldStop = true;
  if (state.activeAbortController) {
    state.activeAbortController.abort();
    state.activeAbortController = null;
  }
}

let batchStartTime = 0;

async function startBatchProcessing() {
  if (!state.apiKey) {
    openDialog(el.settingsDialog, el.openSettingsBtn);
    showToast('Please add your Gemini API Key in Preferences to continue.', 'warning');
    return;
  }

  state.isProcessing = true;
  state.shouldStop = false;
  state.activeAbortController = null;
  batchStartTime = performance.now();
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
    const progressMsg = `Restoring [${i + 1} of ${total}] ${item.file.name}...`;
    updateProgress(processed, total, progressMsg, batchStartTime);
    announceToScreenReader(progressMsg);

    const t0 = performance.now();
    state.activeAbortController = new AbortController();
    try {
      const restoredBlob = await callGeminiImageRestoration(item.file, state.activeAbortController.signal);
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
      if (err.name === 'AbortError' || state.shouldStop) {
        console.warn(`Restoration aborted for ${item.file.name}`);
        item.status = 'ready';
        updateCardStatus(item);
        break;
      }
      console.error(`Error restoring ${item.file.name}:`, err);
      item.status = 'error';
      item.error = parseGeminiError(err);
    } finally {
      state.activeAbortController = null;
    }

    processed++;
    updateCardStatus(item);
    updateProgress(processed, total, `Finished ${item.file.name}`, batchStartTime);

    if (state.shouldStop) break;

    // Standard rate limit buffer with abort capability
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      if (state.shouldStop) {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  state.isProcessing = false;
  const hasPending = state.filesQueue.some(i => i.status !== 'restored');
  el.startBatchBtn.disabled = !hasPending;
  el.stopBatchBtn.style.display = 'none';
  const doneMsg = state.shouldStop ? 'Processing stopped.' : 'All restorations complete ✓';
  el.progressText.textContent = doneMsg;
  announceToScreenReader(doneMsg);
  if (!state.shouldStop) {
    const restoredCount = state.filesQueue.filter(i => i.status === 'restored').length;
    showToast(`✓ ${restoredCount} image${restoredCount !== 1 ? 's' : ''} restored successfully.`, 'success', 6000);
  }
  updateWorkflowStep();
  renderQueue(); // refresh ZIP button visibility
}

function updateProgress(current, total, text, startTime) {
  const pct = Math.round((current / total) * 100);
  let etaSuffix = '';
  if (startTime && current > 0 && current < total) {
    const elapsed = (performance.now() - startTime) / 1000;
    const avgSec = elapsed / current;
    const remainingSec = avgSec * (total - current);
    if (remainingSec > 4) {
      const mins = Math.floor(remainingSec / 60);
      const secs = Math.ceil(remainingSec % 60);
      etaSuffix = mins > 0
        ? ` · ETA ~${mins}m ${secs}s`
        : ` · ETA ~${secs}s`;
    }
  }
  el.progressPercent.textContent = `${pct}% (${current}/${total})${etaSuffix}`;
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
        <span>${restoredSizeMb} · ${item.duration ? item.duration.toFixed(1) + 's' : ''}</span>
        <span>${state.resolution} Studio</span>
      `;
    }

    const actions = card.querySelector('.card-actions-bar');
    if (actions) {
      const safeName = escapeHtml(item.file.name);
      actions.innerHTML = `
        <button type="button" class="btn-studio btn-studio-secondary compare-btn" data-id="${escapeHtml(item.id)}" aria-label="Inspect detail for ${safeName}">Inspect Detail</button>
        <a class="btn-studio btn-studio-primary" href="${item.restoredUrl}" download="${safeName.replace(/\.[^/.]+$/, '')}_restored.png" aria-label="Download ${safeName}">Download</a>
      `;
      actions.querySelector('.compare-btn').addEventListener('click', () => openCompareModal(item));
    }
  } else if (item.status === 'error') {
    const metricsDiv = card.querySelector('.card-metrics');
    if (metricsDiv) {
      const friendlyErr = escapeHtml(parseGeminiError({ message: item.error }));
      metricsDiv.innerHTML = `
        <span class="error-msg" title="${friendlyErr}">${friendlyErr}</span>
        <span>Tap Retry</span>
      `;
    }
    const actions = card.querySelector('.card-actions-bar');
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn-studio btn-studio-secondary retry-btn" data-id="${escapeHtml(item.id)}">Retry Image</button>
      `;
      actions.querySelector('.retry-btn').addEventListener('click', () => retrySingleImage(item));
    }
  }
}

// Call Gemini 3 Pro Image API with Memory-Efficient Binary Decoding and Resilient Exponential Retries
async function callGeminiImageRestoration(file, signal = null) {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  // Resolve the aspect ratio to use for this specific image.
  // 'auto' = detect native dimensions from the file; explicit value = use as-is.
  let resolvedAspectRatio;
  if (state.aspectRatio === 'auto') {
    resolvedAspectRatio = await detectAspectRatio(file);
    console.info(`[Aspect Ratio] Auto-detected "${resolvedAspectRatio}" for ${file.name}`);
  } else {
    resolvedAspectRatio = state.aspectRatio;
  }

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
        imageSize: state.resolution,
        aspectRatio: resolvedAspectRatio
      }
    }
  };

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal && signal.aborted) {
      throw new DOMException('Restoration aborted by user', 'AbortError');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal || undefined
      });

      if (!response.ok) {
        let errMessage = `API Error ${response.status}`;
        try {
          const errText = await response.text();
          try {
            const errJson = JSON.parse(errText);
            if (errJson?.error?.message) {
              errMessage = errJson.error.message;
            } else if (errText) {
              errMessage += `: ${errText}`;
            }
          } catch (_) {
            if (errText) errMessage += `: ${errText}`;
          }
        } catch (_) {}

        // Retry on 429 (Rate Limit) and 5xx (Server/Overload Error)
        const isTransient = response.status === 429 || (response.status >= 500 && response.status < 600);
        if (isTransient && attempt < maxRetries) {
          const delay = (2 ** attempt) * 2000 + Math.random() * 1000;
          console.warn(`Gemini API returned ${response.status}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            if (signal) {
              signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Restoration aborted by user', 'AbortError'));
              }, { once: true });
            }
          });
          continue;
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
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err;
      }
      lastError = err;
      if (attempt < maxRetries && (err instanceof TypeError || err.message?.includes('fetch'))) {
        const delay = (2 ** attempt) * 2000 + Math.random() * 1000;
        console.warn(`Network error encountered (${err.message}). Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('Restoration aborted by user', 'AbortError'));
            }, { once: true });
          }
        });
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Image restoration failed after maximum retry attempts');
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

// Interactive In-Situ Comparison Slider with Aspect-Ratio-Safe Sync
// The before-frame (position:static) drives the container height naturally via
// its intrinsic aspect ratio. The after-frame (position:absolute) must be given
// explicit dimensions matching the container so object-fit:contain aligns
// identically for both images. We NEVER force a specific aspect ratio here.
function syncSliderDimensions() {
  const containerRect = el.sliderContainer.getBoundingClientRect();
  const imgRect = el.beforeImg.getBoundingClientRect();
  // Use the actual rendered before-image dimensions as the reference box.
  // If the image hasn't loaded yet, fall back to the container dimensions.
  const w = (imgRect.width > 4 ? imgRect.width : containerRect.width);
  const h = (imgRect.height > 4 ? imgRect.height : containerRect.height || w);
  if (w > 0) {
    el.afterImg.style.width = `${w}px`;
    el.afterImg.style.height = `${h}px`;
  }
}

function setSliderPosition(percentage) {
  const pos = Math.max(0, Math.min(100, percentage));
  el.afterWrapper.style.width = `${pos}%`;
  el.splitDivider.style.left = `${pos}%`;
  el.sliderContainer.setAttribute('aria-valuenow', Math.round(pos).toString());
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

  // Keyboard accessibility
  el.sliderContainer.addEventListener('keydown', (e) => {
    let currentPos = parseFloat(el.sliderContainer.getAttribute('aria-valuenow')) || 50;
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSliderPosition(Math.max(0, currentPos - step));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSliderPosition(Math.min(100, currentPos + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(100);
    }
  });

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

  // Update the aspect badge to reflect what was used for this image
  if (el.compareAspectBadge) {
    el.compareAspectBadge.textContent =
      state.aspectRatio === 'auto' ? 'Auto Aspect Preserved' : `Aspect: ${state.aspectRatio}`;
  }

  el.beforeImg.src = item.originalUrl;
  el.afterImg.src = item.restoredUrl;
  el.downloadRestoredBtn.href = item.restoredUrl;
  el.downloadRestoredBtn.download = `${item.file.name.replace(/\.[^/.]+$/, '')}_8K_restored.png`;

  openDialog(el.compareDialog);

  // Sync dimensions only after both images have loaded so the container
  // has settled into its final layout before the clip calculation runs.
  let loadedCount = 0;
  const onImageLoad = () => {
    loadedCount++;
    if (loadedCount >= 2) syncSliderDimensions();
  };
  el.beforeImg.onload = onImageLoad;
  el.afterImg.onload = onImageLoad;

  requestAnimationFrame(() => {
    syncSliderDimensions();
    setSliderPosition(50);
  });
}

// In-Browser Native Zero-Dependency ZIP Packaging (RFC 1951 / PKZip Spec Compliant)
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
    view.setUint16(6, 0x0800, true);     // flags (Bit 11: UTF-8)
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
    view.setUint16(8, 0x0800, true);     // flags (Bit 11: UTF-8)
    view.setUint16(10, 0, true);         // compression (store = 0)
    view.setUint16(12, dosTime, true);   // valid MS-DOS mod time
    view.setUint16(14, dosDate, true);   // valid MS-DOS mod date
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
    showToast('No restored images available to package into ZIP.', 'warning');
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
    showToast(`✓ ZIP archive created (${filesForZip.length} files).`, 'success', 3500);
  } catch (err) {
    console.error('ZIP generation error:', err);
    showToast('Could not package ZIP: ' + err.message, 'error');
  } finally {
    el.downloadZipBtn.disabled = false;
    el.downloadZipBtn.textContent = 'Download Restored ZIP';
  }
}
