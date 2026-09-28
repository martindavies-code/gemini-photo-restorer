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
  success: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="2,8 6,12 14,4"/></svg>',
  error:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="14" height="14"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>',
  warning: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M8 2L14.5 13H1.5Z"/><line x1="8" y1="7" x2="8" y2="10"/><line x1="8" y1="12" x2="8" y2="12.5"/></svg>',
  info:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="7" x2="8" y2="11.5"/><line x1="8" y1="5" x2="8" y2="5.5"/></svg>',
};

// 1x1 transparent SVG data URI to prevent unwanted browser root requests on empty src
const TRANSPARENT_SVG_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";

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
    <button type="button" class="toast-close" aria-label="Dismiss notification"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="11" height="11"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg></button>
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

// ─── Authentication Status Indicator (API Key or Vertex AI GCP Credits) ─────
function updateApiKeyStatus() {
  const isVertex = state.authMode === 'vertex';
  const hasAuth = isVertex
    ? Boolean(state.gcpProjectId && (state.vertexToken || state.gcpManualToken))
    : Boolean(state.apiKey);

  const pill   = document.getElementById('apiKeyStatus');
  const text   = document.getElementById('apiKeyStatusText');
  const banner = document.getElementById('onboardingBanner');
  const liveStatus = document.getElementById('apiKeyLiveStatus');

  if (pill) {
    pill.className = `api-key-pill ${hasAuth ? 'api-key-ok' : 'api-key-missing'}`;
    if (isVertex) {
      pill.title = hasAuth ? `Vertex AI (${state.gcpProjectId}) — GCP Credits Active` : 'Vertex AI unconfigured — click to set up';
      pill.setAttribute('aria-label', hasAuth ? 'Vertex AI configured with GCP credits. Click to open preferences.' : 'Vertex AI unconfigured. Click to open preferences.');
    } else {
      pill.title = hasAuth ? 'API key configured — click to change' : 'No API key — click to add one';
      pill.setAttribute('aria-label', hasAuth ? 'API key is configured. Click to open preferences.' : 'No API key set. Click to open preferences.');
    }
  }
  if (text) {
    if (isVertex) {
      text.textContent = hasAuth ? 'GCP Credits Active' : 'GCP Setup Needed';
    } else {
      text.textContent = hasAuth ? 'Key Connected' : 'No API Key';
    }
  }
  if (banner) {
    banner.style.display = (hasAuth || (isVertex && state.gcpProjectId)) ? 'none' : 'flex';
  }
  if (liveStatus) {
    liveStatus.textContent = hasAuth ? (isVertex ? 'GCP Credits Active' : 'Key saved') : '';
  }
}

function updateStartButtonState() {
  if (!el.startBatchBtn) return;
  const hasPending = state.filesQueue && state.filesQueue.some(i => i.status !== 'restored');
  el.startBatchBtn.disabled = state.isProcessing || !hasPending;
}

function isAuthConfigured() {
  if (state.authMode === 'vertex') {
    return Boolean(state.gcpProjectId && state.gcpProjectId.trim());
  }
  return Boolean(state.apiKey && state.apiKey.trim());
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
  const isVertex = typeof state !== 'undefined' && state.authMode === 'vertex';

  if ((msg.includes('daily') || msg.includes('per day')) && (msg.includes('quota') || msg.includes('exhausted') || msg.includes('limit')))
    return 'Daily API quota exhausted — resets tomorrow at midnight PT';
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted'))
    return isVertex
      ? 'Vertex AI rate limit hit — cooling down and retrying...'
      : 'Rate limit hit — cooling down and retrying...';
  if (msg.includes('401') || msg.includes('unauthenticated') || msg.includes('api key not valid') || msg.includes('api_key_invalid') || msg.includes('invalid api key'))
    return isVertex
      ? 'Google authorization expired — reconnect in Preferences'
      : 'Invalid API key — check Preferences';
  if (msg.includes('403') || msg.includes('permission_denied') || msg.includes('forbidden'))
    return isVertex
      ? 'Vertex AI permission denied — check GCP Project ID and IAM permissions'
      : 'API key lacks permission — check Google AI Studio';
  if (msg.includes('413') || (msg.includes('400') && msg.includes('payload')))
    return 'Payload too large — image optimized automatically';
  if (msg.includes('400') && (msg.includes('request') || msg.includes('invalid_argument')))
    return 'Bad request — image may be too large or model parameter unsupported';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed'))
    return 'Network error — check your connection';
  if (msg.includes('no image') || msg.includes('no_image') || msg.includes('finishreason') || msg.includes('safety'))
    return 'Model returned no image — try a different image or prompt';
  return err?.message || 'Restoration failed';
}

/**
 * Inspects HTTP response headers, Google RPC details, and error messages
 * to extract the server-requested retry delay in milliseconds.
 * Supports string delays ("30s"), numeric seconds (30), and object shapes ({ seconds: 30, nanos: 0 }).
 * Returns null if no specific delay was provided.
 */
function extractRetryDelayMs(response, errJson, errText) {
  // 1. Check HTTP Retry-After header
  if (response && response.headers && typeof response.headers.get === 'function') {
    const retryHeader = response.headers.get('retry-after');
    if (retryHeader) {
      const sec = parseInt(retryHeader, 10);
      if (!isNaN(sec) && sec > 0) {
        return (sec * 1000) + 1000; // Add 1s safety buffer
      }
      const dateMs = Date.parse(retryHeader);
      if (!isNaN(dateMs) && dateMs > Date.now()) {
        return (dateMs - Date.now()) + 1000;
      }
    }
  }

  // 2. Check Google RPC RetryInfo in error.details (supports string, number, and object shapes)
  if (errJson?.error?.details && Array.isArray(errJson.error.details)) {
    for (const detail of errJson.error.details) {
      const delayVal = detail.retryDelay || detail.retry_delay;
      if (delayVal) {
        if (typeof delayVal === 'object') {
          const s = Number(delayVal.seconds || 0);
          const n = Number(delayVal.nanos || 0);
          const totalSec = s + (n / 1e9);
          if (totalSec > 0 && totalSec < 3600) {
            return Math.round(totalSec * 1000) + 1000;
          }
        } else {
          const match = String(delayVal).match(/^(\d+(?:\.\d+)?)s?$/);
          if (match) {
            const sec = parseFloat(match[1]);
            if (!isNaN(sec) && sec > 0 && sec < 3600) {
              return Math.round(sec * 1000) + 1000;
            }
          }
        }
      }
    }
  }

  // 3. Regex search in error message/text (e.g. "please retry in 23.4s" or "after 30 seconds")
  const combined = `${errJson?.error?.message || ''} ${errText || ''}`;
  const match = combined.match(/(?:retry (?:after|in)|wait)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i);
  if (match) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0 && sec < 3600) {
      return Math.round(sec * 1000) + 1000;
    }
  }

  return null;
}

/**
 * Checks whether an error signifies that the project's daily quota is exhausted.
 * Daily quota cannot be fixed by waiting seconds or minutes.
 */
