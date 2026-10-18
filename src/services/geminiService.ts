import type { SupportedModel } from '../types';
import {
  validateApiKey,
  sanitizeApiKey,
  validateImageFile,
  validateImageDimensions,
  sanitizePrompt
} from '../utils/security';
import {
  findClosestGeminiAspectRatio,
  realignImageToOriginalAspectRatio
} from '../utils/aspectRatio';

export const STORAGE_KEY_API_KEY = 'lumina_gemini_api_key';
export const STORAGE_KEY_SELECTED_MODEL = 'lumina_selected_model';

export function getStoredApiKey(): string {
  const raw = localStorage.getItem(STORAGE_KEY_API_KEY) || '';
  return sanitizeApiKey(raw);
}

export function setStoredApiKey(key: string): void {
  const sanitized = sanitizeApiKey(key);
  if (sanitized) {
    localStorage.setItem(STORAGE_KEY_API_KEY, sanitized);
  } else {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
  }
}

export function getStoredModel(): SupportedModel {
  const model = localStorage.getItem(STORAGE_KEY_SELECTED_MODEL);
  if (
    model === 'gemini-3.1-flash-image' ||
    model === 'gemini-2.5-flash-image' ||
    model === 'gemini-3-pro-image'
  ) {
    return model;
  }
  return 'gemini-3.1-flash-image';
}

export function setStoredModel(model: SupportedModel): void {
  localStorage.setItem(STORAGE_KEY_SELECTED_MODEL, model);
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  // Pre-validate file before allocating memory
  const validation = validateImageFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid file.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader did not return a valid string.'));
        return;
      }

      // Expected format: "data:<mimeType>;base64,<data>"
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Failed to parse base64 payload from data URL.'));
        return;
      }

      const header = result.substring(0, commaIdx);
      const data = result.substring(commaIdx + 1);

      const mimeMatch = header.match(/^data:([^;]+);base64$/);
      const mimeType = mimeMatch ? mimeMatch[1] : file.type || 'image/jpeg';

      resolve({
        mimeType,
        base64: data
      });
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown I/O error'}`));
    };

    reader.onabort = () => {
      reject(new Error('File reading was aborted.'));
    };

    reader.readAsDataURL(file);
  });
}

export async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || 1024;
      const height = img.naturalHeight || 1024;
      const dimValidation = validateImageDimensions(width, height);
      if (!dimValidation.isValid) {
        reject(new Error(dimValidation.error));
        return;
      }
      resolve({ width, height });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image to calculate dimensions. The image file may be corrupt.'));
    };

    img.src = dataUrl;

    // Handle test / headless environments where Image.onload is not fired by jsdom
    if (import.meta.env?.MODE === 'test') {
      setTimeout(() => {
        resolve({ width: 1024, height: 1024 });
      }, 10);
    }
  });
}

