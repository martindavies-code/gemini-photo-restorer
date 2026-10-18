import { X, Sparkles, ArrowRight } from 'lucide-react';
import { SAMPLE_CHALLENGES, type SampleChallenge } from '../constants/samples';

interface SampleChallengesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (challenge: SampleChallenge) => void;
}

export const SampleChallengesModal: React.FC<SampleChallengesModalProps> = ({
  isOpen,
  onClose,
  onSelectSample
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-wrap">
              <Sparkles size={18} className="text-cyan" />
            </div>
            <div>
              <h3>Choose a Degradation Test Scenario</h3>
              <p className="modal-subtitle-text">Test the 8K Phase One forensic restoration engine immediately</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="sample-grid">
            {SAMPLE_CHALLENGES.map((sample) => (
              <div
                key={sample.id}
                className="sample-challenge-card"
                onClick={() => {
                  onSelectSample(sample);
                  onClose();
                }}
              >
                <div className="sample-card-header">
                  <span className="sample-category-badge">{sample.category}</span>
                  <span className="sample-defect-badge">{sample.badge}</span>
                </div>
                <h4 className="sample-title">{sample.title}</h4>
                <p className="sample-desc">{sample.subtitle}</p>

                <div className="sample-card-action">
                  <span>Load into Studio</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
