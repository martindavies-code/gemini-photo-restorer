import React from 'react';
import { Cpu, Maximize, Sparkles, ChevronDown, Lock } from 'lucide-react';
import type { SupportedModel, UpscaleTarget, RestorationPreset } from '../types';

interface StudioControlBarProps {
  model: SupportedModel;
  onChangeModel: (model: SupportedModel) => void;
  targetScale: UpscaleTarget;
  onChangeTargetScale: (scale: UpscaleTarget) => void;
  selectedPreset: RestorationPreset;
  onOpenPresets: () => void;
  onOpenSamples: () => void;
}

export const StudioControlBar: React.FC<StudioControlBarProps> = ({
  model,
  onChangeModel,
  targetScale,
  onChangeTargetScale,
  selectedPreset,
  onOpenPresets,
  onOpenSamples
}) => {
  return (
    <div className="studio-control-bar">
      <div className="studio-bar-left">
        {/* Preset pill button */}
        <button className="studio-preset-pill" onClick={onOpenPresets} title="Switch Prompt or Edit Rules">
          <div className="preset-indicator-dot"></div>
          <div className="preset-pill-content">
            <span className="pill-eyebrow">Style Recipe</span>
            <span className="pill-main-text">{selectedPreset.name}</span>
          </div>
          <ChevronDown size={14} className="pill-chevron" />
        </button>

        <div className="studio-bar-divider"></div>

        {/* AI Model selector */}
        <div className="studio-control-item">
          <label className="control-item-label">
            <Cpu size={13} className="text-cyan" />
            <span>Synthesis Engine:</span>
          </label>
          <div className="control-select-wrap">
            <select
              value={model}
              onChange={(e) => onChangeModel(e.target.value as SupportedModel)}
              className="studio-bar-select"
            >
              <option value="gemini-3.1-flash-image">Gemini 3.1 Flash (Nano Banana 2 — Flagship)</option>
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (Ultra Fast)</option>
              <option value="gemini-3-pro-image">Gemini 3 Pro (Deep World Knowledge)</option>
            </select>
          </div>
        </div>

        <div className="studio-bar-divider"></div>

        {/* Master Resolution target */}
        <div className="studio-control-item">
          <label className="control-item-label">
            <Maximize size={13} className="text-indigo" />
            <span>Export Master:</span>
          </label>
          <div className="studio-pill-group">
            {(['native', '2x', '4k', '8k'] as UpscaleTarget[]).map((scale) => {
              const isActive = targetScale === scale;
              return (
                <button
                  key={scale}
                  className={`studio-pill-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onChangeTargetScale(scale)}
                  title={`Target Resolution: ${scale.toUpperCase()}`}
                >
                  {scale === 'native' ? 'Native' : scale.toUpperCase()}
                  {scale === '8k' && <span className="pill-super-badge">Ultra</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="studio-bar-right">
        <div
          className="aspect-ratio-lock-badge"
          title="Aspect Ratio Lock active: Reconstructs details while preserving exact original framing with 0% distortion or warping"
        >
          <Lock size={12} className="text-emerald" />
          <span>Aspect Ratio Locked</span>
        </div>
        <button className="sample-challenge-btn" onClick={onOpenSamples} title="Test with simulated degraded photos">
          <Sparkles size={14} className="text-cyan" />
          <span>Test Samples</span>
        </button>
      </div>
    </div>
  );
};
