/**
 * Atelier 8K - Client Engine Test Suite (Node.js native test runner)
 * Tests binary algorithms, PKZip engine, CRC32, Base64 decoding, and slider mathematics.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// CRC-32 Table & Calculator (matching app.js)
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

// In-Browser Native Zero-Dependency ZIP Packaging Engine
function createZipUint8Array(files) {
  const fileRecords = [];
  let offset = 0;
  const parts = [];
  const textEncoder = new TextEncoder();

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
    const dataBytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local header signature
    view.setUint16(4, 20, true);         // Version needed
    view.setUint16(6, 0x0800, true);     // General purpose flag: Bit 11 set for UTF-8!
    view.setUint16(8, 0, true);          // Compression (Store = 0)
    view.setUint16(10, dosTime, true);   // MS-DOS Mod Time
    view.setUint16(12, dosDate, true);   // MS-DOS Mod Date
    view.setUint32(14, crc, true);       // CRC-32
    view.setUint32(18, size, true);      // Compressed Size
    view.setUint32(22, size, true);      // Uncompressed Size
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);         // Extra field length
    localHeader.set(nameBytes, 30);

    fileRecords.push({ nameBytes, crc, size, offset });
    offset += localHeader.length + size;

    parts.push(localHeader);
    parts.push(dataBytes);
  }

  const centralDirStart = offset;
  let centralDirSize = 0;

  for (const record of fileRecords) {
    const cdHeader = new Uint8Array(46 + record.nameBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // Central directory signature
    view.setUint16(4, 20, true);         // Version made by
    view.setUint16(6, 20, true);         // Version needed
    view.setUint16(8, 0x0800, true);     // Bit 11 UTF-8
    view.setUint16(10, 0, true);         // Compression (Store = 0)
    view.setUint16(12, dosTime, true);   // Mod Time
    view.setUint16(14, dosDate, true);   // Mod Date
    view.setUint32(16, record.crc, true);// CRC-32
    view.setUint32(20, record.size, true);// Compressed Size
    view.setUint32(24, record.size, true);// Uncompressed Size
    view.setUint16(28, record.nameBytes.length, true);
    view.setUint16(30, 0, true);         // Extra field length
    view.setUint16(32, 0, true);         // Comment length
    view.setUint16(34, 0, true);         // Disk start
    view.setUint16(36, 0, true);         // Internal attributes
    view.setUint32(38, 0, true);         // External attributes
    view.setUint32(42, record.offset, true); // Relative offset
    cdHeader.set(record.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true);                  // Disk number
  eocdView.setUint16(6, 0, true);                  // Start disk
  eocdView.setUint16(8, fileRecords.length, true); // Total entries on disk
  eocdView.setUint16(10, fileRecords.length, true);// Total entries
  eocdView.setUint32(12, centralDirSize, true);    // Size of CD
  eocdView.setUint32(16, centralDirStart, true);   // Offset of CD
  eocdView.setUint16(20, 0, true);                 // Comment length

  parts.push(eocd);

  // Combine into single Uint8Array
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of parts) {
    combined.set(part, pos);
    pos += part.length;
  }
  return combined;
}

// Memory-efficient Base64 binary decoding
function decodeBase64ToBytes(base64Str) {
  const binaryStr = atob(base64Str);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

test('CRC32 standard RFC test vector validation', () => {
  const vector = new TextEncoder().encode('123456789');
  const crc = calculateCrc32(vector);
  // Standard CRC-32 test vector for '123456789' is 0xcbf43926
  assert.equal(crc, 0xcbf43926);
});

test('PKZip engine creates valid ZIP binary structure', () => {
  const files = [
    { name: 'photo1.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
    { name: 'portrait_ñ.png', data: new Uint8Array([1, 2, 3, 4, 5]) }
  ];

  const zipBytes = createZipUint8Array(files);
  const view = new DataView(zipBytes.buffer);

  // Verify first local file header signature
  assert.equal(view.getUint32(0, true), 0x04034b50);

  // Find End of Central Directory signature (0x06054b50) at the end
  const eocdOffset = zipBytes.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);

  // Verify entry count in EOCD
  assert.equal(view.getUint16(eocdOffset + 8, true), 2);
  assert.equal(view.getUint16(eocdOffset + 10, true), 2);
});

test('PKZip engine sanitizes path traversal attacks and deduplicates colliding names', () => {
  const files = [
    { name: '../../etc/passwd', data: new Uint8Array([1, 2, 3]) },
    { name: 'sample.png', data: new Uint8Array([10]) },
    { name: 'sample.png', data: new Uint8Array([20]) },
    { name: 'sample.png', data: new Uint8Array([30]) }
  ];

  const zipBytes = createZipUint8Array(files);
  const zipText = new TextDecoder('utf-8').decode(zipBytes);

  // Traversal dots and slashes must be stripped
  assert.ok(!zipText.includes('../../etc/passwd'));
  assert.ok(zipText.includes('etc_passwd'));

  // Colliding names must be deduplicated
  assert.ok(zipText.includes('sample.png'));
  assert.ok(zipText.includes('sample_1.png'));
  assert.ok(zipText.includes('sample_2.png'));
});

test('Base64 memory-efficient byte decoding', () => {
  const originalBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 255]);
  const base64Str = btoa(String.fromCharCode(...originalBytes));

  const decoded = decodeBase64ToBytes(base64Str);
  assert.deepEqual(decoded, originalBytes);
});

test('Slider coordinate clamping and precision', () => {
  function clampSlider(percentage) {
    return Math.max(0, Math.min(100, percentage));
  }

  assert.equal(clampSlider(-50), 0);
  assert.equal(clampSlider(150), 100);
  assert.equal(clampSlider(50.456), 50.456);
  assert.equal(clampSlider(0), 0);
  assert.equal(clampSlider(100), 100);
});

test('PKZip engine sets Bit 11 UTF-8 flag and valid Central Directory offsets', () => {
  const files = [
    { name: 'test_image.png', data: new Uint8Array([1, 2, 3, 4]) }
  ];

  const zipBytes = createZipUint8Array(files);
  const view = new DataView(zipBytes.buffer);

  // Local header flag at offset 6 must have bit 11 (0x0800) set
  const localFlag = view.getUint16(6, true);
  assert.equal(localFlag & 0x0800, 0x0800, 'Local header Bit 11 must be set for UTF-8');

  // Find Central Directory signature (0x02014b50)
  let cdOffset = -1;
  for (let i = 0; i < zipBytes.length - 4; i++) {
    if (view.getUint32(i, true) === 0x02014b50) {
      cdOffset = i;
      break;
    }
  }
  assert.ok(cdOffset > 0, 'Central directory header must exist');

  // Central directory flag at offset 8 must have bit 11 (0x0800) set
  const cdFlag = view.getUint16(cdOffset + 8, true);
  assert.equal(cdFlag & 0x0800, 0x0800, 'Central directory Bit 11 must be set for UTF-8');

  // Compression at offset 10 must be 0 (Store)
  assert.equal(view.getUint16(cdOffset + 10, true), 0);

  // CRC-32 at offset 16 must match file CRC
  const expectedCrc = calculateCrc32(files[0].data);
  assert.equal(view.getUint32(cdOffset + 16, true), expectedCrc);
});

test('Keyboard slider navigation steps with Shift and Home/End bounds', () => {
  function handleKeyboardStep(current, key, shiftKey) {
    const step = shiftKey ? 10 : 2;
    if (key === 'ArrowLeft' || key === 'ArrowDown') {
      return Math.max(0, current - step);
    }
    if (key === 'ArrowRight' || key === 'ArrowUp') {
      return Math.min(100, current + step);
    }
    if (key === 'Home') return 0;
    if (key === 'End') return 100;
    return current;
  }

  // Normal arrow navigation
  assert.equal(handleKeyboardStep(50, 'ArrowLeft', false), 48);
  assert.equal(handleKeyboardStep(50, 'ArrowRight', false), 52);
  assert.equal(handleKeyboardStep(50, 'ArrowDown', false), 48);
  assert.equal(handleKeyboardStep(50, 'ArrowUp', false), 52);

  // Shift accelerated arrow navigation
  assert.equal(handleKeyboardStep(50, 'ArrowLeft', true), 40);
  assert.equal(handleKeyboardStep(50, 'ArrowRight', true), 60);

  // Clamping at boundary
  assert.equal(handleKeyboardStep(1, 'ArrowLeft', false), 0);
  assert.equal(handleKeyboardStep(99, 'ArrowRight', false), 100);

  // Home & End
  assert.equal(handleKeyboardStep(73, 'Home', false), 0);
  assert.equal(handleKeyboardStep(22, 'End', false), 100);
});

test('URL memory lifecycle tracker tracks and deallocates without leaks', () => {
  const mockAllocated = new Set();
  const revoked = [];

  function createMockUrl(id) {
    const url = `blob:http://localhost/${id}`;
    mockAllocated.add(url);
    return url;
  }

  function revokeMockUrl(url) {
    if (mockAllocated.has(url)) {
      revoked.push(url);
      mockAllocated.delete(url);
    }
  }

  function cleanupAll() {
    mockAllocated.forEach(url => revoked.push(url));
    mockAllocated.clear();
  }

  const u1 = createMockUrl('item1');
  const u2 = createMockUrl('item2');
  const u3 = createMockUrl('item3');

  assert.equal(mockAllocated.size, 3);

  // Individual item remove
  revokeMockUrl(u2);
  assert.equal(mockAllocated.size, 2);
  assert.ok(!mockAllocated.has(u2));
  assert.ok(revoked.includes(u2));

  // Full queue clear
  cleanupAll();
  assert.equal(mockAllocated.size, 0);
  assert.equal(revoked.length, 3);
});

test('XSS escapeHtml sanitizes special characters properly', () => {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('Tom & Jerry\'s "Photo"'), 'Tom &amp; Jerry&#039;s &quot;Photo&quot;');
  assert.equal(escapeHtml('SafeName_123.jpg'), 'SafeName_123.jpg');
});

test('parseGeminiError classifies API error codes to human-readable text', () => {
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

  assert.equal(parseGeminiError({ message: 'Error 429: Resource has been exhausted' }), 'Rate limit hit — wait a moment and retry');
  assert.equal(parseGeminiError({ message: 'API key not valid. Please pass a valid API key.' }), 'Invalid API key — check Preferences');
  assert.equal(parseGeminiError({ message: 'Failed to fetch' }), 'Network error — check your connection');
  assert.equal(parseGeminiError({ message: 'Custom server crash' }), 'Custom server crash');
});

test('Aspect ratio log-scale distance minimizes geometric distortion', () => {
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

  function matchAspectRatio(width, height) {
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
  }

  // Exact matches
  assert.equal(matchAspectRatio(1000, 1000), '1:1');
  assert.equal(matchAspectRatio(1920, 1080), '16:9');
  assert.equal(matchAspectRatio(1080, 1920), '9:16');
  assert.equal(matchAspectRatio(4000, 3000), '4:3');
  assert.equal(matchAspectRatio(3000, 4000), '3:4');
  assert.equal(matchAspectRatio(6000, 4000), '3:2');
  assert.equal(matchAspectRatio(4000, 6000), '2:3');
  assert.equal(matchAspectRatio(2560, 1080), '21:9');

  // Slight variance (e.g. 1920x1200 is 16:10 = 1.6, closest to 3:2 = 1.5)
  assert.equal(matchAspectRatio(1920, 1200), '3:2');
});

test('API key sanitization strips CLI flags, quotes, and whitespace', () => {
  function sanitizeApiKey(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.trim()
      .replace(/^-m\s+/i, '')
      .replace(/^--key\s+/i, '')
      .replace(/^["']+|["']+$/g, '')
      .trim();
  }

  assert.equal(sanitizeApiKey('-m AQ.Ab8RN6K-hRJeEz'), 'AQ.Ab8RN6K-hRJeEz');
  assert.equal(sanitizeApiKey('--key "AIzaSyD-12345"'), 'AIzaSyD-12345');
  assert.equal(sanitizeApiKey("  'AQ.test_key'  "), 'AQ.test_key');
  assert.equal(sanitizeApiKey(null), '');
  assert.equal(sanitizeApiKey(undefined), '');
});

test('extractRetryDelayMs parses Retry-After header, Google RPC RetryInfo, and regex patterns', () => {
  function extractRetryDelayMs(response, errJson, errText) {
    if (response && response.headers && typeof response.headers.get === 'function') {
      const retryHeader = response.headers.get('retry-after');
      if (retryHeader) {
        const sec = parseInt(retryHeader, 10);
        if (!isNaN(sec) && sec > 0) {
          return (sec * 1000) + 1000;
        }
        const dateMs = Date.parse(retryHeader);
        if (!isNaN(dateMs) && dateMs > Date.now()) {
          return (dateMs - Date.now()) + 1000;
        }
      }
    }

    if (errJson?.error?.details && Array.isArray(errJson.error.details)) {
      for (const detail of errJson.error.details) {
        if (detail.retryDelay) {
          const match = String(detail.retryDelay).match(/^(\d+(?:\.\d+)?)s?$/);
          if (match) {
            const sec = parseFloat(match[1]);
            if (!isNaN(sec) && sec > 0) {
              return Math.round(sec * 1000) + 1000;
            }
          }
        }
      }
    }

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

  // 1. From standard Retry-After HTTP header
  const mockResponseWithHeader = {
    headers: {
      get: (h) => (h === 'retry-after' ? '30' : null)
    }
  };
  assert.equal(extractRetryDelayMs(mockResponseWithHeader, null, null), 31000);

  // 2. From Google RPC RetryInfo details
  const mockRpcError = {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '18.5s' }
      ]
    }
  };
  assert.equal(extractRetryDelayMs(null, mockRpcError, ''), 19500);

  // 3. From text message via regex
  assert.equal(
    extractRetryDelayMs(null, null, 'Quota exceeded for metric ... please retry after 22.4s'),
    23400
  );
  assert.equal(
    extractRetryDelayMs(null, { error: { message: 'Rate limit hit. Wait 15 seconds before next request' } }, ''),
    16000
  );

  // 4. Returns null when absent
  assert.equal(extractRetryDelayMs(null, { error: { message: 'Generic server error' } }, ''), null);
});

test('isDailyQuotaExceeded distinguishes permanent daily limits from transient per-minute limits', () => {
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

  // Daily quota errors (permanent until midnight PT)
  assert.equal(isDailyQuotaExceeded(null, "Resource exhausted: Quota exceeded for metric 'GenerateContent requests per day'"), true);
  assert.equal(isDailyQuotaExceeded({ error: { message: 'You have exceeded your daily quota for model gemini-3-pro' } }, ''), true);

  // Transient rate limit errors (per-minute or concurrency)
  assert.equal(isDailyQuotaExceeded(null, "Quota exceeded for metric 'GenerateContent requests per minute', please retry in 18s"), false);
  assert.equal(isDailyQuotaExceeded({ error: { message: 'Rate limit reached, please slow down' } }, ''), false);
});

test('isFatalApiError fast-fails unrecoverable auth errors without futile retries', () => {
  function isFatalApiError(status, errJson, errText) {
    const combined = `${errJson?.error?.message || ''} ${errText || ''}`.toLowerCase();
    if (status === 400 && (combined.includes('api_key_invalid') || combined.includes('api key not valid') || combined.includes('invalid_argument'))) return true;
    if (status === 401 || status === 403) return true;
    return false;
  }

  // Fatal errors
  assert.equal(isFatalApiError(400, { error: { message: 'API_KEY_INVALID: API key not valid' } }, ''), true);
  assert.equal(isFatalApiError(401, null, 'Unauthorized'), true);
  assert.equal(isFatalApiError(403, { error: { message: 'The caller does not have permission' } }, ''), true);
  assert.equal(isFatalApiError(403, null, 'Billing not enabled for project'), true);

  // Non-fatal transient errors (should be retried)
  assert.equal(isFatalApiError(429, { error: { message: 'Resource has been exhausted' } }, ''), false);
  assert.equal(isFatalApiError(500, null, 'Internal server error'), false);
  assert.equal(isFatalApiError(503, null, 'The service is temporarily unavailable'), false);
});

test('Image payload optimizer scales oversized dimensions preserving exact aspect ratio', () => {
  const MAX_DIMENSION = 3072;
  const SIZE_THRESHOLD_BYTES = 3.5 * 1024 * 1024;

  function calculateTargetDimensions(width, height, fileSize) {
    let needsOptimization = fileSize > SIZE_THRESHOLD_BYTES;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      needsOptimization = true;
    }
    if (!needsOptimization) {
      return { width, height, optimized: false };
    }
    const maxSide = Math.max(width, height);
    const scale = maxSide > MAX_DIMENSION ? (MAX_DIMENSION / maxSide) : 1;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      optimized: true
    };
  }

  // 1. Standard web image (1920x1080, 2MB): untouched
  const std = calculateTargetDimensions(1920, 1080, 2 * 1024 * 1024);
  assert.equal(std.optimized, false);
  assert.equal(std.width, 1920);
  assert.equal(std.height, 1080);

  // 2. High-res DSLR image (6000x4000, 24MB): scaled to max 3072 preserving 3:2
  const dslr = calculateTargetDimensions(6000, 4000, 24 * 1024 * 1024);
  assert.equal(dslr.optimized, true);
  assert.equal(dslr.width, 3072);
  assert.equal(dslr.height, 2048); // 3072 * (4000/6000) = 2048 exactly!

  // 3. Tall portrait (4000x6000, 18MB): scaled to max 3072 preserving 2:3
  const tall = calculateTargetDimensions(4000, 6000, 18 * 1024 * 1024);
  assert.equal(tall.optimized, true);
  assert.equal(tall.width, 2048);
  assert.equal(tall.height, 3072);

  // 4. Square large image (4096x4096): scaled to 3072x3072
  const sq = calculateTargetDimensions(4096, 4096, 12 * 1024 * 1024);
  assert.equal(sq.optimized, true);
  assert.equal(sq.width, 3072);
  assert.equal(sq.height, 3072);
});

test('0-byte file filtering prevents corrupt or empty files from queue entry', () => {
  const incomingFiles = [
    { name: 'photo1.jpg', size: 102400 },
    { name: 'empty.jpg', size: 0 },
    { name: 'photo2.png', size: 450000 },
    { name: '.DS_Store', size: 0 }
  ];

  let skippedEmpty = 0;
  const validFiles = [];
  incomingFiles.forEach(file => {
    if (!file || file.size === 0) {
      skippedEmpty++;
      return;
    }
    validFiles.push(file);
  });

  assert.equal(skippedEmpty, 2);
  assert.equal(validFiles.length, 2);
  assert.equal(validFiles[0].name, 'photo1.jpg');
  assert.equal(validFiles[1].name, 'photo2.png');
});

test('retryAllFailed resets only failed items to ready status', () => {
  const queue = [
    { id: '1', status: 'restored', error: null },
    { id: '2', status: 'error', error: 'Rate limit hit' },
    { id: '3', status: 'restored', error: null },
    { id: '4', status: 'error', error: 'Network timeout' },
    { id: '5', status: 'ready', error: null }
  ];

  const failedItems = queue.filter(i => i.status === 'error');
  assert.equal(failedItems.length, 2);

  failedItems.forEach(item => {
    item.status = 'ready';
    item.error = null;
  });

  assert.equal(queue.filter(i => i.status === 'error').length, 0);
  assert.equal(queue.filter(i => i.status === 'ready').length, 3);
  assert.equal(queue.filter(i => i.status === 'restored').length, 2);
});