function isDailyQuotaExceeded(errJson, errText) {
  const combined = `${errJson?.error?.message || ''} ${errText || ''}`.toLowerCase();
  return (
    combined.includes('per day') ||
    combined.includes('requests per day') ||
    combined.includes('daily quota') ||
    combined.includes('exceeded your daily') ||
    combined.includes('quota_exceeded_daily')
  );
}

/**
 * Checks whether an API error is non-recoverable via retries (e.g., bad key, no permission).
 */
function isFatalApiError(status, errJson, errText) {
  const combined = `${errJson?.error?.message || ''} ${errText || ''}`.toLowerCase();
  const hasKey = combined.includes('api_key') || combined.includes('api key') || combined.includes('key');
  const isKeyInvalid = combined.includes('api_key_invalid') || combined.includes('not valid') || combined.includes('invalid') || combined.includes('revoked') || combined.includes('suspended');

  // Only treat as fatal if the key itself is explicitly rejected.
  if (status === 400 && hasKey && isKeyInvalid) return true;
  // In Vertex AI mode, a 401 token expiry is auto-refreshed and retried, not fatal!
  if (status === 401 && (typeof state === 'undefined' || state.authMode !== 'vertex')) return true;
  // 403 can mean quota block (retriable) or key suspended (fatal) — only flag fatal if key is explicitly mentioned
  if (status === 403 && (hasKey && isKeyInvalid || (combined.includes('permission_denied') && hasKey))) return true;
  return false;
}

/**
 * Asynchronous delay with live second-by-second countdown callbacks
 * and immediate, clean AbortSignal cancellation.
 */
function waitWithCountdown(delayMs, onTick = null, signal = null) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      return reject(new DOMException('Restoration aborted by user', 'AbortError'));
    }

    const totalSec = Math.max(1, Math.ceil(delayMs / 1000));
    let remainingSec = totalSec;

    if (onTick) onTick(remainingSec, totalSec);

    const intervalId = setInterval(() => {
      remainingSec--;
      if (remainingSec > 0) {
        if (onTick) onTick(remainingSec, totalSec);
      } else {
        cleanup();
        resolve();
      }
    }, 1000);

    const abortHandler = () => {
      cleanup();
      reject(new DOMException('Restoration aborted by user', 'AbortError'));
    };

    function cleanup() {
      clearInterval(intervalId);
      if (signal) signal.removeEventListener('abort', abortHandler);
    }

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
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

// Safe Storage wrapper (isomorphic: browser, worker, or test runner)
const safeStorage = {
  getItem: (key) => {
    try {
      return (typeof localStorage !== 'undefined' && localStorage) ? localStorage.getItem(key) : null;
    } catch (_) { return null; }
  },
  setItem: (key, val) => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(key, val);
    } catch (_) {}
  },
  removeItem: (key) => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) localStorage.removeItem(key);
    } catch (_) {}
  }
};

const getEl = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

// Application State
const state = {
  apiKey: sanitizeApiKey(safeStorage.getItem('lumina_api_key')),
  model: safeStorage.getItem('lumina_model') || 'gemini-3-pro-image',
  resolution: safeStorage.getItem('lumina_res') || '4K',
  aspectRatio: safeStorage.getItem('lumina_aspect') || 'auto',
  prompt: safeStorage.getItem('lumina_prompt') || DEFAULT_PROMPT,
  dirHandle: null,
  fullsizeHandle: null,
  filesQueue: [], // Array of { id, file, originalUrl, restoredUrl, restoredBlob, status, duration, error }
  isProcessing: false,
  shouldStop: false,
  activeAbortController: null,
  activeCompareItem: null,
  allocatedUrls: new Set(),
  rateLimitResetUntil: 0,
  consecutiveRateLimits: 0,
  // Vertex AI (OAuth mode)
  authMode: safeStorage.getItem('lumina_auth_mode') || 'apikey', // 'apikey' | 'vertex'
  gcpProjectId: safeStorage.getItem('lumina_gcp_project') || '',
  gcpRegion: safeStorage.getItem('lumina_gcp_region') || 'us-central1',
  gcpCustomClientId: safeStorage.getItem('lumina_gcp_client_id') || '',
  gcpManualToken: safeStorage.getItem('lumina_gcp_token') || '',
  vertexToken: null,       // Current OAuth access token
  vertexTokenExpiry: 0,    // Token expiry timestamp (ms)
  vertexUserEmail: null    // Signed-in email for display
};

