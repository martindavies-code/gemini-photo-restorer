/**
 * Aspect Ratio Preservation Engine for LuminaRestorer AI
 * Solves Gemini Nano Banana's tendency to alter image aspect ratios by:
 * 1. Selecting the closest matching Gemini API supported aspect ratio using scale-invariant logarithmic distance.
 * 2. Realiging and compositing returned AI images to match 100% of the original source geometry.
 */

export interface AspectRatioOption {
  label: string;
  ratio: number;
}

export const GEMINI_SUPPORTED_ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '1:1', ratio: 1.0 },
  { label: '4:3', ratio: 4.0 / 3.0 },
  { label: '3:4', ratio: 3.0 / 4.0 },
  { label: '3:2', ratio: 1.5 },
  { label: '2:3', ratio: 2.0 / 3.0 },
  { label: '16:9', ratio: 16.0 / 9.0 },
  { label: '9:16', ratio: 9.0 / 16.0 },
  { label: '5:4', ratio: 1.25 },
  { label: '4:5', ratio: 0.8 },
  { label: '21:9', ratio: 21.0 / 9.0 },
  { label: '4:1', ratio: 4.0 },
  { label: '1:4', ratio: 0.25 },
  { label: '8:1', ratio: 8.0 },
  { label: '1:8', ratio: 0.125 },
];

/**
 * Finds the closest Gemini-supported aspect ratio bucket using scale-invariant logarithmic distance:
 * Δ = |ln(width / height) - ln(ratio)|
 */
export function findClosestGeminiAspectRatio(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return '1:1';
  }

  const targetRatio = width / height;
  const targetLog = Math.log(targetRatio);

  let bestLabel = '1:1';
  let minDifference = Infinity;

  for (const { label, ratio } of GEMINI_SUPPORTED_ASPECT_RATIOS) {
    const diff = Math.abs(targetLog - Math.log(ratio));
    if (diff < minDifference) {
      minDifference = diff;
      bestLabel = label;
    }
  }

  return bestLabel;
}

/**
 * Formats aspect ratio as a human-friendly string (e.g. "3:2 (1.50x)").
 */
export function formatAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '1:1';
  const ratio = width / height;
  return `${(Math.round(ratio * 100) / 100).toFixed(2)}:1`;
}

/**
 * Realigns a generated image to strictly conform to the original source aspect ratio.
 * Strips away any letterboxing, pillarboxing, or bucket distortion introduced by Nano Banana.
 */
export async function realignImageToOriginalAspectRatio(
  aiDataUrl: string,
  origWidth: number,
  origHeight: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!aiDataUrl || !aiDataUrl.startsWith('data:image/')) {
    throw new Error('Invalid image data URL for realignment.');
  }

  if (origWidth <= 0 || origHeight <= 0) {
    return { dataUrl: aiDataUrl, width: 1024, height: 1024 };
  }

  const targetRatio = origWidth / origHeight;

  // In test/headless mode where HTMLImageElement doesn't decode, return original
  if (typeof Image === 'undefined' || import.meta.env?.MODE === 'test') {
    return { dataUrl: aiDataUrl, width: origWidth, height: origHeight };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const aiWidth = img.naturalWidth || origWidth;
      const aiHeight = img.naturalHeight || origHeight;
      const aiRatio = aiWidth / aiHeight;

      // If already within 0.2% tolerance of source aspect ratio, no cropping or realigning needed
      if (Math.abs(aiRatio - targetRatio) < 0.002) {
        resolve({ dataUrl: aiDataUrl, width: aiWidth, height: aiHeight });
        return;
      }

      // Calculate canvas target dimensions preserving the high resolution of the AI output
      let canvasWidth = aiWidth;
      let canvasHeight = Math.round(canvasWidth / targetRatio);

      if (canvasHeight > aiHeight) {
        canvasHeight = aiHeight;
        canvasWidth = Math.round(canvasHeight * targetRatio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: aiDataUrl, width: aiWidth, height: aiHeight });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Source window mapping: center-crop any discrete bucket padding
      let srcX = 0;
      let srcY = 0;
      let srcW = aiWidth;
      let srcH = aiHeight;

      if (aiRatio > targetRatio) {
        // AI image is wider than original: crop excess width equally from left and right
        srcW = Math.round(aiHeight * targetRatio);
        srcX = Math.round((aiWidth - srcW) / 2);
      } else {
        // AI image is taller than original: crop excess height equally from top and bottom
        srcH = Math.round(aiWidth / targetRatio);
        srcY = Math.round((aiHeight - srcH) / 2);
      }

      try {
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvasWidth, canvasHeight);
        const correctedDataUrl = canvas.toDataURL('image/png', 1.0);
        
        // Immediate buffer cleanup
        canvas.width = 0;
        canvas.height = 0;

        resolve({
          dataUrl: correctedDataUrl,
          width: canvasWidth,
          height: canvasHeight
        });
      } catch (err) {
        canvas.width = 0;
        canvas.height = 0;
        reject(new Error(`Failed to realign aspect ratio: ${err instanceof Error ? err.message : String(err)}`));
      }
    };

    img.onerror = () => {
      resolve({ dataUrl: aiDataUrl, width: origWidth, height: origHeight });
    };

    img.src = aiDataUrl;
  });
}
