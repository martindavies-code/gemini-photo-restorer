import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  restoreImageWithGemini,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  STORAGE_KEY_API_KEY
} from './geminiService';

describe('Gemini Service - Local Storage Persistence & Security', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores sanitized API keys and strips dangerous characters', () => {
    setStoredApiKey('  AIzaSy_1234567890abcdefghijklmnopqrstuv  ');
    expect(getStoredApiKey()).toBe('AIzaSy_1234567890abcdefghijklmnopqrstuv');

    // Strips invalid characters
    setStoredApiKey('AIzaSy_123<script>evil</script>');
    expect(getStoredApiKey()).toBe('AIzaSy_123evil');
  });

  it('removes storage key when empty string is provided', () => {
    setStoredApiKey('valid-key');
    expect(localStorage.getItem(STORAGE_KEY_API_KEY)).toBeDefined();

    setStoredApiKey('');
    expect(getStoredApiKey()).toBe('');
  });

  it('defaults to gemini-3.1-flash-image when no valid model is stored', () => {
    expect(getStoredModel()).toBe('gemini-3.1-flash-image');

    setStoredModel('gemini-2.5-flash-image');
    expect(getStoredModel()).toBe('gemini-2.5-flash-image');
  });
});

describe('Gemini Service - Authentication, Request Dispatch, and Error Handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const validKey = 'AIzaSyA_1234567890abcdefghijklmnopqrstuv';
  const sampleFile = new File(['fake-image-bytes'], 'sample.jpg', { type: 'image/jpeg' });
  const samplePrompt = 'Restore this photo to 8K resolution.';

  it('rejects execution if API key is invalid without making network requests', async () => {
    await expect(
      restoreImageWithGemini({
        apiKey: 'invalid key with spaces!@#$',
        file: sampleFile,
        prompt: samplePrompt
      })
    ).rejects.toThrow('API key');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects execution if file is invalid (e.g. SVG) without making network requests', async () => {
    const svgFile = new File(['<svg></svg>'], 'test.svg', { type: 'image/svg+xml' });

    await expect(
      restoreImageWithGemini({
        apiKey: validKey,
        file: svgFile,
        prompt: samplePrompt
      })
    ).rejects.toThrow('SVG files are disallowed');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects execution if prompt is empty', async () => {
    await expect(
      restoreImageWithGemini({
        apiKey: validKey,
        file: sampleFile,
        prompt: '   '
      })
    ).rejects.toThrow('Prompt cannot be empty');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('transmits API key in x-goog-api-key header and NOT in query parameter (OWASP CWE-598)', async () => {
    // Mock successful 200 response
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                  }
                }
              ]
            }
          }
        ]
      })
    });

    await restoreImageWithGemini({
      apiKey: validKey,
      file: sampleFile,
      prompt: samplePrompt
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = (globalThis.fetch as any).mock.calls[0];

    // Verify URL does NOT leak key in query params
    expect(calledUrl).not.toContain('?key=');
    expect(calledUrl).not.toContain(validKey);

    // Verify key is sent securely in headers
    expect(calledOptions.headers['x-goog-api-key']).toBe(validKey);

    // Verify generationConfig includes imageConfig and aspect ratio to prevent Nano Banana distortion
    const sentBody = JSON.parse(calledOptions.body);
    expect(sentBody.generationConfig).toBeDefined();
    expect(sentBody.generationConfig.imageConfig).toBeDefined();
    expect(sentBody.generationConfig.imageConfig.aspectRatio).toBeDefined();
    expect(sentBody.contents[0].parts[0].text).toContain('ZERO DISTORTION RULE');
  });

  it('handles 429 Rate Limit error gracefully with actionable guidance', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { message: 'Quota exceeded for quota metric...' } })
    });

    await expect(
      restoreImageWithGemini({
        apiKey: validKey,
        file: sampleFile,
        prompt: samplePrompt
      })
    ).rejects.toThrow(/Rate Limit Exceeded/);
  });

  it('handles 401/403 Authentication error with explicit message', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { message: 'API_KEY_INVALID' } })
    });

    await expect(
      restoreImageWithGemini({
        apiKey: validKey,
        file: sampleFile,
        prompt: samplePrompt
      })
    ).rejects.toThrow(/Authentication Failed/);
  });

  it('handles non-JSON HTML gateway error pages (502/504) without crashing', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html><body><h1>502 Bad Gateway</h1>Cloudflare</body></html>'
    });

    await expect(
      restoreImageWithGemini({
        apiKey: validKey,
        file: sampleFile,
        prompt: samplePrompt
      })
    ).rejects.toThrow(/Google Server Error \(502\)/);
  });

  it('handles safety filter blocks from promptFeedback', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        candidates: [],
        promptFeedback: {
          blockReason: 'SAFETY'
        }
      })
    });

    await expect(
      restoreImageWithGemini({
        apiKey: validKey,
        file: sampleFile,
        prompt: samplePrompt
      })
    ).rejects.toThrow(/blocked by Google Safety Filters: SAFETY/);
  });

  it('respects AbortSignal cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      restoreImageWithGemini({
        apiKey: validKey,
        file: sampleFile,
        prompt: samplePrompt,
        signal: controller.signal
      })
    ).rejects.toThrow('Operation was cancelled');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