// DOM Elements (dynamic getters provide safe access across browser lifecycle and Node test harnesses)
const el = {
  get step1() { return getEl('stepIndicator1'); },
  get step2() { return getEl('stepIndicator2'); },
  get step3() { return getEl('stepIndicator3'); },
  get pickFolderBtn() { return getEl('pickFolderBtn'); },
  get reopenFolderBtn() { return getEl('reopenFolderBtn'); },
  get pickFilesBtn() { return getEl('pickFilesBtn'); },
  get fallbackFolderInput() { return getEl('fallbackFolderInput'); },
  get fallbackFilesInput() { return getEl('fallbackFilesInput'); },
  get startBatchBtn() { return getEl('startBatchBtn'); },
  get stopBatchBtn() { return getEl('stopBatchBtn'); },
  get currentFolderLabel() { return getEl('currentFolderLabel'); },
  get outputFolderLabel() { return getEl('outputFolderLabel'); },
  get progressSection() { return getEl('progressSection'); },
  get progressText() { return getEl('progressText'); },
  get progressPercent() { return getEl('progressPercent'); },
  get progressBar() { return getEl('progressBar'); },
  get dropzoneContainer() { return getEl('dropzoneContainer'); },
  get dropzoneBox() { return getEl('dropzoneBox'); },
  get dropzoneFolderBtn() { return getEl('dropzoneFolderBtn'); },
  get queueSection() { return getEl('queueSection'); },
  get queueCount() { return getEl('queueCount'); },
  get galleryGrid() { return getEl('galleryGrid'); },
  get clearAllBtn() { return getEl('clearAllBtn'); },
  get retryFailedBtn() { return getEl('retryFailedBtn'); },
  get failedCount() { return getEl('failedCount'); },
  get downloadZipBtn() { return getEl('downloadZipBtn'); },
  get openSettingsBtn() { return getEl('openSettingsBtn'); },
  get settingsDialog() { return getEl('settingsDialog'); },
  get closeSettingsBtn() { return getEl('closeSettingsBtn'); },
  get saveSettingsBtn() { return getEl('saveSettingsBtn'); },
  get apiKeyInput() { return getEl('apiKeyInput'); },
  get modelSelect() { return getEl('modelSelect'); },
  get resolutionSelect() { return getEl('resolutionSelect'); },
  get aspectRatioSelect() { return getEl('aspectRatioSelect'); },
  get promptInput() { return getEl('promptInput'); },
  get resetPromptBtn() { return getEl('resetPromptBtn'); },
  get activeModelLabel() { return getEl('activeModelLabel'); },
  get compareDialog() { return getEl('compareDialog'); },
  get closeCompareBtn() { return getEl('closeCompareBtn'); },
  get compareFilename() { return getEl('compareFilename'); },
  get compareAspectBadge() { return getEl('compareAspectBadge'); },
  get beforeImg() { return getEl('beforeImg'); },
  get afterImg() { return getEl('afterImg'); },
  get afterWrapper() { return getEl('afterWrapper'); },
  get splitDivider() { return getEl('splitDivider'); },
  get sliderContainer() { return getEl('sliderContainer'); },
  get downloadRestoredBtn() { return getEl('downloadRestoredBtn'); },
  get apiKeyStatus() { return getEl('apiKeyStatus'); },
  get onboardingAddKeyBtn() { return getEl('onboardingAddKeyBtn'); },
  get dropzoneFilesBtn() { return getEl('dropzoneFilesBtn'); },
  get authTabApiKey() { return getEl('authTabApiKey'); },
  get authTabGoogle() { return getEl('authTabGoogle'); },
  get authPanelApiKey() { return getEl('authPanelApiKey'); },
  get authPanelVertex() { return getEl('authPanelVertex'); },
  get gcpProjectId() { return getEl('gcpProjectId'); },
  get gcpRegionSelect() { return getEl('gcpRegionSelect'); },
  get gcpClientIdInput() { return getEl('gcpClientIdInput'); },
  get gcpAccessTokenInput() { return getEl('gcpAccessTokenInput'); },
  get vertexAuthStatus() { return getEl('vertexAuthStatus'); },
  get vertexAuthStatusText() { return getEl('vertexAuthStatusText'); },
  get vertexSignInBtn() { return getEl('vertexSignInBtn'); },
  get vertexSignOutBtn() { return getEl('vertexSignOutBtn'); }
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
function initApp() {
  // 1. Setup all event listeners and UI controls immediately (synchronous)
  setupEventListeners();
  setupSplitSlider();
  setupDialogBackdropDismiss();

  // 2. Check for one-click setup via URL parameter (?key=...)
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

  // 3. Populate UI with saved settings
  if (el.apiKeyInput) el.apiKeyInput.value = state.apiKey;
  if (el.modelSelect) el.modelSelect.value = state.model;
  if (el.resolutionSelect) el.resolutionSelect.value = state.resolution;
  if (el.aspectRatioSelect) el.aspectRatioSelect.value = state.aspectRatio;
  if (el.promptInput) el.promptInput.value = state.prompt;
  if (el.gcpProjectId) el.gcpProjectId.value = state.gcpProjectId;
  if (el.gcpRegionSelect) el.gcpRegionSelect.value = state.gcpRegion;
  if (el.gcpClientIdInput) el.gcpClientIdInput.value = state.gcpCustomClientId;
  if (el.gcpAccessTokenInput) el.gcpAccessTokenInput.value = state.gcpManualToken;
  switchAuthMode(state.authMode);
  updateModelLabel();
  updateWorkflowStep();
  updateApiKeyStatus();
  updateStartButtonState();
  initGisTokenClient();

  // 4. API key show/hide toggle
  const toggleBtn = document.getElementById('toggleApiKeyBtn');
  if (toggleBtn && el.apiKeyInput) {
    toggleBtn.addEventListener('click', () => {
      const input = el.apiKeyInput;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      toggleBtn.setAttribute('aria-label', isHidden ? 'Hide API key' : 'Show API key');
    });
  }

  // 5. Restore saved folder handle in background
  getStoredDirectoryHandle().then(storedHandle => {
    if (storedHandle && el.reopenFolderBtn) {
      el.reopenFolderBtn.style.display = 'inline-flex';
      el.reopenFolderBtn.title = `Reopen previously chosen folder: ${storedHandle.name}`;
      const span = el.reopenFolderBtn.querySelector('span');
      if (span) span.textContent = `↺ Reopen ${storedHandle.name}`;
    }
  }).catch(() => {});

  // 6. Query local config in background (only when running on localhost)
  tryFetchLocalConfig().catch(() => {});

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupAllUrls);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

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
    // Restore focus when dialog is closed via Escape key or close()
    dialog.addEventListener('close', () => {
      if (dialog === el.compareDialog) {
        if (el.beforeImg) el.beforeImg.src = TRANSPARENT_SVG_PLACEHOLDER;
        if (el.afterImg) el.afterImg.src = TRANSPARENT_SVG_PLACEHOLDER;
        state.activeCompareItem = null;
      }
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
  if (el.pickFolderBtn) el.pickFolderBtn.addEventListener('click', handleFolderPick);
  if (el.reopenFolderBtn) el.reopenFolderBtn.addEventListener('click', reopenSavedFolder);
  if (el.dropzoneFolderBtn) el.dropzoneFolderBtn.addEventListener('click', handleFolderPick);
  if (el.dropzoneFilesBtn) el.dropzoneFilesBtn.addEventListener('click', () => el.fallbackFilesInput && el.fallbackFilesInput.click());
  if (el.pickFilesBtn) el.pickFilesBtn.addEventListener('click', () => el.fallbackFilesInput && el.fallbackFilesInput.click());

  // Clicking the dropzone card itself opens folder/file picker
  if (el.dropzoneBox) {
    el.dropzoneBox.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      handleFolderPick();
    });
    el.dropzoneBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('button')) return;
        e.preventDefault();
        handleFolderPick();
      }
    });
  }

  if (el.fallbackFolderInput) {
    el.fallbackFolderInput.addEventListener('change', (e) => {
      handleFallbackInput(e.target.files);
      e.target.value = '';
    });
  }
  if (el.fallbackFilesInput) {
    el.fallbackFilesInput.addEventListener('change', (e) => {
      handleFallbackInput(e.target.files);
      e.target.value = '';
    });
  }

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
  if (el.retryFailedBtn) el.retryFailedBtn.addEventListener('click', retryAllFailed);
  el.downloadZipBtn.addEventListener('click', handleDownloadAllZip);

  // Network resilience: notify user on connection changes
  window.addEventListener('offline', () => {
    showToast('Internet connection lost. Batch processing will pause if active.', 'warning', 6000);
  });
  window.addEventListener('online', () => {
    showToast('Internet connection restored.', 'success', 3500);
  });

  // Preferences
  if (el.authTabApiKey) {
    el.authTabApiKey.addEventListener('click', () => switchAuthMode('apikey'));
  }
  if (el.authTabGoogle) {
    el.authTabGoogle.addEventListener('click', () => switchAuthMode('vertex'));
  }
  if (el.vertexSignInBtn) {
    el.vertexSignInBtn.addEventListener('click', async () => {
      try {
        el.vertexSignInBtn.disabled = true;
        el.vertexSignInBtn.textContent = 'Connecting...';
        await getVertexToken(true);
        updateVertexAuthStatusUI();
        updateApiKeyStatus();
        showToast('Google account connected. GCP credits active.', 'success', 3500);
      } catch (err) {
        console.error('Google Sign-in error:', err);
        showToast('Google sign-in: ' + (err.message || err), 'error', 6000);
      } finally {
        el.vertexSignInBtn.disabled = false;
        updateVertexAuthStatusUI();
      }
    });
  }
  if (el.vertexSignOutBtn) {
    el.vertexSignOutBtn.addEventListener('click', () => {
      vertexSignOut();
      updateApiKeyStatus();
    });
  }

  el.openSettingsBtn.addEventListener('click', () => {
    el.apiKeyInput.value = state.apiKey;
    el.modelSelect.value = state.model;
    el.resolutionSelect.value = state.resolution;
    if (el.aspectRatioSelect) el.aspectRatioSelect.value = state.aspectRatio;
    el.promptInput.value = state.prompt;
    if (el.gcpProjectId) el.gcpProjectId.value = state.gcpProjectId;
    if (el.gcpRegionSelect) el.gcpRegionSelect.value = state.gcpRegion;
    if (el.gcpClientIdInput) el.gcpClientIdInput.value = state.gcpCustomClientId;
    if (el.gcpAccessTokenInput) el.gcpAccessTokenInput.value = state.gcpManualToken;
    switchAuthMode(state.authMode);
    openDialog(el.settingsDialog, el.openSettingsBtn);
  });
  el.closeSettingsBtn.addEventListener('click', () => closeDialog(el.settingsDialog));
  el.resetPromptBtn.addEventListener('click', () => { el.promptInput.value = DEFAULT_PROMPT; });
  el.saveSettingsBtn.addEventListener('click', () => {
    const previousKey = state.apiKey;
    const previousMode = state.authMode;
    const previousProject = state.gcpProjectId;

    state.apiKey = sanitizeApiKey(el.apiKeyInput.value);
    state.model = el.modelSelect.value;
    state.resolution = el.resolutionSelect.value;
    state.aspectRatio = el.aspectRatioSelect ? el.aspectRatioSelect.value : 'auto';
    state.prompt = el.promptInput.value.trim() || DEFAULT_PROMPT;

    if (el.gcpProjectId) state.gcpProjectId = el.gcpProjectId.value.trim();
    if (el.gcpRegionSelect) state.gcpRegion = el.gcpRegionSelect.value;
    if (el.gcpClientIdInput) state.gcpCustomClientId = el.gcpClientIdInput.value.trim();
    if (el.gcpAccessTokenInput) {
      state.gcpManualToken = el.gcpAccessTokenInput.value.trim();
      if (state.gcpManualToken) {
        state.vertexToken = state.gcpManualToken;
        state.vertexTokenExpiry = Date.now() + (3600 * 1000);
      }
    }

    // If the API key or Vertex auth changed, clear any lingering rate-limit state so the new setup
    // gets a completely fresh start. Old cooldowns from a different project/account
    // should never carry over to a newly entered key or project.
    if (state.apiKey !== previousKey || state.authMode !== previousMode || state.gcpProjectId !== previousProject) {
      state.rateLimitResetUntil = 0;
      state.consecutiveRateLimits = 0;
      console.info('[Settings] Auth credentials changed — rate-limit cooldown state cleared for fresh start.');
    }

    localStorage.setItem('lumina_api_key', state.apiKey);
    localStorage.setItem('lumina_model', state.model);
    localStorage.setItem('lumina_res', state.resolution);
    localStorage.setItem('lumina_aspect', state.aspectRatio);
    localStorage.setItem('lumina_prompt', state.prompt);
    localStorage.setItem('lumina_auth_mode', state.authMode);
    localStorage.setItem('lumina_gcp_project', state.gcpProjectId);
    localStorage.setItem('lumina_gcp_region', state.gcpRegion);
    localStorage.setItem('lumina_gcp_client_id', state.gcpCustomClientId);
    localStorage.setItem('lumina_gcp_token', state.gcpManualToken);

    updateModelLabel();
    updateApiKeyStatus();
    updateStartButtonState();
    closeDialog(el.settingsDialog);
    showToast(state.authMode === 'vertex'
      ? 'Preferences saved (Vertex AI mode with GCP credits).'
      : 'Preferences saved.', 'success', 2500);
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

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function loadDirectoryHandle(dirHandle) {
  state.dirHandle = dirHandle;
  await saveStoredDirectoryHandle(dirHandle);

  if (el.reopenFolderBtn) {
    el.reopenFolderBtn.style.display = 'none';
  }

  el.currentFolderLabel.textContent = dirHandle.name;
  el.outputFolderLabel.innerHTML = `Outputs will save directly to <mark>${dirHandle.name}/FULLSIZE/</mark>`;

  // Attempt to prepare FULLSIZE folder, gracefully falling back if read-only
  try {
    state.fullsizeHandle = await dirHandle.getDirectoryHandle('FULLSIZE', { create: true });
  } catch (e) {
    console.warn('FULLSIZE folder handle could not be prepared upfront (will use ZIP/PNG download):', e);
    state.fullsizeHandle = null;
    el.outputFolderLabel.innerHTML = `Outputs available for <mark>instant ZIP / PNG download</mark>`;
  }

  const files = [];
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (isImageFile(file.name)) {
          files.push(file);
        }
      }
    }
  } catch (err) {
    console.error('Error scanning folder entries:', err);
    showToast('Could not read directory contents: ' + err.message, 'error');
    return;
  }

  if (files.length === 0) {
    showToast(`No supported images found in "${dirHandle.name}". Please select a folder with JPG, PNG, or WebP files.`, 'warning', 5500);
    return;
  }

  addFilesToQueue(files);
  showToast(`Loaded ${files.length} photo${files.length !== 1 ? 's' : ''} from "${dirHandle.name}".`, 'success', 3500);
}

