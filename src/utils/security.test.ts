import { describe, it, expect } from 'vitest';
import {
  validateApiKey,
  sanitizeApiKey,
  validateImageFile,
  validateImageDimensions,
  sanitizeFilename,
  sanitizePrompt,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION_PX,
  MAX_PROMPT_LENGTH
} from './security';

describe('Security Utilities - API Key Validation & Sanitisation', () => {
  it('accepts valid Google AI Studio and Gemini API keys (both AIza and AQ formats)', () => {
    const validClassicKey = 'AIzaSyA_1234567890abcdefghijklmnopqrstuv';
    expect(validateApiKey(validClassicKey).isValid).toBe(true);

    const validNewFormatKey = 'AQ.Ab123456_7890.xyz-ABCDEFGHIJKLM';
    const result = validateApiKey(validNewFormatKey);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects empty or whitespace-only keys', () => {
    expect(validateApiKey('').isValid).toBe(false);
    expect(validateApiKey('   ').isValid).toBe(false);
    // @ts-expect-error testing invalid type
    expect(validateApiKey(null).isValid).toBe(false);
    // @ts-expect-error testing invalid type
    expect(validateApiKey(undefined).isValid).toBe(false);
  });

  it('rejects keys with header injection characters or control bytes', () => {
    const maliciousKey = 'AQ.Ab123456\r\nx-injected-header: true';
    const result = validateApiKey(maliciousKey);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });

  it('rejects keys that are too short or too long', () => {
    expect(validateApiKey('short').isValid).toBe(false);
    expect(validateApiKey('a'.repeat(600)).isValid).toBe(false);
  });

  it('sanitizes API keys by trimming and stripping unsafe characters while preserving dots and valid tokens', () => {
    expect(sanitizeApiKey('  AIzaSy_12345-abc  ')).toBe('AIzaSy_12345-abc');
    expect(sanitizeApiKey('  AQ.Ab_123.456-XYZ  ')).toBe('AQ.Ab_123.456-XYZ');
    expect(sanitizeApiKey('AQ.Ab<script>123</script>')).toBe('AQ.Ab123');
    // @ts-expect-error testing null
    expect(sanitizeApiKey(null)).toBe('');
  });
});

describe('Security Utilities - Image File Validation (XSS & Decompression Bomb Protection)', () => {
  it('accepts valid raster image formats (JPEG, PNG, WEBP)', () => {
    const jpegFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const pngFile = new File(['content'], 'test.png', { type: 'image/png' });
    const webpFile = new File(['content'], 'test.webp', { type: 'image/webp' });

    expect(validateImageFile(jpegFile).isValid).toBe(true);
    expect(validateImageFile(pngFile).isValid).toBe(true);
    expect(validateImageFile(webpFile).isValid).toBe(true);
  });

  it('strictly rejects SVG files to prevent stored XSS (CWE-79)', () => {
    const svgFile = new File(['<svg onload="alert(1)"></svg>'], 'exploit.svg', {
      type: 'image/svg+xml'
    });
    const result = validateImageFile(svgFile);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('SVG files are disallowed');
  });

  it('rejects non-image or unknown MIME types', () => {
    const pdfFile = new File(['pdf-data'], 'doc.pdf', { type: 'application/pdf' });
    const exeFile = new File(['exe-data'], 'app.exe', { type: 'application/x-msdownload' });

    expect(validateImageFile(pdfFile).isValid).toBe(false);
    expect(validateImageFile(exeFile).isValid).toBe(false);
    // @ts-expect-error testing null file
    expect(validateImageFile(null).isValid).toBe(false);
  });

  it('rejects empty (0 byte) files', () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const result = validateImageFile(emptyFile);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('File is empty');
  });

  it('rejects files exceeding the 25MB ceiling to prevent buffer exhaustion', () => {
    const hugeBlob = new Blob([new Uint8Array(MAX_FILE_SIZE_BYTES + 1024)]);
    const hugeFile = new File([hugeBlob], 'huge.jpg', { type: 'image/jpeg' });
    const result = validateImageFile(hugeFile);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('exceeds maximum allowed limit');
  });
});

describe('Security Utilities - Image Dimensions Guard (OOM Prevention)', () => {
  it('validates normal positive dimensions', () => {
    expect(validateImageDimensions(1920, 1080).isValid).toBe(true);
    expect(validateImageDimensions(4096, 4096).isValid).toBe(true);
  });

  it('rejects zero or negative dimensions', () => {
    expect(validateImageDimensions(0, 100).isValid).toBe(false);
    expect(validateImageDimensions(100, 0).isValid).toBe(false);
    expect(validateImageDimensions(-50, 100).isValid).toBe(false);
  });

  it('rejects NaN, Infinity, and non-numeric inputs', () => {
    expect(validateImageDimensions(NaN, 100).isValid).toBe(false);
    expect(validateImageDimensions(100, Infinity).isValid).toBe(false);
  });

  it('rejects extreme dimensions exceeding MAX_IMAGE_DIMENSION_PX', () => {
    expect(validateImageDimensions(MAX_IMAGE_DIMENSION_PX + 1, 100).isValid).toBe(false);
    expect(validateImageDimensions(100, MAX_IMAGE_DIMENSION_PX + 1).isValid).toBe(false);
  });
});

describe('Security Utilities - Filename Sanitisation (Path Traversal CWE-22)', () => {
  it('neutralizes directory traversal patterns', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd_exe');
    expect(sanitizeFilename('/var/www/html/photo.jpg')).toBe('photo_jpg');
  });

  it('replaces dangerous symbols and preserves safe alphanumeric characters', () => {
    expect(sanitizeFilename('my photo (1)! @#$%^.jpg')).toBe('my_photo_1_jpg');
    expect(sanitizeFilename('portrait_8k_vogue.png')).toBe('portrait_8k_vogue_png');
  });

  it('clamps extremely long filenames', () => {
    const longName = 'a'.repeat(120) + '.png';
    const sanitized = sanitizeFilename(longName);
    expect(sanitized.length).toBeLessThanOrEqual(64);
  });

  it('provides safe fallback for empty or null inputs', () => {
    expect(sanitizeFilename('')).toBe('image');
    // @ts-expect-error testing null
    expect(sanitizeFilename(null)).toBe('image');
  });
});

describe('Security Utilities - Prompt Sanitisation', () => {
  it('strips non-printable control characters while preserving newlines and tabs', () => {
    const promptWithControl = "Line 1\x00\x08\r\n\tLine 2 with \x1b[31mcolor";
    const cleaned = sanitizePrompt(promptWithControl);
    expect(cleaned).toContain('Line 1');
    expect(cleaned).toContain('Line 2');
    expect(cleaned).not.toContain('\x00');
    expect(cleaned).not.toContain('\x08');
  });

  it('clamps oversized prompt payloads', () => {
    const hugePrompt = 'A'.repeat(MAX_PROMPT_LENGTH + 500);
    const cleaned = sanitizePrompt(hugePrompt);
    expect(cleaned.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
  });

  it('handles empty or non-string prompts gracefully', () => {
    expect(sanitizePrompt('')).toBe('');
    // @ts-expect-error testing undefined
    expect(sanitizePrompt(undefined)).toBe('');
  });
});
