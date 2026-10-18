import React from 'react';
import { Sparkles, Key, CheckCircle, AlertCircle, ExternalLink, HelpCircle, Cpu } from 'lucide-react';
import type { SupportedModel } from '../types';

interface HeaderProps {
  hasApiKey: boolean;
  currentModel: SupportedModel;
  onOpenApiKeyModal: () => void;
  onOpenInfoModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasApiKey,
  currentModel,
  onOpenApiKeyModal,
  onOpenInfoModal
}) => {
  const modelShortName = currentModel.replace('gemini-', '').replace('-image', '');

  return (
    <header className="lumina-header">
      <div className="header-left">
        <div className="brand-logo">
          <div className="logo-icon-wrap">
            <Sparkles className="logo-sparkle" size={22} />
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">LuminaRestorer</h1>
              <span className="brand-badge">8K STUDIO</span>
            </div>
            <p className="brand-subtitle">Forensic Micro-Texture & Medium Format Upscaling</p>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="engine-pill" title="Active Google AI Studio Multimodal Model">
          <Cpu size={13} className="text-cyan" />
          <span className="engine-label">{modelShortName}</span>
        </div>

        <div className="tier-tag">
          <span className="tier-dot"></span>
          <span>100% Free Tier</span>
        </div>

        <button 
          className={`api-key-btn ${hasApiKey ? 'key-configured' : 'key-missing'}`}
          onClick={onOpenApiKeyModal}
          title="Configure Google AI Studio API Key"
        >
          <Key size={15} />
          {hasApiKey ? (
            <>
              <CheckCircle size={14} className="text-emerald" />
              <span>Key Active</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} className="text-amber" />
              <span>Connect Free Key</span>
            </>
          )}
        </button>

        <button 
          className="icon-btn" 
          onClick={onOpenInfoModal}
          title="Architecture, Limits & Fact-Check"
        >
          <HelpCircle size={17} />
        </button>

        <a 
          href="https://aistudio.google.com/app/apikey" 
          target="_blank" 
          rel="noreferrer"
          className="studio-link"
          title="Open Google AI Studio in new tab"
        >
          <span>Get Key</span>
          <ExternalLink size={13} />
        </a>
      </div>
    </header>
  );
};
