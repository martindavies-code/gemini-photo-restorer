import React from 'react';
import {
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  Download,
  Sparkles,
  Layers,
  XCircle
} from 'lucide-react';
import type { RestorationJob } from '../types';
import { downloadImage } from '../services/upscaleCanvasService';

interface BatchQueueProps {
  jobs: RestorationJob[];
  activeJobId: string | null;
  onSelectActiveJob: (id: string) => void;
  onProcessJob: (id: string) => void;
  onCancelJob: (id: string) => void;
  onProcessAll: () => void;
  onRemoveJob: (id: string) => void;
  onClearCompleted: () => void;
  isAnyProcessing: boolean;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({
  jobs,
  activeJobId,
  onSelectActiveJob,
  onProcessJob,
  onCancelJob,
  onProcessAll,
  onRemoveJob,
  onClearCompleted,
  isAnyProcessing
}) => {
  if (jobs.length === 0) return null;

  const pendingCount = jobs.filter((j) => j.status === 'idle').length;
  const completedCount = jobs.filter((j) => j.status === 'done').length;

  return (
    <div className="queue-card">
      <div className="queue-header">
        <div className="queue-title-row">
          <Layers size={18} className="text-cyan" />
          <h3 className="queue-title">Batch Queue & Gallery</h3>
          <span className="queue-count-badge">{jobs.length} items</span>
        </div>

        <div className="queue-actions-row">
          {pendingCount > 0 && (
            <button
              className="queue-batch-btn"
              onClick={onProcessAll}
              disabled={isAnyProcessing}
            >
              <Sparkles size={15} />
              <span>Restore All Pending ({pendingCount})</span>
            </button>
          )}

          {completedCount > 0 && (
            <button
              className="clear-completed-btn"
              onClick={onClearCompleted}
              disabled={isAnyProcessing}
            >
              <span>Clear Finished</span>
            </button>
          )}
        </div>
      </div>

      <div className="queue-list">
        {jobs.map((job) => {
          const isActive = job.id === activeJobId;
          return (
            <div
              key={job.id}
              className={`queue-item ${isActive ? 'active-item' : ''} status-${job.status}`}
              onClick={() => onSelectActiveJob(job.id)}
            >
              <div className="queue-thumb-wrap">
                <img
                  src={job.resultDataUrl || job.previewUrl}
                  alt={job.metadata.name}
                  className="queue-thumb"
                />
                {job.status === 'done' && (
                  <span className="thumb-done-badge" title="Restoration complete">
                    <CheckCircle2 size={12} />
                  </span>
                )}
              </div>

              <div className="queue-item-info">
                <div className="queue-item-name-row">
                  <span className="queue-item-name" title={job.metadata.name}>
                    {job.metadata.name}
                  </span>
                  <span className="queue-item-res">
                    {job.metadata.originalWidth} × {job.metadata.originalHeight}
                  </span>
                </div>

                <div className="queue-item-status-row">
                  {job.status === 'idle' && (
                    <span className="status-badge status-idle">Ready to restore</span>
                  )}
                  {job.status === 'processing' && (
                    <span className="status-badge status-processing">
                      <RotateCw size={12} className="spin-icon" />
                      <span>{job.progressMessage || 'Synthesizing with Gemini...'}</span>
                    </span>
                  )}
                  {job.status === 'done' && (
                    <span className="status-badge status-done">
                      <CheckCircle2 size={12} />
                      <span>
                        Restored ({job.resultWidth}×{job.resultHeight}) •{' '}
                        {job.processingTimeMs ? `${(job.processingTimeMs / 1000).toFixed(1)}s` : ''}
                      </span>
                    </span>
                  )}
                  {job.status === 'error' && (
                    <span className="status-badge status-error" title={job.errorMessage}>
                      <AlertTriangle size={12} />
                      <span>{job.errorMessage || 'Failed'}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="queue-item-actions" onClick={(e) => e.stopPropagation()}>
                {job.status === 'idle' && (
                  <button
                    className="item-action-btn primary-icon-btn"
                    onClick={() => onProcessJob(job.id)}
                    disabled={isAnyProcessing}
                    title="Start restoration on this photo"
                  >
                    <Play size={14} />
                  </button>
                )}

                {job.status === 'processing' && (
                  <button
                    className="item-action-btn cancel-icon-btn"
                    onClick={() => onCancelJob(job.id)}
                    title="Cancel processing"
                  >
                    <XCircle size={14} />
                  </button>
                )}

                {job.status === 'error' && (
                  <button
                    className="item-action-btn retry-icon-btn"
                    onClick={() => onProcessJob(job.id)}
                    disabled={isAnyProcessing}
                    title="Retry restoration"
                  >
                    <RotateCw size={14} />
                  </button>
                )}

                {job.status === 'done' && (
                  <>
                    <button
                      className="item-action-btn"
                      onClick={() => onSelectActiveJob(job.id)}
                      title="Inspect in comparison slider"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      className="item-action-btn"
                      onClick={() => {
                        if (job.resultDataUrl) {
                          downloadImage(job.resultDataUrl, `restored_${job.metadata.name}`);
                        }
                      }}
                      title="Quick download"
                    >
                      <Download size={14} />
                    </button>
                  </>
                )}

                <button
                  className="item-action-btn delete-icon-btn"
                  onClick={() => onRemoveJob(job.id)}
                  title="Remove from queue"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
