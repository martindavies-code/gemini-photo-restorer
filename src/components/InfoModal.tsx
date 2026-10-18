import React from 'react';
import { X, CheckCircle2, ShieldCheck, Layers, Sparkles } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-wrap info-icon-wrap">
              <Sparkles size={18} />
            </div>
            <h3>Architecture & Fact Check: How This Works For Free</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="fact-check-grid">
            <div className="fact-card verified">
              <div className="fact-badge">
                <CheckCircle2 size={16} />
                <span>100% Free Tier Verified</span>
              </div>
              <h4>Zero Cost via Google AI Studio</h4>
              <p>
                Google AI Studio provides free developer API keys with personal rate quotas (e.g. 15 requests/minute). You do not need to add a credit card or pay a monthly subscription.
              </p>
            </div>

            <div className="fact-card verified">
              <div className="fact-badge">
                <CheckCircle2 size={16} />
                <span>Multimodal Image Synthesis</span>
              </div>
              <h4>Direct Image-to-Image Processing</h4>
              <p>
                Google&apos;s multimodal models (<code>gemini-3.1-flash-image</code> and <code>gemini-2.5-flash-image</code>) ingest both an image and your detailed photographic prompt, outputting a synthesized restoration without hallucinating generic filters.
              </p>
            </div>

            <div className="fact-card note">
              <div className="fact-badge note-badge">
                <Layers size={16} />
                <span>Resolution Nuance Fact-Check</span>
              </div>
              <h4>How 8K is Achieved</h4>
              <p>
                The neural network natively outputs 1024px to 2048px matrices infused with <strong>8K-grade micro-textures</strong> (pores, fabric weaves, medium-format Phase One depth of field). This app then runs high-fidelity super-sampling to export full <strong>4K UHD</strong> and <strong>8K Master</strong> raster files.
              </p>
            </div>

            <div className="fact-card security">
              <div className="fact-badge security-badge">
                <ShieldCheck size={16} />
                <span>Private & Client-Side</span>
              </div>
              <h4>No Middleman Servers</h4>
              <p>
                Your photos and API key stay on your device. Calls travel directly over HTTPS from your browser to Google&apos;s API endpoint. No external database or intermediate service handles your files.
              </p>
            </div>
          </div>

          <div className="quick-guide-box">
            <h4>Quick Workflow:</h4>
            <ol>
              <li>Click <strong>Connect Free Key</strong> and paste your key from Google AI Studio.</li>
              <li>Drop in your low-quality or compressed photo (or click <em>Try with Sample Image</em>).</li>
              <li>Select your preset (your NatGeo/Vogue prompt is preselected as default).</li>
              <li>Select target export format (Native, 2X, 4K, or 8K Gallery Master).</li>
              <li>Hit <strong>Perform Forensic Restoration</strong> and view the interactive slider!</li>
            </ol>
          </div>
        </div>

        <div className="modal-footer">
          <button className="primary-btn" onClick={onClose}>
            Got it, Let&apos;s Restore Photos
          </button>
        </div>
      </div>
    </div>
  );
};