async function reopenSavedFolder() {
  const storedHandle = await getStoredDirectoryHandle();
  if (!storedHandle) return;
  try {
    if (!(await verifyHandlePermission(storedHandle, false))) {
      showToast('Permission to access previously chosen folder was not granted.', 'warning', 5000);
      return;
    }
    await loadDirectoryHandle(storedHandle);
  } catch (err) {
    console.error('Error reopening stored folder:', err);
    if (el.reopenFolderBtn) el.reopenFolderBtn.style.display = 'none';
  }
}

// Directory Picking via File System Access API with automatic multi-browser fallbacks
async function handleFolderPick() {
  // Mobile browsers (iOS, Android) do not support directory picking via webkitdirectory or File System API
  if (isMobileDevice()) {
    if (el.fallbackFilesInput) el.fallbackFilesInput.click();
    return;
  }

  if ('showDirectoryPicker' in window) {
    try {
      // NOTE: Open with default read access. Do NOT pass mode: 'readwrite' upfront,
      // as Chrome triggers security restrictions/cancellations on common folders like Downloads.
      const handle = await window.showDirectoryPicker();
      await loadDirectoryHandle(handle);
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User deliberately cancelled the folder dialog
        return;
      }
      console.warn('showDirectoryPicker failed or restricted:', err);
      showToast('Native folder picker could not be opened. Using file selector.', 'info', 4000);
      try {
        if (el.fallbackFolderInput) el.fallbackFolderInput.click();
      } catch (_) {
        if (el.fallbackFilesInput) el.fallbackFilesInput.click();
      }
      return;
    }
  }

  // Desktop browsers without showDirectoryPicker (Firefox, Safari)
  if (el.fallbackFolderInput) {
    el.fallbackFolderInput.click();
  } else if (el.fallbackFilesInput) {
    el.fallbackFilesInput.click();
  }
}

