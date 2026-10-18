import React, { useState } from 'react';
import { Camera, User, Mountain, Clock, Edit3, RotateCcw, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { RESTORATION_PRESETS } from '../constants/presets';
import type { RestorationPreset } from '../types';

interface PresetSelectorProps {
  selectedPresetId: string;
  onSelectPreset: (preset: RestorationPreset) => void;
  currentPrompt: string;
  onUpdatePrompt: (newPrompt: string) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  selectedPresetId,
  onSelectPreset,
  currentPrompt,
  onUpdatePrompt
}) => {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isCustomEditing, setIsCustomEditing] = useState(false);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Camera':
        return <Camera size={18} />;
      case 'User':
        return <User size={18} />;
      case 'Mountain':
        return <Mountain size={18} />;
      case 'Clock':
        return <Clock size={18} />;
      default:
        return <Camera size={18} />;
    }
  };

  const handleResetToPreset = () => {
    const preset = RESTORATION_PRESETS.find((p) => p.id === selectedPresetId);
    if (preset) {
      onUpdatePrompt(preset.prompt);
      setIsCustomEditing(false);
    }
  };

  const activePreset = RESTORATION_PRESETS.find((p) => p.id === selectedPresetId) || RESTORATION_PRESETS[0];

  return (
    <div className="preset-selector-card">
      <div className="preset-header">
        <div className="section-title-wrap">
          <h3 className="section-title">Restoration Logic & Style</h3>
          <span className="section-desc">Select photographic discipline or fine-tune prompt</span>
        </div>
        <button
          className="toggle-prompt-btn"
          onClick={() => setIsPromptExpanded(!isPromptExpanded)}
        >
          <span>{isPromptExpanded ? 'Hide Raw Prompt' : 'View / Edit Prompt'}</span>
          {isPromptExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="preset-grid">
        {RESTORATION_PRESETS.map((preset) => {
          const isSelected = preset.id === selectedPresetId;
          return (
            <button
              key={preset.id}
              className={`preset-card ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                onSelectPreset(preset);
                onUpdatePrompt(preset.prompt);
                setIsCustomEditing(false);
              }}
            >
              <div className="preset-card-top">
                <div className="preset-icon-wrap">{getIcon(preset.icon)}</div>
                {preset.badge && <span className="preset-badge">{preset.badge}</span>}
              </div>
              <div className="preset-info">
                <h4 className="preset-name">{preset.name}</h4>
                <p className="preset-tagline">{preset.tagline}</p>
              </div>
            </button>
          );
        })}
      </div>

      {isPromptExpanded && (
        <div className="prompt-editor-panel">
          <div className="prompt-editor-header">
            <div className="prompt-editor-title">
              <Edit3 size={15} />
              <span>Prompt Instruction to Gemini ({activePreset.name})</span>
            </div>
            <div className="prompt-actions">
              <button
                className="reset-prompt-btn"
                onClick={handleResetToPreset}
                title="Reset to default preset prompt"
              >
                <RotateCcw size={13} />
                <span>Reset Prompt</span>
              </button>
            </div>
          </div>
          <textarea
            className="prompt-textarea"
            rows={8}
            value={currentPrompt}
            onChange={(e) => {
              onUpdatePrompt(e.target.value);
              setIsCustomEditing(true);
            }}
            placeholder="Type your AI restoration prompt here..."
          />
          <div className="prompt-footer">
            <span className="token-counter">
              {currentPrompt.length} characters • {currentPrompt.split(/\s+/).filter(Boolean).length} words
            </span>
            {isCustomEditing && (
              <span className="custom-indicator">
                <Check size={13} /> Custom prompt active
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
