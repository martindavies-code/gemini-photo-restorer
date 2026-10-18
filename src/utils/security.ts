/**
 * Security and Sanitisation Utilities for LuminaRestorer AI
 * Compliant with OWASP guidelines: Input Validation, Path Traversal Prevention,
 * Credential Protection, and Resource Exhaustion Mitigation.
 */

// Whitelist of supported and safe raster image MIME types (SVG explicitly excluded due to XSS risk)
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

// Maximum allowable upload file size: 25 MB
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Maximum dimensions to prevent image decompression bombs (OOM vulnerability)
export const MAX_IMAGE_DIMENSION_PX = 10000;

// Maximum prompt length to prevent payload bloat / DoS
export const MAX_PROMPT_LENGTH = 12000;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates Google AI Studio & Gemini API Key format.
 * Supports standard "AIzaSy..." keys, newer "AQ.Ab..." keys, and Google Cloud tokens.
 * Enforces safe ASCII token characters (including dots, hyphens, underscores) to prevent header injection.
 */
export function validateApiKey(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { isValid: false, error: 'API key is required.' };
  }

  const trimmed = key.trim();
  if (trimmed.length < 10 || trimmed.length > 512) {
    return { isValid: false, error: 'API key length is invalid (expected between 10 and 512 characters).' };
  }

  // Allow safe token characters: alphanumeric, hyphens, underscores, dots, colons, plus, equals, slashes, tildes
  // Strictly disallows whitespace, CRLF (\r, \n), and control characters to prevent HTTP header injection
  const safeKeyRegex = /^[A-Za-z0-9_\-.:+=~/]+$/;
  if (!safeKeyRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'API key contains invalid characters or whitespace.'
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes an API key for safe storage and transmission.
 */
export function sanitizeApiKey(key: string): string {
  if (!key || typeof key !== 'string') return '';
  const noTags = key.replace(/<[^>]*>?/gm, '');
  return noTags.trim().replace(/[^A-Za-z0-9_\-.:+=~/]/g, '');
}

/**
 * Validates uploaded file against MIME whitelist and size limits.
 * Explicitly guards against SVG/XML files (CWE-79 / Stored XSS) and decompression bombs (CWE-400).
 */
export function validateImageFile(file: File): ValidationResult {
  if (!file) {
    return { isValid: false, error: 'No file provided.' };
  }

  // Check file size
  if (file.size <= 0) {
    return { isValid: false, error: 'File is empty (0 bytes).' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 25 MB.`
    };
  }

  // Strict MIME type verification (SVG is strictly rejected)
  const mime = file.type.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
    if (mime.includes('svg')) {
      return {
        isValid: false,
        error: 'SVG files are disallowed due to potential embedded script security risks. Please upload JPEG, PNG, or WEBP.'
      };
    }
    return {
      isValid: false,
      error: `Unsupported file type "${file.type || 'unknown'}". Allowed formats: JPEG, PNG, WEBP.`
    };
  }

  return { isValid: true };
}

/**
 * Validates image dimensions to prevent decompression bombs.
 */
export function validateImageDimensions(width: number, height: number): ValidationResult {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { isValid: false, error: 'Image has invalid or zero dimensions.' };
  }
  if (width > MAX_IMAGE_DIMENSION_PX || height > MAX_IMAGE_DIMENSION_PX) {
    return {
      isValid: false,
      error: `Image dimensions (${width}x${height}) exceed the maximum allowable limit of ${MAX_IMAGE_DIMENSION_PX}px.`
    };
  }
  return { isValid: true };
}

/**
 * Sanitizes user-provided filenames to prevent Path Traversal (CWE-22)
 * and Header/Filesystem Injection.
 */
export function sanitizeFilename(filename: string, fallback = 'image'): string {
  if (!filename || typeof filename !== 'string') return fallback;

  // Strip path traversal characters (../, .\, /)
  const clean = filename.replace(/^.*[\\/]/, '');

  // Strip extension
  const lastDot = clean.lastIndexOf('.');
  const baseName = lastDot > 0 ? clean.substring(0, lastDot) : clean;
  const ext = lastDot > 0 ? clean.substring(lastDot + 1) : '';

  // Replace any character not in safe set [A-Za-z0-9_-] with an underscore
  const sanitizedBase = baseName
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim();

  const sanitizedExt = ext ? ext.replace(/[^a-zA-Z0-9]/g, '').trim() : '';

  const finalName = sanitizedExt
    ? (sanitizedBase ? `${sanitizedBase}_${sanitizedExt}` : sanitizedExt)
    : sanitizedBase;

  const clamped = finalName.substring(0, 64) || fallback;
  return clamped;
}

/**
 * Sanitizes text prompt, strips dangerous control characters, and enforces length limits.
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') return '';

  // Remove non-printable control characters except newline and tab
  const stripped = prompt.replace(/[^\x20-\x7E\t\r\n]/g, '');

  // Clamp to maximum allowed prompt length
  return stripped.substring(0, MAX_PROMPT_LENGTH).trim();
}