async function verifyHandlePermission(handle, readWrite = false) {
  const options = {};
  if (readWrite) options.mode = 'readwrite';
  try {
    if ((await handle.queryPermission(options)) === 'granted') return true;
    if ((await handle.requestPermission(options)) === 'granted') return true;
  } catch (_) {}
  return false;
}

function handleFallbackInput(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList).filter(f => isImageFile(f.name));
  if (files.length > 0) {
    const folderPath = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Selected Photos';
    el.currentFolderLabel.textContent = folderPath;
    el.outputFolderLabel.textContent = 'Outputs available for immediate PNG or ZIP download';
    addFilesToQueue(files);
    showToast(`Loaded ${files.length} photo${files.length !== 1 ? 's' : ''}.`, 'success', 3500);
  } else {
    showToast('No supported images found in the selection. Please choose JPG, PNG, or WebP files.', 'warning', 5000);
  }
}

async function handleFileDrop(e) {
  const items = e.dataTransfer.items;
  const files = [];

  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        if ('getAsFileSystemHandle' in item) {
          try {
            const handle = await item.getAsFileSystemHandle();
            if (handle && handle.kind === 'directory') {
              await loadDirectoryHandle(handle);
              return;
            }
          } catch (_) {}
        }
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
    el.currentFolderLabel.textContent = 'Imported Photos';
    el.outputFolderLabel.textContent = 'Outputs available for immediate PNG or ZIP download';
    addFilesToQueue(files);
    showToast(`Loaded ${files.length} photo${files.length !== 1 ? 's' : ''}.`, 'success', 3500);
  } else {
    showToast('No supported images were found in the dropped item.', 'warning', 5000);
  }
}

function isImageFile(filename) {
  return /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(filename);
}

