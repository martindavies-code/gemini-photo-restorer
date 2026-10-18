import React, { useState } from 'react';
import { X, Key, ExternalLink, ShieldCheck, Check, Cpu, AlertTriangle } from 'lucide-react';
import type { SupportedModel } from '../types';
import { validateApiKey, sanitizeApiKey } from '../utils/security';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  model: SupportedModel;
  onChangeModel: (model: SupportedModel) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  model,
  onChangeModel
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [selectedModel, setSelectedModel] = useState<SupportedModel>(model);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setValidationError(null);
    const trimmed = inputKey.trim();

    if (trimmed) {
      const validation = validateApiKey(trimmed);
      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid API key format.');
        return;
      }
    }

    const sanitized = sanitizeApiKey(trimmed);
    onSaveApiKey(sanitized);
    onChangeModel(selectedModel);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setInputKey('');
    setValidationError(null);
    onSaveApiKey('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-wrap">
              <Key size={18} />
            </div>
            <h3>Google AI Studio Configuration</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="alert-free-box">
            <div className="alert-icon">
              <ShieldCheck size={20} className="text-emerald" />
            </div>
            <div className="alert-content">
              <strong>Zero-Cost &amp; Billing Safety Guide</strong>
              <p style={{ marginTop: '0.3rem', lineHeight: '1.4' }}>
                <strong>• Client-Side Super-Scaler (1X, 2X, 4K, 8K):</strong> 100% Free ($0.00). Renders entirely in your browser using your local GPU/CPU.
              </p>
              <p style={{ marginTop: '0.3rem', lineHeight: '1.4' }}>
                <strong>• Google AI Studio Key:</strong> If your key is from a project with <em>no credit card or billing account attached</em>, Google can never charge you. If you have linked a payment method in Google Cloud, Google bills ~$0.039 per generated image output.
              </p>
              <p style={{ marginTop: '0.4rem', color: '#38bdf8', fontSize: '0.82rem' }}>
                💡 <em>To guarantee $0 charges: Ensure your API key is in a project with no linked billing account in Google Cloud Console.</em>
              </p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="get-key-link"
              >
                <span>Manage Keys at aistudio.google.com</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="api-key-input">Gemini API Key</label>
            <div className="input-wrapper">
              <input
                id="api-key-input"
                type="password"
                placeholder="Paste your Gemini API key (e.g. AIza... or AQ.Ab...)"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setValidationError(null);
                }}
                className={`text-input ${validationError ? 'input-error' : ''}`}
              />
              {inputKey && (
                <button className="clear-input-btn" onClick={handleClear} title="Clear Key">
                  Clear
                </button>
              )}
            </div>
            {validationError ? (
              <p className="validation-error-text">
                <AlertTriangle size={13} />
                <span>{validationError}</span>
              </p>
            ) : (
              <p className="field-hint">
                Accepts all Google AI Studio &amp; Gemini API keys (including <code>AIza...</code> and <code>AQ.Ab...</code> formats). Your key is strictly kept in local browser memory and sent securely via <code>x-goog-api-key</code> headers.
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="model-select">
              <span className="label-with-icon">
                <Cpu size={15} />
                <span>Multimodal Restoration Model</span>
              </span>
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as SupportedModel)}
              className="select-input"
            >
              <option value="gemini-3.1-flash-image">gemini-3.1-flash-image (Flagship Nano Banana 2 — Recommended)</option>
              <option value="gemini-2.5-flash-image">gemini-2.5-flash-image (High Speed & Reliability)</option>
              <option value="gemini-3-pro-image">gemini-3-pro-image (High Precision World Knowledge)</option>
            </select>
            <p className="field-hint">
              Uses image-to-image synthesis to analyze micro-textures and regenerate authentic details.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleSave}>
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save & Connect</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
