import React, { useState, useRef, useCallback } from 'react';
import {
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Clock,
  ArrowRight,
  Columns,
  Eye,
  SlidersHorizontal,
  ShieldCheck
} from 'lucide-react';
import type { RestorationJob, UpscaleTarget } from '../types';
import {
  renderToTargetResolution,
  downloadImage,
  calculateTargetDimensions
} from '../services/upscaleCanvasService';

interface ComparisonSliderProps {
  job: RestorationJob;
  onUpdateTargetScale: (jobId: string, scale: UpscaleTarget) => void;
}

type ViewMode = 'split' | 'side-by-side' | 'toggle';

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ job, onUpdateTargetScale }) => {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Use HTML5 Pointer Capture for leak-free, high-performance slider tracking
  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.round((x / rect.width) * 1000) / 10;
    setSliderPos(percentage);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'split') return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || viewMode !== 'split') return;
    updatePosition(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may have already been released
      }
    }
  };

  const handleDownload = async () => {
    if (!job.resultDataUrl) return;
    setIsExporting(true);
    try {
      const { dataUrl, width, height } = await renderToTargetResolution(
        job.resultDataUrl,
        job.targetScale
      );
      const cleanName = job.metadata.name.replace(/\.[^/.]+$/, '');
      const scaleTag = job.targetScale.toUpperCase();
      downloadImage(dataUrl, `${cleanName}_${scaleTag}_restored_${width}x${height}.png`);
    } catch (err) {
      console.error('Download export failed:', err);
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const originalDims = `${job.metadata.originalWidth} × ${job.metadata.originalHeight}`;
  const targetDims =
    job.resultWidth && job.resultHeight
      ? calculateTargetDimensions(job.resultWidth, job.resultHeight, job.targetScale)
      : null;

  return (
    <div className={`comparison-viewer-card ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Studio Header Toolbar */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          {/* View Mode Switcher */}
          <div className="view-mode-tabs">
            <button
              className={`view-mode-tab ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Interactive Split Slider"
            >
              <SlidersHorizontal size={13} />
              <span>Split Slider</span>
            </button>
            <button
              className={`view-mode-tab ${viewMode === 'side-by-side' ? 'active' : ''}`}
              onClick={() => setViewMode('side-by-side')}
              title="Side-by-Side Dual View"
            >
              <Columns size={13} />
              <span>Side-by-Side</span>
            </button>
            <button
              className={`view-mode-tab ${viewMode === 'toggle' ? 'active' : ''}`}
              onClick={() => setViewMode('toggle')}
              title="Hold to Flash Original Source"
            >
              <Eye size={13} />
              <span>Quick Flash</span>
            </button>
          </div>

          <div className="meta-badge-group">
            <div className="meta-badge">
              <span className="meta-label">Original:</span>
              <span className="meta-value">{originalDims} px</span>
            </div>
            <ArrowRight size={12} className="text-muted" />
            <div className="meta-badge highlight-badge">
              <Sparkles size={13} className="text-cyan" />
              <span className="meta-label">8K Output:</span>
              <span className="meta-value">
                {targetDims ? `${targetDims.width} × ${targetDims.height} px` : 'Processing...'}
              </span>
            </div>
            {job.processingTimeMs && (
              <div className="meta-badge latency-badge">
                <Clock size={12} />
                <span>{(job.processingTimeMs / 1000).toFixed(1)}s</span>
              </div>
            )}
          </div>
        </div>

        <div className="toolbar-right">
          {/* Target Resolution Selector */}
          <div className="scale-selector-group">
            <span className="scale-label-tag">Export Scale:</span>
            {(['native', '2x', '4k', '8k'] as UpscaleTarget[]).map((scale) => (
              <button
                key={scale}
                className={`scale-btn ${job.targetScale === scale ? 'active' : ''}`}
                onClick={() => onUpdateTargetScale(job.id, scale)}
                title={`Export at ${scale.toUpperCase()} resolution`}
              >
                {scale === 'native' ? '1X' : scale.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="zoom-btn-group">
            <button
              className="icon-tool-btn"
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="zoom-percent">{Math.round(zoomLevel * 100)}%</span>
            <button
              className="icon-tool-btn"
              onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
              title="Zoom In (Macro Inspection)"
            >
              <ZoomIn size={15} />
            </button>
            {zoomLevel !== 1 && (
              <button
                className="icon-tool-btn"
                onClick={() => setZoomLevel(1)}
                title="Reset Zoom (Fit)"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>

          <button
            className="icon-tool-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen Studio'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            className="download-action-btn"
            onClick={handleDownload}
            disabled={isExporting}
          >
            <Download size={15} />
            <span>{isExporting ? 'Rendering...' : `Export ${job.targetScale.toUpperCase()}`}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      {viewMode === 'side-by-side' ? (
        <div className="side-by-side-container">
          <div className="side-panel">
            <div className="side-panel-header">
              <span className="side-tag original-tag">Original Low-Res Source</span>
              <span className="side-meta">{originalDims}</span>
            </div>
            <div className="side-image-wrapper" style={{ transform: `scale(${zoomLevel})` }}>
              <img src={job.previewUrl} alt="Original" className="slider-image" draggable={false} />
            </div>
          </div>

          <div className="side-panel">
            <div className="side-panel-header">
              <span className="side-tag restored-tag">
                <Sparkles size={12} />
                <span>Forensic 8K Reconstructed</span>
              </span>
              <span className="side-meta text-cyan">{targetDims?.width} × {targetDims?.height}</span>
            </div>
            <div className="side-image-wrapper" style={{ transform: `scale(${zoomLevel})` }}>
              <img src={job.resultDataUrl} alt="Restored" className="slider-image" draggable={false} />
            </div>
          </div>
        </div>
      ) : viewMode === 'toggle' ? (
        <div className="toggle-view-container">
          <div className="toggle-image-wrapper" style={{ transform: `scale(${zoomLevel})` }}>
            <img
              src={isHoldingOriginal ? job.previewUrl : job.resultDataUrl}
              alt="Comparison"
              className="slider-image"
              draggable={false}
            />
          </div>
          <div className="toggle-hold-overlay">
            <button
              className={`hold-flash-btn ${isHoldingOriginal ? 'active' : ''}`}
              onMouseDown={() => setIsHoldingOriginal(true)}
              onMouseUp={() => setIsHoldingOriginal(false)}
              onMouseLeave={() => setIsHoldingOriginal(false)}
              onTouchStart={() => setIsHoldingOriginal(true)}
              onTouchEnd={() => setIsHoldingOriginal(false)}
            >
              <Eye size={16} />
              <span>{isHoldingOriginal ? 'Viewing Original Source' : 'Press & Hold to Flash Original'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Default Split Slider View */
        <div
          ref={containerRef}
          className="split-slider-container"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="slider-zoom-wrapper"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {/* Base Layer: Original Source */}
            <div className="layer-original">
              <img
                src={job.previewUrl}
                alt="Original Compressed Source"
                className="slider-image"
                draggable={false}
              />
              <div className="layer-tag tag-left">Original (Low-Res)</div>
            </div>

            {/* Top Layer: Restored Asset with Dynamic Polygon Clip Path */}
            {job.resultDataUrl && (
              <div
                className="layer-restored"
                style={{
                  clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`
                }}
              >
                <img
                  src={job.resultDataUrl}
                  alt="AI Reconstructed Asset"
                  className="slider-image"
                  draggable={false}
                />
                <div className="layer-tag tag-right">
                  <Sparkles size={12} />
                  <span>{job.targetScale.toUpperCase()} Forensic Restoration</span>
                </div>
              </div>
            )}

            {/* Interactive Split Divider */}
            <div
              className="slider-divider"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="slider-handle">
                <span className="slider-handle-arrow">&lt;</span>
                <div className="slider-handle-line"></div>
                <span className="slider-handle-arrow">&gt;</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forensic Telemetry & Status Footer */}
      <div className="viewer-footer-info">
        <div className="footer-left">
          <span className="hint-text">
            Drag the divider to compare • Zoom up to 400% to inspect epidermal skin pores & fabric weaves.
          </span>
        </div>
        <div className="footer-right">
          <div className="synthid-badge" title="Watermarked with SynthID for AI provenance">
            <ShieldCheck size={12} className="text-emerald" />
            <span>SynthID Authentic</span>
          </div>
          <div className="camera-spec-pill">
            <span>Phase One Medium Format • f/2.8 Prime Emulation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