// Queue Management
function addFilesToQueue(newFiles) {
  let skippedEmpty = 0;
  newFiles.forEach(file => {
    if (!file || file.size === 0) {
      skippedEmpty++;
      return;
    }
    const existing = state.filesQueue.find(item => item.file.name === file.name);
    if (!existing) {
      const item = {
        id: 'img_' + Math.random().toString(36).substr(2, 9),
        file: file,
        originalUrl: createManagedUrl(file),
        restoredUrl: null,
        restoredBlob: null,
        status: 'ready', // 'ready' | 'processing' | 'cooldown' | 'restored' | 'error'
        duration: null,
        error: null
      };
      state.filesQueue.push(item);
    }
  });

  if (skippedEmpty > 0) {
    showToast(`Skipped ${skippedEmpty} empty or unreadable (0-byte) file${skippedEmpty !== 1 ? 's' : ''}.`, 'info', 4000);
  }

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
    <span class="toast-icon" aria-hidden="true">${TOAST_ICONS.warning}</span>
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

  // 3. Append cards for new items in a single DocumentFragment batch to eliminate layout thrashing
  const fragment = document.createDocumentFragment();
  state.filesQueue.forEach(item => {
    const existing = el.galleryGrid.querySelector(`[data-item-id="${item.id}"]`);
    if (!existing) {
      const card = createCardElement(item);
      fragment.appendChild(card);
    }
  });
  if (fragment.childNodes.length > 0) {
    el.galleryGrid.appendChild(fragment);
  }

  const hasRestored = state.filesQueue.some(i => i.status === 'restored');
  el.downloadZipBtn.style.display = hasRestored ? 'inline-flex' : 'none';

  const errorCount = state.filesQueue.filter(i => i.status === 'error').length;
  if (el.retryFailedBtn) {
    if (errorCount > 0 && !state.isProcessing) {
      el.retryFailedBtn.style.display = 'inline-flex';
      if (el.failedCount) el.failedCount.textContent = errorCount;
    } else {
      el.retryFailedBtn.style.display = 'none';
    }
  }
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
  if (!isAuthConfigured()) {
    openDialog(el.settingsDialog, el.openSettingsBtn);
    showToast(state.authMode === 'vertex'
      ? 'Please enter your GCP Project ID in Preferences to use Vertex AI.'
      : 'Please add your Gemini API Key in Preferences to continue.', 'warning');
    return;
  }

  item.status = 'processing';
  item.error = null;
  updateCardStatus(item);

  const onCountdown = (sec) => {
    item.status = 'cooldown';
    updateCardStatus(item, `Cooling down (${sec}s)...`);
  };

  const t0 = performance.now();
  state.activeAbortController = new AbortController();
  try {
    const restoredBlob = await callGeminiImageRestoration(item.file, state.activeAbortController.signal, onCountdown);
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

function retryAllFailed() {
  if (state.isProcessing) return;
  const failedItems = state.filesQueue.filter(i => i.status === 'error');
  if (failedItems.length === 0) return;

  failedItems.forEach(item => {
    item.status = 'ready';
    item.error = null;
    updateCardStatus(item);
  });

  renderQueue();
  startBatchProcessing();
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
  if (!isAuthConfigured()) {
    openDialog(el.settingsDialog, el.openSettingsBtn);
    showToast(state.authMode === 'vertex'
      ? 'Please enter your GCP Project ID in Preferences to use Vertex AI.'
      : 'Please add your Gemini API Key in Preferences to continue.', 'warning');
    return;
  }

  // For Vertex AI mode, ensure we have an active token or prompt sign-in before batch loop begins
  if (state.authMode === 'vertex') {
    try {
      await getVertexToken();
    } catch (err) {
      openDialog(el.settingsDialog, el.openSettingsBtn);
      showToast('Google authentication required: ' + (err.message || err), 'error', 6000);
      return;
    }
  }

  state.isProcessing = true;
  state.shouldStop = false;
  state.activeAbortController = null;
  batchStartTime = performance.now();
  // Always start each batch with a clean rate-limit slate.
  // If an old cooldown was set from a previous batch, it should never block
  // a fresh batch that the user explicitly started.
  state.rateLimitResetUntil = 0;
  state.consecutiveRateLimits = 0;
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

    // 1. Pacing check: if a previous item hit a rate limit, wait until cooldown expires
    if (Date.now() < state.rateLimitResetUntil) {
      const waitTime = state.rateLimitResetUntil - Date.now();
      await waitWithCountdown(waitTime, (sec) => {
        updateProgress(processed, total, `Respecting rate limit · pacing next image in ${sec}s...`, batchStartTime);
      }, state.activeAbortController?.signal);
    }
    if (state.shouldStop) break;

    item.status = 'processing';
    updateCardStatus(item);
    const progressMsg = `Restoring [${i + 1} of ${total}] ${item.file.name}...`;
    updateProgress(processed, total, progressMsg, batchStartTime);
    announceToScreenReader(progressMsg);

    const onCountdown = (sec) => {
      item.status = 'cooldown';
      updateCardStatus(item, `Cooling down (${sec}s)...`);
      updateProgress(processed, total, `Rate limit active · pacing request in ${sec}s (${item.file.name})...`, batchStartTime);
      announceToScreenReader(`Rate limit cooldown. Waiting ${sec} seconds.`);
    };

    const t0 = performance.now();
    state.activeAbortController = new AbortController();
    try {
      const restoredBlob = await callGeminiImageRestoration(item.file, state.activeAbortController.signal, onCountdown);
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

      // If fatal API error or daily quota exceeded, stop the batch immediately!
      const errLower = (err.message || '').toLowerCase();
      if (errLower.includes('daily') || errLower.includes('fatal') || errLower.includes('invalid api key') || errLower.includes('api_key_invalid')) {
        showToast(item.error, 'error', 7000);
        state.shouldStop = true;
        updateCardStatus(item);
        break;
      }
    } finally {
      state.activeAbortController = null;
    }

    processed++;
    updateCardStatus(item);
    updateProgress(processed, total, `Finished ${item.file.name}`, batchStartTime);

    if (state.shouldStop) break;

    // Adaptive buffer between batch items to prevent cascading rate limit hits
    const spacingMs = (state.consecutiveRateLimits > 0) ? 3500 : 1200;
    await waitWithCountdown(spacingMs, null, state.activeAbortController?.signal);
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
  renderQueue(); // refresh ZIP button and retry failed button visibility
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

function updateCardStatus(item, customMetricText = null) {
  const card = document.getElementById(`card_${item.id}`);
  if (!card) return;

  card.className = `card-item status-${item.status}`;
  const badge = card.querySelector('.status-badge');
  if (badge) {
    badge.className = `status-badge badge-${item.status}`;
    badge.textContent = item.status === 'restored' ? 'RESTORED' : item.status.toUpperCase();
  }

  if (item.status === 'cooldown') {
    const metricsDiv = card.querySelector('.card-metrics');
    if (metricsDiv) {
      const text = customMetricText || 'Rate limit cooldown...';
      metricsDiv.innerHTML = `
        <span class="warning-msg" style="color: var(--warn); font-weight: 600;">${escapeHtml(text)}</span>
        <span>Cooldown</span>
      `;
    }
  } else if (item.status === 'restored') {
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

/**
 * Hyper-efficient image payload optimizer.
 * Prevents client-side network bottlenecks and eliminates HTTP 400 "Request payload size exceeds limit" (20MB ceiling).
 * - Files <= 3.5MB with dimensions <= 3072px are sent directly without re-compression (byte-perfect preservation).
 * - Oversized files (>3.5MB or >3072px) are scaled via in-memory bicubic canvas to max 3072px at 0.94 JPEG quality,
 *   reducing payloads from 20-50MB down to ~1.2-2.0MB with zero perceptible quality loss.
 */
async function prepareImagePayload(file, signal = null) {
  if (signal && signal.aborted) {
    throw new DOMException('Restoration aborted by user', 'AbortError');
  }

  const MAX_DIMENSION = 3072;
  const SIZE_THRESHOLD_BYTES = 3.5 * 1024 * 1024; // 3.5MB

  let needsOptimization = file.size > SIZE_THRESHOLD_BYTES;
  let width = 0;
  let height = 0;
  let bitmap = null;

  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
      } catch (_) {
        bitmap = null;
      }
    }

    if (!width || !height) {
      try {
        const dims = await new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            const res = { width: img.naturalWidth, height: img.naturalHeight };
            URL.revokeObjectURL(url);
            resolve(res);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to decode image'));
          };
          img.src = url;
        });
        width = dims.width;
        height = dims.height;
      } catch (e) {
        console.warn('Could not inspect image dimensions, passing directly:', e);
        const base64Data = await fileToBase64(file);
        return { base64Data, mimeType: file.type || 'image/jpeg' };
      }
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      needsOptimization = true;
    }

    if (!needsOptimization) {
      if (bitmap) {
        try { bitmap.close(); } catch (_) {}
        bitmap = null;
      }
      const base64Data = await fileToBase64(file);
      return { base64Data, mimeType: file.type || 'image/jpeg' };
    }

    const maxSide = Math.max(width, height);
    const scale = maxSide > MAX_DIMENSION ? (MAX_DIMENSION / maxSide) : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        bitmap.close();
        bitmap = null;
      } else {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          const url = URL.createObjectURL(file);
          image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed for canvas'));
          };
          image.src = url;
        });
        ctx.drawImage(img, 0, 0, targetW, targetH);
      }

      const optimizedBlob = await new Promise((resolve) => {
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.94);
      });

      if (optimizedBlob) {
        const base64Data = await fileToBase64(optimizedBlob);
        console.info(`[Optimizer] Compressed ${file.name} from ${(file.size / 1024 / 1024).toFixed(1)}MB down to ${(optimizedBlob.size / 1024 / 1024).toFixed(2)}MB (${targetW}x${targetH})`);
        return { base64Data, mimeType: 'image/jpeg' };
      }
    } catch (err) {
      console.warn('[Optimizer] Canvas scaling failed, falling back to original file:', err);
    }

    const base64Data = await fileToBase64(file);
    return { base64Data, mimeType: file.type || 'image/jpeg' };
  } finally {
    if (bitmap) {
      try { bitmap.close(); } catch (_) {}
    }
  }
}