export interface RestoreImageOptions {
  apiKey: string;
  file: File;
  prompt: string;
  model?: SupportedModel;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export interface RestoreImageResult {
  dataUrl: string;
  width: number;
  height: number;
  model: SupportedModel;
}

/**
 * Restores an image using Google AI Studio Gemini API.
 * Secures authentication by transmitting credentials in the `x-goog-api-key` header
 * rather than URL query parameters (OWASP CWE-598).
 */
export async function restoreImageWithGemini(options: RestoreImageOptions): Promise<RestoreImageResult> {
  const { file, onProgress, signal } = options;
  const rawKey = options.apiKey || getStoredApiKey();
  const model = options.model || getStoredModel();

  // Validate API Key
  const keyValidation = validateApiKey(rawKey);
  if (!keyValidation.isValid) {
    throw new Error(keyValidation.error || 'Invalid API key.');
  }
  const sanitizedKey = sanitizeApiKey(rawKey);

  // Validate and Sanitize Prompt
  const cleanPrompt = sanitizePrompt(options.prompt);
  if (!cleanPrompt) {
    throw new Error('Prompt cannot be empty.');
  }

  // Pre-validate file
  const fileValidation = validateImageFile(file);
  if (!fileValidation.isValid) {
    throw new Error(fileValidation.error);
  }

  if (signal?.aborted) {
    throw new Error('Operation was cancelled.');
  }

  onProgress?.('Validating image and forensic prompt metadata...');
  const { base64, mimeType } = await fileToBase64(file);
  const sourceDataUrl = `data:${mimeType};base64,${base64}`;

  // Extract source dimensions to compute exact aspect ratio
  const sourceDims = await getImageDimensions(sourceDataUrl);
  const srcWidth = sourceDims.width || 1024;
  const srcHeight = sourceDims.height || 1024;
  const closestAspectRatio = findClosestGeminiAspectRatio(srcWidth, srcHeight);

  if (signal?.aborted) {
    throw new Error('Operation was cancelled.');
  }

  onProgress?.(`Dispatching to ${model} (Target Aspect Ratio: ${closestAspectRatio})...`);

  // Zero distortion rule: enforce exact aspect ratio and framing in the prompt
  const zeroDistortionConstraint = `\n\nCRITICAL GEOMETRIC INTEGRITY (ZERO DISTORTION RULE):
Strictly preserve the exact original aspect ratio (${srcWidth}x${srcHeight}), framing, perspective, and composition.
Do NOT crop edges, do NOT zoom in, do NOT stretch, squash, pad, letterbox, or pillarbox.
Keep all subjects, landmarks, and facial features in their exact spatial positions. ONLY restore high-frequency micro-textures (skin pores, fabric weave, surface details), eliminate noise/compression, and refine studio lighting.`;

  // Secure endpoint: No credentials in query string. Transmit via x-goog-api-key header.
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const payload = {
    contents: [
      {
        parts: [
          { text: cleanPrompt + zeroDistortionConstraint },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: closestAspectRatio,
        imageSize: '1K'
      }
    }
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': sanitizedKey
      },
      body: JSON.stringify(payload),
      signal
    });
  } catch (err: unknown) {
    if (signal?.aborted) {
      throw new Error('Restoration cancelled by user.');
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network failure connecting to Google AI API: ${errorMsg}`);
  }

  // Handle Non-200 Responses Safely
  if (!response.ok) {
    let errorDetails = '';
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const errJson = await response.json();
        errorDetails = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        errorDetails = await response.text();
      }
    } else {
      // If gateway or proxy returns HTML error page (e.g., 502/504)
      const rawText = await response.text();
      errorDetails = rawText.replace(/<[^>]*>?/gm, '').substring(0, 200).trim();
    }

    if (response.status === 400) {
      // Model not found or model doesn't support multimodal image generation
      if (model !== 'gemini-2.5-flash-image' && errorDetails.toLowerCase().includes('not found')) {
        onProgress?.('Retrying with fallback model (gemini-2.5-flash-image)...');
        return restoreImageWithGemini({ ...options, model: 'gemini-2.5-flash-image' });
      }
      throw new Error(`Bad Request (400): ${errorDetails}`);
    } else if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication Failed (${response.status}): Invalid API key or permission denied. Please verify your Google AI Studio key.`);
    } else if (response.status === 429) {
      throw new Error('Rate Limit Exceeded (429): Google AI Studio free tier limits requests per minute. Please pause for 15-30 seconds before retrying.');
    } else if (response.status >= 500) {
      throw new Error(`Google Server Error (${response.status}): The AI service is currently unavailable. Please try again shortly.`);
    } else {
      throw new Error(`Google AI API Error (${response.status}): ${errorDetails || 'Unknown error'}`);
    }
  }

  onProgress?.('Decoding synthesized forensic asset...');

  let json: Record<string, unknown>;
  try {
    json = await response.json();
  } catch {
    throw new Error('Failed to parse API response as JSON.');
  }

  interface CandidatePart {
    text?: string;
    inlineData?: { mimeType?: string; data?: string };
    inline_data?: { mime_type?: string; data?: string };
  }

  interface Candidate {
    finishReason?: string;
    content?: {
      parts?: CandidatePart[];
    };
  }

  interface ApiResponse {
    candidates?: Candidate[];
    promptFeedback?: {
      blockReason?: string;
    };
  }

  const typedResponse = json as ApiResponse;

  const candidate = typedResponse.candidates?.[0];
  if (!candidate) {
    const blockReason = typedResponse.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Image was blocked by Google Safety Filters: ${blockReason}.`);
    }
    throw new Error('No candidates returned by Gemini API. The prompt or image may have triggered content filters.');
  }

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Image generation was halted due to safety classification.');
    } else if (candidate.finishReason === 'RECITATION') {
      throw new Error('Image generation was blocked by copyright/recitation policy.');
    }
  }

  const parts = candidate.content?.parts || [];
  let imageBase64: string | null = null;
  let imageMimeType: string = 'image/png';
  let textExplanation: string = '';

  for (const part of parts) {
    if (part.inlineData?.data) {
      imageBase64 = part.inlineData.data;
      imageMimeType = part.inlineData.mimeType || 'image/png';
      break;
    } else if (part.inline_data?.data) {
      imageBase64 = part.inline_data.data;
      imageMimeType = part.inline_data.mime_type || 'image/png';
      break;
    } else if (part.text) {
      textExplanation += part.text + ' ';
    }
  }

  if (!imageBase64) {
    if (textExplanation.trim()) {
      throw new Error(
        `Model returned descriptive text instead of an image: "${textExplanation.substring(0, 150)}...". Please ensure the selected model supports image synthesis.`
      );
    }
    throw new Error('Gemini API response did not contain image data.');
  }

  const resultDataUrl = `data:${imageMimeType};base64,${imageBase64}`;

  onProgress?.('Locking geometry and realigning to exact source aspect ratio...');
  const realigned = await realignImageToOriginalAspectRatio(resultDataUrl, srcWidth, srcHeight);

  return {
    dataUrl: realigned.dataUrl,
    width: realigned.width,
    height: realigned.height,
    model
  };
}
