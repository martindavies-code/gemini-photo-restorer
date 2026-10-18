export interface RestorationPreset {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  badge?: string;
  prompt: string;
}

export type SupportedModel = 
  | 'gemini-3.1-flash-image'
  | 'gemini-2.5-flash-image'
  | 'gemini-3-pro-image';

export type UpscaleTarget = 'native' | '2x' | '4k' | '8k';

export interface ImageMetadata {
  name: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  mimeType: string;
}

export interface RestorationJob {
  id: string;
  file: File;
  previewUrl: string;
  metadata: ImageMetadata;
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  progressMessage?: string;
  resultDataUrl?: string;
  resultWidth?: number;
  resultHeight?: number;
  processingTimeMs?: number;
  usedModel?: SupportedModel;
  usedPresetId?: string;
  targetScale: UpscaleTarget;
}
