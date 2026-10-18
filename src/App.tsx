import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Key,
  ArrowRight,
  RotateCw,
  Image as ImageIcon,
  XCircle
} from 'lucide-react';
import { Header } from './components/Header';
import { ApiKeyModal } from './components/ApiKeyModal';
import { InfoModal } from './components/InfoModal';
import { PresetSelector } from './components/PresetSelector';
import { Dropzone } from './components/Dropzone';
import { ComparisonSlider } from './components/ComparisonSlider';
import { BatchQueue } from './components/BatchQueue';
import { StudioControlBar } from './components/StudioControlBar';
import { SampleChallengesModal } from './components/SampleChallengesModal';
import { RESTORATION_PRESETS, DEFAULT_PROMPT } from './constants/presets';
import type { SampleChallenge } from './constants/samples';
import type {
  RestorationJob,
  RestorationPreset,
  SupportedModel,
  UpscaleTarget,
  ImageMetadata
} from './types';
import {
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  restoreImageWithGemini,
  getImageDimensions
} from './services/geminiService';

export const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<SupportedModel>('gemini-3.1-flash-image');
  const [selectedPreset, setSelectedPreset] = useState<RestorationPreset>(RESTORATION_PRESETS[0]);
  const [currentPrompt, setCurrentPrompt] = useState<string>(DEFAULT_PROMPT);
  const [targetScale, setTargetScale] = useState<UpscaleTarget>('8k');
  const [jobs, setJobs] = useState<RestorationJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isSamplesModalOpen, setIsSamplesModalOpen] = useState(false);
  const [isPresetsDrawerOpen, setIsPresetsDrawerOpen] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Store active AbortControllers to prevent memory leaks and allow task cancellation
  const activeControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Ref to hold current jobs so unmount cleanup has access to all blob URLs
  const jobsRef = useRef<RestorationJob[]>([]);
  jobsRef.current = jobs;

  // Load stored preferences
  useEffect(() => {
    const key = getStoredApiKey();
    setApiKey(key);
    const savedModel = getStoredModel();
    setModel(savedModel);

    // Unmount cleanup: cancel in-flight network requests and release blob URLs
    return () => {
      activeControllersRef.current.forEach((controller) => {
        controller.abort();
      });
      activeControllersRef.current.clear();

      jobsRef.current.forEach((job) => {
        if (job.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(job.previewUrl);
        }
      });
    };
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    setStoredApiKey(key);
  };

  const handleChangeModel = (newModel: SupportedModel) => {
    setModel(newModel);
    setStoredModel(newModel);
  };

  const handleFilesSelected = (
    filesWithMeta: Array<{ file: File; metadata: ImageMetadata; previewUrl: string }>
  ) => {
    const newJobs: RestorationJob[] = filesWithMeta.map((item) => ({
      id: 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      file: item.file,
      previewUrl: item.previewUrl,
      metadata: item.metadata,
      status: 'idle',
      targetScale
    }));

    setJobs((prev) => [...prev, ...newJobs]);

    // Focus on the first job added
    if (!activeJobId && newJobs.length > 0) {
      setActiveJobId(newJobs[0].id);
    }
  };

  const handleSelectSampleChallenge = async (challenge: SampleChallenge) => {
    const file = challenge.generator();
    const previewUrl = URL.createObjectURL(file);
    try {
      const dims = await getImageDimensions(previewUrl);
      const newJob: RestorationJob = {
        id: 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        file,
        previewUrl,
        metadata: {
          name: file.name,
          originalWidth: dims.width,
          originalHeight: dims.height,
          originalSize: file.size,
          mimeType: file.type
        },
        status: 'idle',
        targetScale
      };
      setJobs((prev) => [...prev, newJob]);
      setActiveJobId(newJob.id);
    } catch {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const cancelJob = useCallback((jobId: string) => {
    const controller = activeControllersRef.current.get(jobId);
    if (controller) {
      controller.abort();
      activeControllersRef.current.delete(jobId);
    }
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId && j.status === 'processing'
          ? { ...j, status: 'idle', progressMessage: undefined, errorMessage: 'Restoration cancelled.' }
          : j
      )
    );
  }, []);

  const processSingleJob = useCallback(
    async (jobId: string) => {
      if (!apiKey) {
        setIsApiKeyModalOpen(true);
        return;
      }

      const targetJob = jobs.find((j) => j.id === jobId);
      if (!targetJob) return;

      // Abort any existing controller for this job
      cancelJob(jobId);

      const controller = new AbortController();
      activeControllersRef.current.set(jobId, controller);

      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status: 'processing', errorMessage: undefined, progressMessage: 'Connecting...' }
            : j
        )
      );

      const startTime = performance.now();

      try {
        const result = await restoreImageWithGemini({
          apiKey,
          file: targetJob.file,
          prompt: currentPrompt,
          model,
          signal: controller.signal,
          onProgress: (msg) => {
            setJobs((prev) =>
              prev.map((j) => (j.id === jobId ? { ...j, progressMessage: msg } : j))
            );
          }
        });

        const elapsed = Math.round(performance.now() - startTime);

        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'done',
                  resultDataUrl: result.dataUrl,
                  resultWidth: result.width,
                  resultHeight: result.height,
                  usedModel: result.model,
                  usedPresetId: selectedPreset.id,
                  processingTimeMs: elapsed,
                  progressMessage: undefined
                }
              : j
          )
        );

        setActiveJobId(jobId);
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        const errorMsg = err instanceof Error ? err.message : String(err);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'error',
                  errorMessage: errorMsg,
                  progressMessage: undefined
                }
              : j
          )
        );
      } finally {
        activeControllersRef.current.delete(jobId);
      }
    },
    [apiKey, jobs, currentPrompt, model, selectedPreset.id, cancelJob]
  );

  const handleProcessAll = async () => {
    if (!apiKey) {
      setIsApiKeyModalOpen(true);
      return;
    }

    const pendingJobs = jobs.filter((j) => j.status === 'idle' || j.status === 'error');
    if (pendingJobs.length === 0) return;

    setIsProcessingBatch(true);

    for (const job of pendingJobs) {
      await processSingleJob(job.id);
    }

    setIsProcessingBatch(false);
  };

  const handleUpdateTargetScale = (jobId: string, scale: UpscaleTarget) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, targetScale: scale } : j))
    );
  };

  const handleGlobalScaleChange = (scale: UpscaleTarget) => {
    setTargetScale(scale);
    if (activeJobId) {
      handleUpdateTargetScale(activeJobId, scale);
    }
  };

  const handleRemoveJob = (jobId: string) => {
    cancelJob(jobId);

    const jobToRemove = jobs.find((j) => j.id === jobId);
    if (jobToRemove?.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(jobToRemove.previewUrl);
    }

    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (activeJobId === jobId) {
      const remaining = jobs.filter((j) => j.id !== jobId);
      setActiveJobId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleClearCompleted = () => {
    const completedJobs = jobs.filter((j) => j.status === 'done');
    completedJobs.forEach((job) => {
      if (job.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(job.previewUrl);
      }
    });
    setJobs((prev) => prev.filter((j) => j.status !== 'done'));
  };

  const activeJob = jobs.find((j) => j.id === activeJobId) || (jobs.length > 0 ? jobs[0] : null);
  const isAnyProcessing = jobs.some((j) => j.status === 'processing') || isProcessingBatch;

  return (
    <div className="app-container">
      <Header
        hasApiKey={Boolean(apiKey)}
        currentModel={model}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
      />

      {/* Main Studio Control Bar */}
      <StudioControlBar
        model={model}
        onChangeModel={handleChangeModel}
        targetScale={targetScale}
        onChangeTargetScale={handleGlobalScaleChange}
        selectedPreset={selectedPreset}
        onOpenPresets={() => setIsPresetsDrawerOpen(!isPresetsDrawerOpen)}
        onOpenSamples={() => setIsSamplesModalOpen(true)}
      />

      <main className="app-main">
        {/* Banner if no API key is configured yet */}
        {!apiKey && (
          <div className="api-banner" onClick={() => setIsApiKeyModalOpen(true)}>
            <div className="banner-left">
              <Key size={18} className="banner-icon" />
              <div>
                <strong>Zero-Cost Setup: Connect your Free Google AI Studio API Key</strong>
                <p>Personal free tier with personal rate limits. 100% free with no credit card required.</p>
              </div>
            </div>
            <button className="banner-btn">
              <span>Connect Free Key</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Collapsible / Expandable Preset Recipe Selector */}
        {isPresetsDrawerOpen && (
          <div className="preset-drawer-container">
            <PresetSelector
              selectedPresetId={selectedPreset.id}
              onSelectPreset={(p) => {
                setSelectedPreset(p);
                setIsPresetsDrawerOpen(false);
              }}
              currentPrompt={currentPrompt}
              onUpdatePrompt={setCurrentPrompt}
            />
          </div>
        )}

        {/* Studio Workspace Grid */}
        <div className="workspace-grid">
          {/* Left Column: Dropzone & Batch Reel */}
          <div className="workspace-left">
            <Dropzone
              onFilesSelected={handleFilesSelected}
              disabled={isAnyProcessing}
              onOpenSamplesModal={() => setIsSamplesModalOpen(true)}
            />

            <BatchQueue
              jobs={jobs}
              activeJobId={activeJobId}
              onSelectActiveJob={setActiveJobId}
              onProcessJob={processSingleJob}
              onCancelJob={cancelJob}
              onProcessAll={handleProcessAll}
              onRemoveJob={handleRemoveJob}
              onClearCompleted={handleClearCompleted}
              isAnyProcessing={isAnyProcessing}
            />
          </div>

          {/* Right Column: Comparison Studio or Staging Viewport */}
          <div className="workspace-right">
            {activeJob ? (
              <div className="active-job-view">
                {activeJob.status === 'done' ? (
                  <ComparisonSlider
                    job={activeJob}
                    onUpdateTargetScale={handleUpdateTargetScale}
                  />
                ) : (
                  <div className="preview-placeholder-card">
                    <div className="preview-top">
                      <img
                        src={activeJob.previewUrl}
                        alt="Selected Photo"
                        className="preview-source-image"
                      />
                      {activeJob.status === 'processing' && (
                        <div className="processing-overlay">
                          <RotateCw size={38} className="spin-icon text-cyan" />
                          <h4 className="processing-title">Restoring with {model}...</h4>
                          <p className="processing-msg">
                            {activeJob.progressMessage || 'Synthesizing micro-textures and Phase One softbox lighting...'}
                          </p>
                          <button
                            className="cancel-processing-btn"
                            onClick={() => cancelJob(activeJob.id)}
                          >
                            <XCircle size={15} />
                            <span>Cancel Request</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="preview-bottom-actions">
                      <div className="preview-meta">
                        <span className="file-name">{activeJob.metadata.name}</span>
                        <span className="file-dims">
                          {activeJob.metadata.originalWidth} × {activeJob.metadata.originalHeight} px • Target: {activeJob.targetScale.toUpperCase()} Master
                        </span>
                      </div>

                      {activeJob.status === 'idle' && (
                        <button
                          className="start-restore-btn"
                          onClick={() => processSingleJob(activeJob.id)}
                          disabled={isAnyProcessing}
                        >
                          <Sparkles size={16} />
                          <span>Perform Forensic Restoration & Upscale</span>
                        </button>
                      )}

                      {activeJob.status === 'error' && (
                        <div className="error-box">
                          <p className="error-text">{activeJob.errorMessage}</p>
                          <button
                            className="retry-btn"
                            onClick={() => processSingleJob(activeJob.id)}
                          >
                            <RotateCw size={14} />
                            <span>Retry</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state-card">
                <div className="empty-state-icon">
                  <ImageIcon size={44} className="text-muted" />
                </div>
                <h3>Lumina Studio Ready</h3>
                <p>
                  Drag and drop a low-quality or compressed image, or choose a simulated challenge from the{' '}
                  <strong>&quot;Quick Challenge Tests&quot;</strong> below the dropzone to test the 8K forensic restoration engine immediately.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        model={model}
        onChangeModel={handleChangeModel}
      />

      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      <SampleChallengesModal
        isOpen={isSamplesModalOpen}
        onClose={() => setIsSamplesModalOpen(false)}
        onSelectSample={handleSelectSampleChallenge}
      />
    </div>
  );
};

export default App;
