import type { UpscaleTarget } from '../types';
import { sanitizeFilename } from '../utils/security';

export interface ExportDimensions {
  width: number;
  height: number;
  scaleLabel: string;
}

// Safety clamp to prevent browser canvas memory exhaustion (OOM crash)
export const MAX_CANVAS_DIMENSION = 8192;

/**
 * Calculates target export dimensions with division-by-zero guards
 * and canvas memory limit enforcement.
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  target: UpscaleTarget
): ExportDimensions {
  // Validate and sanitize dimensions
  const safeWidth = Number.isFinite(origWidth) && origWidth > 0 ? Math.round(origWidth) : 1024;
  const safeHeight = Number.isFinite(origHeight) && origHeight > 0 ? Math.round(origHeight) : 1024;
  const aspectRatio = safeWidth / safeHeight;

  let width: number;
  let height: number;
  let scaleLabel: string;

  switch (target) {
    case '2x':
      width = Math.min(Math.round(safeWidth * 2), MAX_CANVAS_DIMENSION);
      height = Math.min(Math.round(safeHeight * 2), MAX_CANVAS_DIMENSION);
      scaleLabel = '2X Enhanced';
      break;

    case '4k': {
      let targetWidth = 3840;
      let targetHeight = 2160;
      if (aspectRatio >= 1) {
        targetWidth = 3840;
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        targetHeight = 3840;
        targetWidth = Math.round(targetHeight * aspectRatio);
      }
      width = Math.min(targetWidth, MAX_CANVAS_DIMENSION);
      height = Math.min(targetHeight, MAX_CANVAS_DIMENSION);
      scaleLabel = '4K Ultra HD';
      break;
    }

    case '8k': {
      let targetWidth = 7680;
      let targetHeight = 4320;
      if (aspectRatio >= 1) {
        targetWidth = 7680;
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        targetHeight = 7680;
        targetWidth = Math.round(targetHeight * aspectRatio);
      }
      width = Math.min(targetWidth, MAX_CANVAS_DIMENSION);
      height = Math.min(targetHeight, MAX_CANVAS_DIMENSION);
      scaleLabel = '8K Gallery Master';
      break;
    }

    case 'native':
    default:
      width = Math.min(safeWidth, MAX_CANVAS_DIMENSION);
      height = Math.min(safeHeight, MAX_CANVAS_DIMENSION);
      scaleLabel = 'Native AI Output';
      break;
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
    scaleLabel
  };
}

/**
 * Super-samples and renders the restored image onto a high-fidelity canvas.
 * Manages memory by explicitly freeing canvas buffers upon completion.
 */
export async function renderToTargetResolution(
  sourceDataUrl: string,
  target: UpscaleTarget,
  originalDimensions?: { width: number; height: number }
): Promise<{ blob: Blob; width: number; height: number; dataUrl: string }> {
  if (!sourceDataUrl || !sourceDataUrl.startsWith('data:image/')) {
    throw new Error('Invalid or empty image data URL provided for upscaling.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const baseWidth = originalDimensions?.width && originalDimensions.width > 0
        ? originalDimensions.width
        : (img.naturalWidth || 1024);
      const baseHeight = originalDimensions?.height && originalDimensions.height > 0
        ? originalDimensions.height
        : (img.naturalHeight || 1024);

      const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
        baseWidth,
        baseHeight,
        target
      );

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Free canvas memory
        canvas.width = 0;
        canvas.height = 0;
        reject(new Error('Failed to acquire 2D rendering context (Canvas memory exhaustion).'));
        return;
      }

      // High-quality bicubic interpolation
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      try {
        const targetRatio = targetWidth / targetHeight;
        const imgRatio = (img.naturalWidth || targetWidth) / (img.naturalHeight || targetHeight);

        // Sub-pixel geometric alignment: prevent stretching if AI output has discrete bucket padding
        if (Math.abs(targetRatio - imgRatio) > 0.005) {
          let srcX = 0;
          let srcY = 0;
          let srcW = img.naturalWidth;
          let srcH = img.naturalHeight;

          if (imgRatio > targetRatio) {
            srcW = Math.round(img.naturalHeight * targetRatio);
            srcX = Math.round((img.naturalWidth - srcW) / 2);
          } else {
            srcH = Math.round(img.naturalWidth / targetRatio);
            srcY = Math.round((img.naturalHeight - srcH) / 2);
          }
          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetWidth, targetHeight);
        } else {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        }
      } catch (drawErr) {
        canvas.width = 0;
        canvas.height = 0;
        reject(new Error(`Canvas draw failure: ${drawErr instanceof Error ? drawErr.message : String(drawErr)}`));
        return;
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            canvas.width = 0;
            canvas.height = 0;
            reject(new Error('Canvas toBlob conversion failed.'));
            return;
          }

          let outDataUrl: string;
          try {
            outDataUrl = canvas.toDataURL('image/png', 1.0);
          } catch {
            outDataUrl = URL.createObjectURL(blob);
          }

          // Immediately release canvas backing memory
          canvas.width = 0;
          canvas.height = 0;

          resolve({
            blob,
            width: targetWidth,
            height: targetHeight,
            dataUrl: outDataUrl
          });
        },
        'image/png',
        1.0
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for canvas upscaling. Corrupt image source.'));
    };

    img.src = sourceDataUrl;
  });
}

/**
 * Downloads an image with sanitized filename to prevent Path Traversal (CWE-22).
 */
export function downloadImage(dataUrl: string, rawFilename: string): void {
  const safeName = sanitizeFilename(rawFilename, 'restored_image.png');
  const finalFilename = safeName.endsWith('.png') ? safeName : `${safeName}.png`;

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = finalFilename;
  link.rel = 'noopener noreferrer';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // If dataUrl was a blob URL created by createObjectURL, revoke it shortly after
  if (dataUrl.startsWith('blob:')) {
    setTimeout(() => {
      URL.revokeObjectURL(dataUrl);
    }, 1000);
  }
}
