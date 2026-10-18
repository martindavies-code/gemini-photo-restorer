import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, AlertCircle, Compass } from 'lucide-react';
import { getImageDimensions } from '../services/geminiService';
import type { ImageMetadata } from '../types';
import { validateImageFile } from '../utils/security';
import { SAMPLE_CHALLENGES } from '../constants/samples';

interface DropzoneProps {
  onFilesSelected: (filesWithMeta: Array<{ file: File; metadata: ImageMetadata; previewUrl: string }>) => void;
  disabled?: boolean;
  onOpenSamplesModal?: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFilesSelected,
  disabled,
  onOpenSamplesModal
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearError = () => setUploadError(null);

  const processFiles = async (fileList: FileList | File[]) => {
    clearError();
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    const results: Array<{ file: File; metadata: ImageMetadata; previewUrl: string }> = [];
    const errors: string[] = [];

    for (const file of rawFiles) {
      // Validate file format and size
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      try {
        const dims = await getImageDimensions(previewUrl);
        results.push({
          file,
          previewUrl,
          metadata: {
            name: file.name,
            originalWidth: dims.width,
            originalHeight: dims.height,
            originalSize: file.size,
            mimeType: file.type
          }
        });
      } catch (err) {
        URL.revokeObjectURL(previewUrl); // Cleanup leaked memory
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Corrupt image'}`);
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' | '));
    }

    if (results.length > 0) {
      onFilesSelected(results);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Listen for clipboard paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        processFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled]);

  const handleLoadSpecificSample = (sampleIndex: number) => {
    if (disabled) return;
    clearError();
    const sample = SAMPLE_CHALLENGES[sampleIndex];
    if (sample) {
      const file = sample.generator();
      processFiles([file]);
    }
  };

  return (
    <div className="dropzone-wrapper">
      <div
        className={`dropzone-card ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden-file-input"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
          }}
          disabled={disabled}
        />

        <div className="dropzone-content">
          <div className="dropzone-icon-ring">
            <UploadCloud className="upload-icon" size={32} />
          </div>

          <div className="dropzone-text-group">
            <h3 className="dropzone-title">Drop your low-res or compressed photos</h3>
            <p className="dropzone-sub">
              Supports JPEG, PNG, WEBP (Max 25MB) • Paste with <kbd>Ctrl+V</kbd>
            </p>
          </div>

          <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="browse-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <ImageIcon size={15} />
              <span>Browse Files</span>
            </button>

            <span className="or-divider">or</span>

            <button
              type="button"
              className="sample-btn"
              onClick={() => {
                if (onOpenSamplesModal) {
                  onOpenSamplesModal();
                } else {
                  handleLoadSpecificSample(0);
                }
              }}
              disabled={disabled}
              title="Select a simulated degradation challenge"
            >
              <Sparkles size={15} />
              <span>Try Sample Photo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Test Strip */}
      <div className="quick-sample-strip">
        <span className="strip-label">
          <Compass size={12} className="text-cyan" />
          <span>Quick Challenge Tests:</span>
        </span>
        <div className="strip-buttons">
          <button
            type="button"
            className="strip-tag-btn"
            onClick={() => handleLoadSpecificSample(0)}
            disabled={disabled}
            title="Load 1968 Sepia Archival Portrait"
          >
            1968 Archival Portrait
          </button>
          <button
            type="button"
            className="strip-tag-btn"
            onClick={() => handleLoadSpecificSample(1)}
            disabled={disabled}
            title="Load 360p Compressed Landscape"
          >
            360p JPEG Landscape
          </button>
          <button
            type="button"
            className="strip-tag-btn"
            onClick={() => handleLoadSpecificSample(2)}
            disabled={disabled}
            title="Load Soft Fashion Shot"
          >
            Editorial Vogue Studio
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="dropzone-error-alert">
          <AlertCircle size={15} />
          <span>{uploadError}</span>
          <button className="dismiss-error-btn" onClick={clearError}>×</button>
        </div>
      )}
    </div>
  );
};
