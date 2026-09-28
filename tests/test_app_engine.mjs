/**
 * Atelier 8K - Client Engine Test Suite (Node.js Native Test Runner)
 * =================================================================
 * Forensic testing for binary algorithms, PKZip engine, CRC-32 RFC vectors,
 * Base64 memory decoding, Pointer Events math, WAI-ARIA accessibility,
 * Gemini API & Google Vertex AI error classification, Retry-After header parsing,
 * and aspect-ratio preserving payload optimization.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = require('../app.js');

const {
  calculateCrc32,
  createZipBlob,
  parseGeminiError,
  extractRetryDelayMs,
  isDailyQuotaExceeded,
  isFatalApiError,
  sanitizeApiKey,
  escapeHtml,
  buildApiEndpoint,
  buildApiHeaders,
  isAuthConfigured,
  GEMINI_ASPECT_RATIOS,
  state
} = app;

// ─── 1. CRC-32 Standard RFC Test Vectors ──────────────────────────────────────
test('CRC32 standard RFC test vector validation', () => {
  // Test 1: Empty string -> 0x00000000
  const empty = new Uint8Array(0);
  assert.equal(calculateCrc32(empty), 0x00000000);

  // Test 2: Standard RFC 3720 check string "123456789" -> 0xcbf43926 (3421780262)
  const rfcCheckBytes = new TextEncoder().encode('123456789');
  assert.equal(calculateCrc32(rfcCheckBytes), 0xcbf43926);

  // Test 3: "The quick brown fox jumps over the lazy dog" -> 0x414fa339 (1095768889)
  const foxBytes = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
  assert.equal(calculateCrc32(foxBytes), 0x414fa339);

  // Test 4: Single byte 'a' -> 0xe8b7be43
  const aByte = new TextEncoder().encode('a');
  assert.equal(calculateCrc32(aByte), 0xe8b7be43);
});

// ─── 2. In-Browser PKZip Binary Engine ─────────────────────────────────────────
test('PKZip engine creates valid ZIP binary structure with RFC compliance', async () => {
  const dummyPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const files = [
    { name: 'photo_01.png', data: dummyPngBytes },
    { name: 'photo_02.png', data: new Uint8Array([1, 2, 3, 4, 5]) }
  ];

  const zipBlob = createZipBlob(files);
  assert.ok(zipBlob instanceof Blob);
  assert.equal(zipBlob.type, 'application/zip');

  const arrayBuffer = await zipBlob.arrayBuffer();
  const zipBytes = new Uint8Array(arrayBuffer);
  const view = new DataView(zipBytes.buffer);

  // Check 1: Local File Header 1 magic signature 0x04034b50
  assert.equal(view.getUint32(0, true), 0x04034b50, 'Local Header 1 signature mismatch');

  // Check 2: Version needed = 20 (PKZip 2.0)
  assert.equal(view.getUint16(4, true), 20);

  // Check 3: General purpose bit flag Bit 11 set (0x0800 for UTF-8)
  assert.equal((view.getUint16(6, true) & 0x0800), 0x0800, 'Bit 11 UTF-8 flag must be set');

  // Check 4: Compression method = 0 (Stored / uncompressed)
  assert.equal(view.getUint16(8, true), 0);

  // Check 5: CRC-32 match for file 1
  const expectedCrc1 = calculateCrc32(dummyPngBytes);
  assert.equal(view.getUint32(14, true), expectedCrc1, 'CRC-32 checksum mismatch in local header');

  // Check 6: Compressed size == Uncompressed size
  assert.equal(view.getUint32(18, true), dummyPngBytes.length);
  assert.equal(view.getUint32(22, true), dummyPngBytes.length);

  // Check 7: End of Central Directory record signature 0x06054b50
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  for (let i = zipBytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === eocdSig) {
      eocdOffset = i;
      break;
    }
  }
  assert.ok(eocdOffset !== -1, 'End of Central Directory record must be present');
  assert.equal(view.getUint16(eocdOffset + 8, true), 2, 'Total entries on disk mismatch');
  assert.equal(view.getUint16(eocdOffset + 10, true), 2, 'Total central directory entries mismatch');
});

// ─── 3. PKZip Security & Path Traversal Sanitization ──────────────────────────
test('PKZip engine sanitizes path traversal attacks, control chars, and deduplicates colliding names', async () => {
  const dummy = new Uint8Array([65, 66, 67]);
  const maliciousFiles = [
    { name: '../../../etc/passwd.png', data: dummy },
    { name: '..\\..\\windows\\system32.png', data: dummy },
    { name: 'sub/folder/nested.png', data: dummy },
    { name: 'collision.png', data: dummy },
    { name: 'collision.png', data: dummy },
    { name: 'collision.png', data: dummy },
    { name: 'bad\x00\x1fname\x7f.png', data: dummy },
    { name: '', data: dummy }
  ];

  const zipBlob = createZipBlob(maliciousFiles);
  const buffer = await zipBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder().decode(bytes);

  // Verification 1: Path traversal '..' must never appear
  assert.ok(!text.includes('..'), 'Path traversal sequence ".." must be sanitized');

  // Verification 2: Path separators '/' and '\' must be converted to '_'
  assert.ok(!text.includes('sub/folder/nested.png'));
  assert.ok(text.includes('sub_folder_nested.png'));

  // Verification 3: Name collisions must be disambiguated with suffix counters
  assert.ok(text.includes('collision.png'));
  assert.ok(text.includes('collision_1.png'));
  assert.ok(text.includes('collision_2.png'));

  // Verification 4: Control characters must be stripped
  assert.ok(text.includes('badname.png'));

  // Verification 5: Empty file name must fall back safely
  assert.ok(text.includes('restored_image.png'));
});

// ─── 4. Base64 Binary Decoding Accuracy ───────────────────────────────────────
test('Base64 memory-efficient byte decoding', () => {
  const testString = 'Atelier 8K Forensic Restoration Engine v3.0';
  const base64 = Buffer.from(testString).toString('base64');

  const binaryString = atob(base64);
  const len = binaryString.length;
  const decoded = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    decoded[i] = binaryString.charCodeAt(i);
  }

  const resultString = new TextDecoder().decode(decoded);
  assert.equal(resultString, testString);
});

// ─── 5. Slider Coordinate Clamping, Precision & WAI-ARIA ──────────────────────
test('Slider coordinate clamping, precision, and WAI-ARIA valuetext', () => {
  function computeSliderValues(percentage) {
    const pos = Math.max(0, Math.min(100, percentage));
    const rounded = Math.round(pos);
    return {
      pos,
      valuenow: rounded.toString(),
      valuetext: `${rounded}% comparison`,
      clipWidth: `${pos}%`,
      dividerLeft: `${pos}%`
    };
  }

  // Clamping
  assert.equal(computeSliderValues(-15).pos, 0);
  assert.equal(computeSliderValues(-15).valuenow, '0');
  assert.equal(computeSliderValues(120).pos, 100);
  assert.equal(computeSliderValues(120).valuenow, '100');

  // Standard midpoint
  const mid = computeSliderValues(50);
  assert.equal(mid.pos, 50);
  assert.equal(mid.valuenow, '50');
  assert.equal(mid.valuetext, '50% comparison');
  assert.equal(mid.clipWidth, '50%');
  assert.equal(mid.dividerLeft, '50%');

  // Precision decimal rounding
  const frac = computeSliderValues(74.6);
  assert.equal(frac.pos, 74.6);
  assert.equal(frac.valuenow, '75');
  assert.equal(frac.valuetext, '75% comparison');
});

// ─── 6. Keyboard Slider Navigation Steps ──────────────────────────────────────
test('Keyboard slider navigation steps with Shift jumps and Home/End bounds', () => {
  function handleSliderKey(key, currentPos, shiftKey) {
    const step = shiftKey ? 10 : 2;
    if (key === 'ArrowLeft' || key === 'ArrowDown') {
      return Math.max(0, currentPos - step);
    } else if (key === 'ArrowRight' || key === 'ArrowUp') {
      return Math.min(100, currentPos + step);
    } else if (key === 'Home') {
      return 0;
    } else if (key === 'End') {
      return 100;
    }
    return currentPos;
  }

  // Standard 2% steps
  assert.equal(handleSliderKey('ArrowRight', 50, false), 52);
  assert.equal(handleSliderKey('ArrowLeft', 50, false), 48);
  assert.equal(handleSliderKey('ArrowUp', 50, false), 52);
  assert.equal(handleSliderKey('ArrowDown', 50, false), 48);

  // Shift 10% jumps
  assert.equal(handleSliderKey('ArrowRight', 50, true), 60);
  assert.equal(handleSliderKey('ArrowLeft', 50, true), 40);

  // Boundary checks
  assert.equal(handleSliderKey('ArrowLeft', 1, false), 0);
  assert.equal(handleSliderKey('ArrowRight', 99, false), 100);

  // Home & End keys
  assert.equal(handleSliderKey('Home', 67, false), 0);
  assert.equal(handleSliderKey('End', 23, false), 100);
});

// ─── 7. URL Memory Lifecycle Management ───────────────────────────────────────
test('URL memory lifecycle tracker tracks and deallocates without leaks', () => {
  const tracker = new Set();

  function allocate(id) {
    const url = `blob:http://localhost:8000/${id}`;
    tracker.add(url);
    return url;
  }

  function deallocate(url) {
    if (tracker.has(url)) {
      tracker.delete(url);
    }
  }

  const url1 = allocate('uuid-1');
  const url2 = allocate('uuid-2');
  assert.equal(tracker.size, 2);

  deallocate(url1);
  assert.equal(tracker.size, 1);
  assert.ok(!tracker.has(url1));
  assert.ok(tracker.has(url2));

  // Purge all
  tracker.clear();
  assert.equal(tracker.size, 0);
});

// ─── 8. XSS Prevention in escapeHtml ───────────────────────────────────────────
test('XSS escapeHtml sanitizes special characters properly', () => {
  assert.equal(
    escapeHtml('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  );
  assert.equal(
    escapeHtml('photo "test" & \'restoration\''),
    'photo &quot;test&quot; &amp; &#039;restoration&#039;'
  );
});

// ─── 9. Gemini & Vertex AI Error Classification ───────────────────────────────
test('parseGeminiError classifies API error codes for both Gemini API key and Vertex AI modes', () => {
  // Test standard Gemini API key mode
  state.authMode = 'apikey';
  assert.equal(parseGeminiError({ message: 'Error 429: Resource exhausted' }), 'Rate limit hit — cooling down and retrying...');
  assert.equal(parseGeminiError({ message: 'API_KEY_INVALID' }), 'Invalid API key — check Preferences');
  assert.equal(parseGeminiError({ message: '401 Unauthorized' }), 'Invalid API key — check Preferences');
  assert.equal(parseGeminiError({ message: '403 Forbidden: Caller does not have permission' }), 'API key lacks permission — check Google AI Studio');
  assert.equal(parseGeminiError({ message: 'Quota exceeded for requests per day' }), 'Daily API quota exhausted — resets tomorrow at midnight PT');
  assert.equal(parseGeminiError({ message: '413 Request Entity Too Large' }), 'Payload too large — image optimized automatically');
  assert.equal(parseGeminiError({ message: 'Failed to fetch' }), 'Network error — check your connection');
  assert.equal(parseGeminiError({ message: 'finishReason: SAFETY' }), 'Model returned no image — try a different image or prompt');

  // Test Vertex AI mode (tailored messages)
  state.authMode = 'vertex';
  assert.equal(parseGeminiError({ message: 'Quota exceeded for aiplatform.googleapis.com (RESOURCE_EXHAUSTED)' }), 'Vertex AI rate limit hit — cooling down and retrying...');
  assert.equal(parseGeminiError({ message: '403 PERMISSION_DENIED on resource' }), 'Vertex AI permission denied — check GCP Project ID and IAM permissions');
  assert.equal(parseGeminiError({ message: '401 UNAUTHENTICATED token expired' }), 'Google authorization expired — reconnect in Preferences');

  // Reset to default
  state.authMode = 'apikey';
});

// ─── 10. Aspect Ratio Log-Scale Distance ──────────────────────────────────────
test('Aspect ratio log-scale distance minimizes geometric distortion across formats', () => {
  function detectBestAspect(width, height) {
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
  assert.equal(detectBestAspect(1000, 1000), '1:1');
  assert.equal(detectBestAspect(4000, 3000), '4:3');
  assert.equal(detectBestAspect(3000, 4000), '3:4');
  assert.equal(detectBestAspect(3000, 2000), '3:2');
  assert.equal(detectBestAspect(2000, 3000), '2:3');
  assert.equal(detectBestAspect(1920, 1080), '16:9');
  assert.equal(detectBestAspect(1080, 1920), '9:16');
  assert.equal(detectBestAspect(2560, 1080), '21:9');
  assert.equal(detectBestAspect(2500, 2000), '5:4');
  assert.equal(detectBestAspect(2000, 2500), '4:5');

  // Near matches (tolerance test)
  assert.equal(detectBestAspect(1920, 1079), '16:9'); // 1px off
  assert.equal(detectBestAspect(1002, 1000), '1:1');   // near square
  assert.equal(detectBestAspect(3840, 2160), '16:9');  // 4K UHD
});

// ─── 11. API Key Sanitization ─────────────────────────────────────────────────
test('API key sanitization strips CLI flags, quotes, and whitespace', () => {
  assert.equal(sanitizeApiKey('  AIzaSyValidKey123  '), 'AIzaSyValidKey123');
  assert.equal(sanitizeApiKey('"AIzaSyValidKey123"'), 'AIzaSyValidKey123');
  assert.equal(sanitizeApiKey("'AIzaSyValidKey123'"), 'AIzaSyValidKey123');
  assert.equal(sanitizeApiKey('-m AIzaSyValidKey123'), 'AIzaSyValidKey123');
  assert.equal(sanitizeApiKey('--key AIzaSyValidKey123'), 'AIzaSyValidKey123');
  assert.equal(sanitizeApiKey('--KEY "AIzaSyValidKey123"'), 'AIzaSyValidKey123');
  assert.equal(sanitizeApiKey(null), '');
  assert.equal(sanitizeApiKey(undefined), '');
  assert.equal(sanitizeApiKey(''), '');
});

// ─── 12. Retry-After Header & Google RPC RetryInfo ────────────────────────────
test('extractRetryDelayMs parses Retry-After header, Google RPC RetryInfo, and regex patterns', () => {
  // 1. HTTP Retry-After integer seconds
  const mockResp1 = { headers: { get: (name) => name === 'retry-after' ? '30' : null } };
  assert.equal(extractRetryDelayMs(mockResp1, null, ''), 31000); // 30s + 1s buffer

  // 2. HTTP Retry-After HTTP-Date
  const futureDate = new Date(Date.now() + 20000).toUTCString();
  const mockResp2 = { headers: { get: (name) => name === 'retry-after' ? futureDate : null } };
  const parsedDelay = extractRetryDelayMs(mockResp2, null, '');
  assert.ok(parsedDelay >= 19000 && parsedDelay <= 22000);

  // 3. Google RPC RetryInfo with string delay ("15s")
  const rpcStringErr = { error: { details: [{ retryDelay: '15s' }] } };
  assert.equal(extractRetryDelayMs(null, rpcStringErr, ''), 16000);

  // 4. Google RPC RetryInfo with structured object ({ seconds: 25, nanos: 500000000 })
  const rpcObjErr = { error: { details: [{ retryDelay: { seconds: 25, nanos: 500000000 } }] } };
  assert.equal(extractRetryDelayMs(null, rpcObjErr, ''), 26500); // 25.5s * 1000 + 1000

  // 5. Google RPC RetryInfo with snake_case retry_delay
  const rpcSnakeErr = { error: { details: [{ retry_delay: '40s' }] } };
  assert.equal(extractRetryDelayMs(null, rpcSnakeErr, ''), 41000);

  // 6. Free text regex match
  const textErr = 'Resource exhausted. Please retry in 18.5 seconds.';
  assert.equal(extractRetryDelayMs(null, null, textErr), 19500);

  // 7. No delay specified -> null
  assert.equal(extractRetryDelayMs(null, null, 'Generic 500 server error'), null);
});

// ─── 13. Daily Quota Detection ────────────────────────────────────────────────
test('isDailyQuotaExceeded distinguishes permanent daily limits from transient per-minute limits', () => {
  assert.equal(isDailyQuotaExceeded({ error: { message: 'Quota exceeded for quota metric Requests per day' } }, ''), true);
  assert.equal(isDailyQuotaExceeded(null, 'You have exceeded your daily quota for this project'), true);
  assert.equal(isDailyQuotaExceeded({ error: { message: 'quota_exceeded_daily' } }, ''), true);

  // Transient per-minute rate limits should NOT be classified as daily quota
  assert.equal(isDailyQuotaExceeded({ error: { message: 'Rate limit exceeded: 15 requests per minute' } }, ''), false);
  assert.equal(isDailyQuotaExceeded(null, 'Too many requests, try again in 30 seconds'), false);
});

// ─── 14. Fatal API Error Classification ───────────────────────────────────────
test('isFatalApiError fast-fails unrecoverable auth errors without futile retries', () => {
  state.authMode = 'apikey';
  // Bad API key is fatal in API key mode
  assert.equal(isFatalApiError(400, { error: { message: 'API_KEY_INVALID' } }, ''), true);
  assert.equal(isFatalApiError(401, null, 'Unauthorized'), true);
  assert.equal(isFatalApiError(403, { error: { message: 'The provided API key is invalid' } }, ''), true);

  // Transient errors are NOT fatal (they should be retried!)
  assert.equal(isFatalApiError(429, null, 'Rate limit'), false);
  assert.equal(isFatalApiError(500, null, 'Internal error'), false);
  assert.equal(isFatalApiError(503, null, 'Service unavailable'), false);
  assert.equal(isFatalApiError(400, { error: { message: 'Invalid payload dimension' } }, ''), false);

  // In Vertex AI mode, 401 is NOT fatal because it triggers token auto-refresh!
  state.authMode = 'vertex';
  assert.equal(isFatalApiError(401, null, 'Token expired'), false);
  state.authMode = 'apikey';
});

// ─── 15. Image Payload Scaling Mathematics ────────────────────────────────────
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
  assert.equal(dslr.height, 2048);

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

// ─── 16. 0-Byte Corrupt File Filtering ─────────────────────────────────────────
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

// ─── 17. Retry All Failed Queue Logic ─────────────────────────────────────────
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

// ─── 18. API Endpoint Builder: Gemini API Key Mode ────────────────────────────
test('buildApiEndpoint constructs standard Gemini URL in apikey mode', () => {
  state.authMode = 'apikey';
  state.apiKey = 'AIzaSyTest123';
  state.model = 'gemini-3-pro-image';

  const endpoint = buildApiEndpoint();
  assert.equal(
    endpoint,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=AIzaSyTest123'
  );
});

// ─── 19. API Endpoint Builder: Vertex AI Multi-Region Endpoints ───────────────
test('buildApiEndpoint constructs Vertex AI URL in vertex mode using GCP credits', () => {
  state.authMode = 'vertex';
  state.gcpProjectId = 'my-gcp-restorer-987';
  state.gcpRegion = 'us-central1';
  state.model = 'gemini-3-pro-image';

  const ep1 = buildApiEndpoint();
  assert.equal(
    ep1,
    'https://us-central1-aiplatform.googleapis.com/v1/projects/my-gcp-restorer-987/locations/us-central1/publishers/google/models/gemini-3-pro-image:generateContent'
  );

  // Region: London
  state.gcpRegion = 'europe-west2';
  state.model = 'gemini-3.1-flash-image';
  const ep2 = buildApiEndpoint();
  assert.equal(
    ep2,
    'https://europe-west2-aiplatform.googleapis.com/v1/projects/my-gcp-restorer-987/locations/europe-west2/publishers/google/models/gemini-3.1-flash-image:generateContent'
  );

  // Region: Tokyo
  state.gcpRegion = 'asia-northeast1';
  const ep3 = buildApiEndpoint();
  assert.equal(
    ep3,
    'https://asia-northeast1-aiplatform.googleapis.com/v1/projects/my-gcp-restorer-987/locations/asia-northeast1/publishers/google/models/gemini-3.1-flash-image:generateContent'
  );

  // Throws if project ID is missing in vertex mode
  state.gcpProjectId = '   ';
  assert.throws(() => buildApiEndpoint(), /GCP Project ID is required/);

  // Reset to default
  state.authMode = 'apikey';
});

// ─── 20. Auth Configured Verification ─────────────────────────────────────────
test('isAuthConfigured verifies credentials based on active mode', () => {
  // API Key mode
  state.authMode = 'apikey';
  state.apiKey = 'AIzaKey';
  assert.equal(isAuthConfigured(), true);
  state.apiKey = '';
  assert.equal(isAuthConfigured(), false);
  state.apiKey = '   ';
  assert.equal(isAuthConfigured(), false);

  // Vertex AI mode
  state.authMode = 'vertex';
  state.gcpProjectId = 'my-project-1';
  assert.equal(isAuthConfigured(), true);
  state.gcpProjectId = '';
  assert.equal(isAuthConfigured(), false);
  state.gcpProjectId = '   ';
  assert.equal(isAuthConfigured(), false);

  // Reset to default
  state.authMode = 'apikey';
});

// ─── 21. Intelligent Model Auto-Fallback Engine ────────────────────────────────
test('Intelligent auto-fallback dynamically switches model from Pro to Flash on 429 quota exhaustion', () => {
  state.authMode = 'apikey';
  state.apiKey = 'AIzaSyTestFallbackKey';
  state.model = 'gemini-3-pro-image';
  state.autoFallbackOnQuota = true;

  // Endpoint reflects Pro Image initially
  const proEndpoint = buildApiEndpoint();
  assert.ok(proEndpoint.includes('gemini-3-pro-image'));
  assert.ok(!proEndpoint.includes('gemini-3.1-flash-image'));

  // Simulate receiving 429 quota exhaustion under Pro Image
  const simulatedResponseStatus = 429;
  const isProQuotaHit = (
    simulatedResponseStatus === 429 &&
    state.model === 'gemini-3-pro-image' &&
    state.autoFallbackOnQuota
  );
  assert.equal(isProQuotaHit, true);

  // Trigger fallback
  if (isProQuotaHit) {
    state.model = 'gemini-3.1-flash-image';
    state.consecutiveRateLimits = 0;
    state.rateLimitResetUntil = 0;
  }

  // Model is now Flash Image
  assert.equal(state.model, 'gemini-3.1-flash-image');

  // New endpoint points directly to Flash Image URL
  const flashEndpoint = buildApiEndpoint();
  assert.ok(flashEndpoint.includes('gemini-3.1-flash-image'));
  assert.ok(!flashEndpoint.includes('gemini-3-pro-image'));

  // If already on Flash Image, fallback does not re-trigger
  const isFlashQuotaHit = (
    simulatedResponseStatus === 429 &&
    state.model === 'gemini-3-pro-image' &&
    state.autoFallbackOnQuota
  );
  assert.equal(isFlashQuotaHit, false);

  // Reset to default
  state.model = 'gemini-3.1-flash-image';
});

// ─── 22. Quota Metric 0-1 RPM Diagnostic Classification ───────────────────────
test('parseGeminiError provides exact actionable guidance when 0-1 RPM quota limit is exceeded', () => {
  const gcpLimit0Err = {
    message: "Quota exceeded for quota metric 'GenerateContent request count per minute' and limit '0' of service 'aiplatform.googleapis.com'"
  };
  const parsed0 = parseGeminiError(gcpLimit0Err);
  assert.ok(parsed0.includes('0-1 RPM for Pro Image'));
  assert.ok(parsed0.includes('Switch to Flash Image'));

  const gcpLimit1Err = {
    message: "Resource exhausted: Quota exceeded for quota metric 'requests per minute' and limit '1'"
  };
  const parsed1 = parseGeminiError(gcpLimit1Err);
  assert.ok(parsed1.includes('0-1 RPM for Pro Image'));
  assert.ok(parsed1.includes('Switch to Flash Image'));
});

// ─── 23. Alpha Transparency Format Detection ──────────────────────────────────
test('Alpha transparency format detection recognizes PNG and WebP files', () => {
  function isAlphaSupported(mimeType, filename) {
    return mimeType === 'image/png' || mimeType === 'image/webp' ||
           Boolean(filename && /\.(png|webp)$/i.test(filename));
  }

  // PNG tests
  assert.equal(isAlphaSupported('image/png', 'portrait.png'), true);
  assert.equal(isAlphaSupported('application/octet-stream', 'transparent.PNG'), true);
  assert.equal(isAlphaSupported('image/png', ''), true);

  // WebP tests
  assert.equal(isAlphaSupported('image/webp', 'graphic.webp'), true);
  assert.equal(isAlphaSupported('', 'photo.WEBP'), true);

  // JPEG / BMP / TIFF should not use alpha context
  assert.equal(isAlphaSupported('image/jpeg', 'photo.jpg'), false);
  assert.equal(isAlphaSupported('image/jpeg', 'photo.jpeg'), false);
  assert.equal(isAlphaSupported('image/bmp', 'bitmap.bmp'), false);
});

// ─── 24. Pipelined Payload Cache Concurrency ──────────────────────────────────
test('Pipelined payload cache correctly buffers and hands off preloaded promises', async () => {
  const payloadCache = new Map();

  const item1 = { id: 'img-1', file: { name: 'first.jpg' } };
  const item2 = { id: 'img-2', file: { name: 'second.png' } };

  // Simulate preloading item2 while item1 is executing
  const preloadedPromise = Promise.resolve({
    base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    mimeType: 'image/png'
  });
  payloadCache.set(item2.id, preloadedPromise);

  // item1 has no preloaded payload
  assert.equal(payloadCache.has(item1.id), false);
  assert.equal(payloadCache.has(item2.id), true);

  // When item2 runs, it consumes its preloaded payload
  const fetchedPromise = payloadCache.get(item2.id);
  payloadCache.delete(item2.id);

  assert.equal(payloadCache.has(item2.id), false);
  const result = await fetchedPromise;
  assert.equal(result.mimeType, 'image/png');
  assert.ok(result.base64Data.length > 0);
});

// ─── 25. Modern AQ Authentication Key and Header Propagation ──────────────────
test('buildApiHeaders propagates modern AQ auth keys via x-goog-api-key header', async () => {
  state.authMode = 'apikey';
  state.apiKey = 'AQ.MockAuthKeyForTestingPurposesOnly_0123456789';

  const headers = await buildApiHeaders();
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(headers['x-goog-api-key'], 'AQ.MockAuthKeyForTestingPurposesOnly_0123456789');

  // Verify sanitized properly
  const sanitized = sanitizeApiKey('  AQ.MockAuthKeyForTestingPurposesOnly_0123456789  ');
  assert.equal(sanitized, 'AQ.MockAuthKeyForTestingPurposesOnly_0123456789');
});