// Call Gemini 3 Pro Image API with Memory-Efficient Binary Decoding,
// Smart Canvas Pre-Compression, and Resilient Rate-Limit Navigation
async function callGeminiImageRestoration(file, signal = null, onCountdownTick = null) {
  const { base64Data, mimeType } = await prepareImagePayload(file, signal);

  // Resolve the aspect ratio to use for this specific image.
  // 'auto' = detect native dimensions from the file; explicit value = use as-is.
  let resolvedAspectRatio;
  if (state.aspectRatio === 'auto') {
    resolvedAspectRatio = await detectAspectRatio(file);
    console.info(`[Aspect Ratio] Auto-detected "${resolvedAspectRatio}" for ${file.name}`);
  } else {
    resolvedAspectRatio = state.aspectRatio;
  }

  // Endpoint + headers built by auth module (supports both API key and Vertex AI OAuth)
  const endpoint = buildApiEndpoint();

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

  const maxRetries = 5;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal && signal.aborted) {
      throw new DOMException('Restoration aborted by user', 'AbortError');
    }

    try {
      const headers = await buildApiHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: signal || undefined
      });

      if (!response.ok) {
        let errMessage = `API Error ${response.status}`;
        let errText = '';
        let errJson = null;

        try {
          errText = await response.text();
          try {
            errJson = JSON.parse(errText);
            if (errJson?.error?.message) {
              errMessage = errJson.error.message;
            } else if (errText) {
              errMessage += `: ${errText}`;
            }
          } catch (_) {
            if (errText) errMessage += `: ${errText}`;
          }
        } catch (_) {}

        // In Vertex AI mode, if 401 is received, try refreshing the OAuth token once
        if (state.authMode === 'vertex' && response.status === 401 && attempt < maxRetries) {
          console.warn('[Vertex AI] Token expired or invalid (401). Forcing token refresh and retrying...');
          state.vertexToken = null;
          state.vertexTokenExpiry = 0;
          continue;
        }

        // 1. Fatal unrecoverable errors (invalid key, forbidden, suspended)
        if (isFatalApiError(response.status, errJson, errText)) {
          throw new Error(`Fatal API Error (${response.status}): ${errMessage}`);
        }

        // 2. Permanent daily quota exhaustion (resets at midnight PT, waiting seconds won't help)
        if (isDailyQuotaExceeded(errJson, errText)) {
          throw new Error(`Daily API quota exceeded for your project (resets at midnight PT). Please check Google AI Studio or use a different key.`);
        }

        // 3. Transient rate-limit (429) or temporary server errors (5xx)
        const isTransient = response.status === 429 || (response.status >= 500 && response.status < 600);
        if (isTransient && attempt < maxRetries) {
          state.consecutiveRateLimits = (state.consecutiveRateLimits || 0) + 1;

          // Determine exact wait delay from headers or server error details
          let delayMs = extractRetryDelayMs(response, errJson, errText);
          if (!delayMs) {
            // Jittered exponential backoff: 3s, 6s, 12s, 24s, 48s + 0-2s jitter
            delayMs = (2 ** attempt) * 3000 + Math.floor(Math.random() * 2000);
          }
          delayMs = Math.max(2000, Math.min(90000, delayMs));

          // Set shared cooldown memory for subsequent images in the batch
          state.rateLimitResetUntil = Date.now() + delayMs + 3000;

          console.warn(`Gemini API returned ${response.status}. Cooling down for ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})...`);

          await waitWithCountdown(delayMs, (sec, total) => {
            if (onCountdownTick) onCountdownTick(sec, total, response.status);
          }, signal);

          continue;
        }

        throw new Error(errMessage);
      }

      // Success! Decrement consecutive rate limits count
      if (state.consecutiveRateLimits > 0) {
        state.consecutiveRateLimits = Math.max(0, state.consecutiveRateLimits - 1);
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

      // Handle transient network drops
      const isNetworkError = err instanceof TypeError || err.message?.includes('fetch') || err.message?.includes('network');
      if (attempt < maxRetries && isNetworkError) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('Network offline, waiting for reconnection...');
          try {
            await new Promise((resolve, reject) => {
              const onOnline = () => {
                window.removeEventListener('online', onOnline);
                clearTimeout(offlineTimer);
                resolve();
              };
              const offlineTimer = setTimeout(() => {
                window.removeEventListener('online', onOnline);
                reject(new Error('Network offline — connection timed out'));
              }, 45000);
              window.addEventListener('online', onOnline, { once: true });
              if (signal) {
                signal.addEventListener('abort', () => {
                  window.removeEventListener('online', onOnline);
                  clearTimeout(offlineTimer);
                  reject(new DOMException('Restoration aborted by user', 'AbortError'));
                }, { once: true });
              }
            });
          } catch (offlineErr) {
            throw offlineErr;
          }
        }

        const delay = (2 ** attempt) * 2500 + Math.random() * 1500;
        console.warn(`Network error encountered (${err.message}). Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await waitWithCountdown(delay, (sec, total) => {
          if (onCountdownTick) onCountdownTick(sec, total, 'Network');
        }, signal);
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
  const rounded = Math.round(pos);
  el.sliderContainer.setAttribute('aria-valuenow', rounded.toString());
  el.sliderContainer.setAttribute('aria-valuetext', `${rounded}% comparison`);
}

function setupSplitSlider() {
  let isDragging = false;
  let cachedRect = null;
  let rafId = null;
  let targetX = 0;

  const performUpdate = () => {
    rafId = null;
    if (!isDragging) return;
    if (!cachedRect || cachedRect.width <= 0) {
      cachedRect = el.sliderContainer.getBoundingClientRect();
    }
    if (cachedRect && cachedRect.width > 0) {
      const pos = ((targetX - cachedRect.left) / cachedRect.width) * 100;
      setSliderPosition(pos);
    }
  };

  const scheduleMove = (clientX) => {
    targetX = clientX;
    if (rafId === null) {
      rafId = requestAnimationFrame(performUpdate);
    }
  };

  // Pointer Events API: unified, high-performance handling across mouse, touch, and stylus
  el.sliderContainer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // Primary button only
    isDragging = true;
    cachedRect = el.sliderContainer.getBoundingClientRect();
    try {
      el.sliderContainer.setPointerCapture(e.pointerId);
    } catch (_) {}
    scheduleMove(e.clientX);
  });

  el.sliderContainer.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    scheduleMove(e.clientX);
  });

  const stopDragging = (e) => {
    if (isDragging) {
      isDragging = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      try {
        el.sliderContainer.releasePointerCapture(e.pointerId);
      } catch (_) {}
      cachedRect = null;
    }
  };

  el.sliderContainer.addEventListener('pointerup', stopDragging);
  el.sliderContainer.addEventListener('pointercancel', stopDragging);

  // Keyboard accessibility per W3C Slider Pattern
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
        cachedRect = null;
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

  const checkAndSync = () => {
    syncSliderDimensions();
    setSliderPosition(50);
  };

  // If already cached or immediately ready, sync on next paint
  if (el.beforeImg.complete && el.afterImg.complete && el.beforeImg.naturalWidth > 0 && el.afterImg.naturalWidth > 0) {
    requestAnimationFrame(checkAndSync);
  } else {
    let loadedCount = 0;
    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        requestAnimationFrame(checkAndSync);
      }
    };
    el.beforeImg.onload = onImageLoad;
    el.afterImg.onload = onImageLoad;
  }

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
    let cleanName = (file.name || 'restored_image.png')
      .replace(/[\x00-\x1f\x7f]/g, '')
      .replace(/^(\.\.[\/\\])+/, '')
      .replace(/[\/\\]+/g, '_')
      .trim();
    if (!cleanName) cleanName = 'restored_image.png';

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


// ============================================================
// VERTEX AI OAuth MODULE
// Uses GCP free-trial credits via Google Identity Services or Direct Token.
// Endpoint: aiplatform.googleapis.com (not generativelanguage)
// Auth: OAuth2 Bearer token with cloud-platform scope
// ============================================================

// Default OAuth Client ID for Google Identity Services.
// Users can also specify their own custom Web OAuth Client ID in Preferences.
const OAUTH_CLIENT_ID = '668489071994-kud4nqqmsc9m14k0j0gs0ij5cr3rj8ma.apps.googleusercontent.com';

let _tokenClient = null;
let _pendingTokenResolve = null;
let _pendingTokenReject = null;

/**
 * Initialise the GIS token client once GIS has loaded.
 * Safe to call multiple times - reinitialises if client ID changes.
 */
function initGisTokenClient() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) return;
  const activeClientId = (state.gcpCustomClientId && state.gcpCustomClientId.trim()) || OAUTH_CLIENT_ID;

  try {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: activeClientId,
      scope: 'https://www.googleapis.com/auth/cloud-platform openid email',
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          const errMsg = tokenResponse.error_description || tokenResponse.error;
          if (_pendingTokenReject) _pendingTokenReject(new Error(errMsg));
          _pendingTokenReject = null;
          _pendingTokenResolve = null;
          return;
        }
        // Token valid for 1 hour (expires_in usually 3600 seconds)
        state.vertexToken = tokenResponse.access_token;
        const expiresInSec = parseInt(tokenResponse.expires_in, 10) || 3600;
        state.vertexTokenExpiry = Date.now() + (expiresInSec * 1000) - 60000; // 1min safety buffer
        if (_pendingTokenResolve) _pendingTokenResolve(tokenResponse.access_token);
        _pendingTokenResolve = null;
        _pendingTokenReject = null;

        updateVertexAuthStatusUI();
        updateApiKeyStatus();
        fetchGoogleUserInfo(tokenResponse.access_token);
      }
    });
  } catch (err) {
    console.warn('[Vertex AI] Could not initialize GIS token client:', err);
  }
}

/**
 * Get a valid Vertex AI OAuth token.
 * 1. Returns direct access token if entered manually.
 * 2. Returns cached OAuth token if still valid.
 * 3. Requests a fresh token from Google Identity Services.
 */
async function getVertexToken(forcePrompt = false) {
  // If direct access token was pasted (e.g. from gcloud auth print-access-token), use it!
  if (state.gcpManualToken && state.gcpManualToken.trim()) {
    return state.gcpManualToken.trim();
  }

  // Return cached GIS token if still valid
  if (!forcePrompt && state.vertexToken && Date.now() < state.vertexTokenExpiry) {
    return state.vertexToken;
  }

  initGisTokenClient();
  if (!_tokenClient) {
    throw new Error('Google Identity Services not ready. Either sign in with Google or paste a token from "gcloud auth print-access-token" in Preferences.');
  }

  // Request a new token (prompts user consent/popup if needed)
  return new Promise((resolve, reject) => {
    _pendingTokenResolve = resolve;
    _pendingTokenReject = reject;
    try {
      _tokenClient.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
    } catch (err) {
      _pendingTokenResolve = null;
      _pendingTokenReject = null;
      reject(err);
    }
  });
}

/**
 * Fetch signed-in user's email for the UI status text.
 */
async function fetchGoogleUserInfo(token) {
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      state.vertexUserEmail = data.email || null;
      updateVertexAuthStatusUI();
    }
  } catch (_) { /* non-critical display helper */ }
}

/**
 * Update the Vertex auth panel UI to reflect current sign-in state.
 */
function updateVertexAuthStatusUI() {
  const statusEl = document.getElementById('vertexAuthStatus');
  const textEl = document.getElementById('vertexAuthStatusText');
  const signInBtn = document.getElementById('vertexSignInBtn');
  const signOutBtn = document.getElementById('vertexSignOutBtn');
  if (!statusEl) return;

  const hasManualToken = Boolean(state.gcpManualToken && state.gcpManualToken.trim());
  const hasGisToken = Boolean(state.vertexToken && Date.now() < state.vertexTokenExpiry);
  const isSignedIn = hasManualToken || hasGisToken;

  statusEl.className = `vertex-auth-status ${isSignedIn ? 'vertex-auth-signed-in' : 'vertex-auth-signed-out'}`;
  if (textEl) {
    if (hasManualToken) {
      textEl.textContent = 'Direct Token Connected';
    } else if (hasGisToken) {
      textEl.textContent = state.vertexUserEmail ? `Signed in (${state.vertexUserEmail})` : 'Google Account Connected';
    } else {
      textEl.textContent = 'Not signed in';
    }
  }
  if (signInBtn) signInBtn.style.display = isSignedIn ? 'none' : 'inline-flex';
  if (signOutBtn) signOutBtn.style.display = isSignedIn ? 'inline-flex' : 'none';
}

/**
 * Sign the user out of Vertex AI mode.
 */
function vertexSignOut() {
  if (state.vertexToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    try {
      google.accounts.oauth2.revoke(state.vertexToken, () => {});
    } catch (_) {}
  }
  state.vertexToken = null;
  state.vertexTokenExpiry = 0;
  state.vertexUserEmail = null;
  state.gcpManualToken = '';
  if (el.gcpAccessTokenInput) el.gcpAccessTokenInput.value = '';
  localStorage.removeItem('lumina_gcp_token');
  updateVertexAuthStatusUI();
  updateApiKeyStatus();
  showToast('Signed out of Vertex AI.', 'info', 2500);
}

/**
 * Build the correct API endpoint URL based on current auth mode.
 * - apikey mode: standard generativelanguage.googleapis.com with ?key=
 * - vertex mode: Vertex AI aiplatform.googleapis.com with Bearer token
 */
function buildApiEndpoint() {
  if (state.authMode === 'vertex') {
    const project = (state.gcpProjectId || '').trim();
    const region = state.gcpRegion || 'us-central1';
    if (!project) throw new Error('GCP Project ID is required for Vertex AI mode. Set it in Preferences.');
    return `https://${region}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${region}/publishers/google/models/${encodeURIComponent(state.model)}:generateContent`;
  }
  // Default: Gemini API with API key
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(state.model)}:generateContent?key=${encodeURIComponent(state.apiKey)}`;
}

/**
 * Build the fetch headers based on auth mode.
 * Vertex AI needs a Bearer token; API key mode uses no auth header (key is in URL).
 */
async function buildApiHeaders() {
  if (state.authMode === 'vertex') {
    const token = await getVertexToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }
  return { 'Content-Type': 'application/json' };
}

/**
 * Toggle auth mode panels in the preferences dialog.
 */
function switchAuthMode(mode) {
  const apiPanel = document.getElementById('authPanelApiKey');
  const vertexPanel = document.getElementById('authPanelVertex');
  const apiTab = document.getElementById('authTabApiKey');
  const googleTab = document.getElementById('authTabGoogle');

  if (apiPanel) apiPanel.style.display = mode === 'apikey' ? '' : 'none';
  if (vertexPanel) vertexPanel.style.display = mode === 'vertex' ? '' : 'none';
  if (apiTab) {
    apiTab.classList.toggle('auth-tab-active', mode === 'apikey');
    apiTab.setAttribute('aria-selected', String(mode === 'apikey'));
  }
  if (googleTab) {
    googleTab.classList.toggle('auth-tab-active', mode === 'vertex');
    googleTab.setAttribute('aria-selected', String(mode === 'vertex'));
  }

  state.authMode = mode;
  if (mode === 'vertex') updateVertexAuthStatusUI();
  updateApiKeyStatus();
}

// Export helpers for unit testing if running in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildApiEndpoint,
    buildApiHeaders,
    isAuthConfigured,
    switchAuthMode,
    parseGeminiError,
    extractRetryDelayMs,
    isDailyQuotaExceeded,
    isFatalApiError,
    sanitizeApiKey,
    escapeHtml,
    calculateCrc32,
    createZipBlob,
    GEMINI_ASPECT_RATIOS,
    state
  };
}