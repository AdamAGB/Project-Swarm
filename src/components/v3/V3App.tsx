import { useState, useRef, Fragment } from 'react';
import { useApiKey } from '../../hooks/useApiKey';
import { ApiKeyInput } from '../ApiKeyInput';
import { createOpenAIClient } from '../../services/openai';
import { generateOptions, generateOptionsExpanded } from '../../services/option-generator';
import { generateSegmentsAndVariables } from '../../services/segment-generator';
import { scoreOptionsV2 } from '../../services/option-scorer-v2';
import { generatePrior } from '../../services/prior-generator';
import {
  computeSegmentScores,
  computeWeightedScores,
  simulateAllVotes,
} from '../../services/vote-engine-v2';
import { generatePersonas } from '../../services/persona-generator';
import type { GeneratedPersona } from '../../services/persona-generator';
import { VoteParticleViz, SEGMENT_COLORS } from '../v2/VoteParticleViz';
import type {
  SegmentFramework,
  Segment,
  PriorResult,
  V2SegmentVoteResult,
  V2VoteAggregates,
} from '../../types/v2';
import type { Attachment } from '../../types/attachments';
import { isAcceptedFile, readFileAsAttachment, ACCEPTED_FILE_TYPES } from '../../services/attachments';
import { ProgressiveViz } from './ProgressiveViz';
import '../v2/V2App.css';
import './V3App.css';

const PROGRESS_LABELS = [
  '',
  'Generating polling options\u2026',
  'Building audience segments\u2026',
  'Scoring options\u2026',
  'Simulating 10,000 votes\u2026',
  'Generating reactions\u2026',
];

type Step = 'input' | 'loading' | 'edit-options' | 'edit-segments' | 'results' | 'error';

const PIPELINE_STEPS = [
  'Generating polling options',
  'Building audience segments',
  'Scoring options across 3 lenses',
  'Simulating 10,000 votes',
  'Generating audience reactions',
];

interface VoteData {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
  prior: PriorResult | null;
}

function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function V3App() {
  const { apiKey, hasKey, saveKey, clearKey } = useApiKey();

  const [step, setStep] = useState<Step>('input');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [progressStep, setProgressStep] = useState(0);
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [personas, setPersonas] = useState<GeneratedPersona[] | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [advanced, setAdvanced] = useState(false);
  const [framework, setFramework] = useState<SegmentFramework | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [optionPool, setOptionPool] = useState<string[]>([]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_ATTACHMENTS = 10;

  async function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    const accepted = Array.from(files).filter(isAcceptedFile).slice(0, remaining);
    const newAttachments = await Promise.all(accepted.map(readFileAsAttachment));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }

  function handleRemoveAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  // Normal mode: full pipeline (unchanged)
  async function handleSubmit() {
    const q = question.trim();
    if (!q) return;

    setAdvanced(false);
    setStep('loading');
    setProgressStep(0);
    setErrorMsg('');
    setVoteData(null);
    setPersonas(null);
    setFramework(null);

    try {
      const client = createOpenAIClient(apiKey);

      // Step 1: Generate options
      setProgressStep(1);
      const opts = await generateOptions(client, q, attachments);
      setOptions(opts);

      // Step 2: Generate segments + variables
      setProgressStep(2);
      const fw = await generateSegmentsAndVariables(client, q, opts, attachments);
      if (!fw) throw new Error('Failed to generate audience segments');
      setFramework(fw);

      // Step 3: Score options + generate common-sense prior (in parallel)
      setProgressStep(3);
      const [scoreResult, prior] = await Promise.all([
        scoreOptionsV2(client, q, opts, fw.variables),
        generatePrior(client, q, opts),
      ]);
      if (!scoreResult) throw new Error('Failed to score options');

      // Step 4: Compute + simulate (sync)
      setProgressStep(4);
      const segmentScores = computeSegmentScores(fw, scoreResult.rankings, opts);
      computeWeightedScores(segmentScores, fw, opts);
      const { aggregates, segmentVotes } = simulateAllVotes(segmentScores, fw, opts, prior);

      // Step 5: Show results immediately, generate personas in background
      setVoteData({ segmentVotes, aggregates, prior });
      setStep('results');

      setProgressStep(5);
      generatePersonas(client, q, opts, segmentVotes, fw)
        .then(setPersonas)
        .catch(() => {});
    } catch (err) {
      console.error('[V3App] Pipeline error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // Advanced mode: generate options then pause
  async function handleAdvancedSubmit() {
    const q = question.trim();
    if (!q) return;

    setAdvanced(true);
    setStep('loading');
    setLoadingLabel('Generating polling options…');
    setProgressStep(0);
    setErrorMsg('');
    setVoteData(null);
    setPersonas(null);
    setFramework(null);
    setOptionPool([]);

    try {
      const client = createOpenAIClient(apiKey);
      const { shown, pool } = await generateOptionsExpanded(client, q, attachments);
      setOptions(shown);
      setOptionPool(pool);
      setStep('edit-options');
    } catch (err) {
      console.error('[V3App] Advanced options error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // Advanced mode: show empty segment editor for user to describe segments
  function handleContinueFromOptions() {
    // Start with one empty segment for the user to describe
    const emptySeg: Segment = { name: 'Segment 1', description: '', populationShare: 1 };
    setFramework({
      reasoning: '',
      segments: [emptySeg],
      variables: [],
      weights: {},
    });
    setStep('edit-segments');
  }

  // Advanced mode: regenerate framework from user descriptions, then score + simulate
  async function handleContinueFromSegments() {
    if (!framework) return;

    const descriptions = framework.segments.map((s) => s.description.trim()).filter(Boolean);
    if (descriptions.length === 0) return;

    setStep('loading');
    setLoadingLabel('Building segments from your descriptions...');
    setProgressStep(2);

    try {
      const client = createOpenAIClient(apiKey);

      // Regenerate framework from user-provided segment descriptions
      const fw = await generateSegmentsAndVariables(
        client,
        question.trim(),
        options,
        [],
        descriptions,
      );
      if (!fw) throw new Error('Failed to generate audience segments');

      // Override LLM population shares with user's chosen percentages
      if (framework.segments.length > 1) {
        const userShares = framework.segments.map((s) => s.populationShare);
        const totalShare = userShares.reduce((sum, s) => sum + s, 0);
        fw.segments = fw.segments.map((s, i) => ({
          ...s,
          populationShare: totalShare > 0 && i < userShares.length
            ? userShares[i] / totalShare
            : s.populationShare,
        }));
      }
      setFramework(fw);

      // Score options + generate common-sense prior (in parallel)
      setProgressStep(3);
      const [scoreResult, prior] = await Promise.all([
        scoreOptionsV2(client, question.trim(), options, fw.variables),
        generatePrior(client, question.trim(), options),
      ]);
      if (!scoreResult) throw new Error('Failed to score options');

      // Compute + simulate
      setProgressStep(4);
      const segmentScores = computeSegmentScores(fw, scoreResult.rankings, options);
      computeWeightedScores(segmentScores, fw, options);
      const { aggregates, segmentVotes } = simulateAllVotes(segmentScores, fw, options, prior);

      // Show results, generate personas in background
      setVoteData({ segmentVotes, aggregates, prior });
      setStep('results');

      setProgressStep(5);
      generatePersonas(client, question.trim(), options, segmentVotes, fw)
        .then(setPersonas)
        .catch(() => {});
    } catch (err) {
      console.error('[V3App] Advanced simulation error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // Regenerate options (advanced mode)
  async function handleRegenerateOptions() {
    setStep('loading');
    setLoadingLabel('Regenerating options…');

    try {
      const client = createOpenAIClient(apiKey);
      const { shown, pool } = await generateOptionsExpanded(client, question.trim(), attachments);
      setOptions(shown);
      setOptionPool(pool);
      setStep('edit-options');
    } catch (err) {
      console.error('[V3App] Regenerate options error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }

  // Regenerate segments (advanced mode)
  // --- Edit Options helpers ---
  function handleOptionChange(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function handleOptionDelete(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOptionAdd() {
    if (options.length < 5) {
      setOptions((prev) => [...prev, '']);
    }
  }

  // Swap a single option with the next one from the pool
  function handleOptionRefresh(index: number) {
    if (optionPool.length === 0) return;
    const next = optionPool[0];
    const old = options[index];
    setOptions((prev) => prev.map((o, i) => (i === index ? next : o)));
    // Put the replaced option at the end of the pool so it can come back
    setOptionPool((prev) => [...prev.slice(1), old]);
  }

  // --- Edit Segments helpers ---
  function handleSegmentDescChange(index: number, value: string) {
    if (!framework) return;
    const newSegments = framework.segments.map((s, i) =>
      i === index ? { ...s, description: value } : s
    );
    setFramework({ ...framework, segments: newSegments });
  }

  const SPLIT_PRESETS: Record<number, { label: string; shares: number[] }[]> = {
    2: [
      { label: 'Even', shares: [50, 50] },
      { label: '60 / 40', shares: [60, 40] },
      { label: '70 / 30', shares: [70, 30] },
      { label: '80 / 20', shares: [80, 20] },
    ],
    3: [
      { label: 'Even', shares: [34, 33, 33] },
      { label: '50 / 30 / 20', shares: [50, 30, 20] },
      { label: '60 / 25 / 15', shares: [60, 25, 15] },
    ],
    4: [
      { label: 'Even', shares: [25, 25, 25, 25] },
      { label: '40 / 25 / 20 / 15', shares: [40, 25, 20, 15] },
      { label: '50 / 20 / 20 / 10', shares: [50, 20, 20, 10] },
    ],
  };

  function handleApplySplit(shares: number[]) {
    if (!framework) return;
    const newSegments = framework.segments.map((s, i) => ({
      ...s,
      populationShare: (shares[i] ?? shares[shares.length - 1]) / 100,
    }));
    setFramework({ ...framework, segments: newSegments });
  }

  function currentSplitLabel(): string {
    if (!framework || framework.segments.length <= 1) return '';
    return framework.segments.map((s) => Math.round(s.populationShare * 100)).join(' / ');
  }

  function handleSegmentDelete(index: number) {
    if (!framework || framework.segments.length <= 1) return;
    const removedName = framework.segments[index].name;
    const newSegments = framework.segments.filter((_, i) => i !== index);
    const newWeights = { ...framework.weights };
    delete newWeights[removedName];
    setFramework({ ...framework, segments: newSegments, weights: newWeights });
  }

  function handleSegmentAdd() {
    if (!framework) return;
    const newSeg: Segment = {
      name: `Segment ${framework.segments.length + 1}`,
      description: '',
      populationShare: 0.1,
    };
    // Create default weights for new segment (all MEDIUM)
    const newWeights = { ...framework.weights };
    newWeights[newSeg.name] = {};
    for (const v of framework.variables) {
      newWeights[newSeg.name][v.key] = 'MEDIUM';
    }
    setFramework({
      ...framework,
      segments: [...framework.segments, newSeg],
      weights: newWeights,
    });
  }

  function handleReset() {
    setStep('input');
    setOptions([]);
    setVoteData(null);
    setPersonas(null);
    setErrorMsg('');
    setProgressStep(0);
    setAdvanced(false);
    setFramework(null);
    setLoadingLabel('');
    setOptionPool([]);
    setAttachments([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
  }

  // Can we continue from options? Need at least 2 non-empty options
  const validOptions = options.filter((o) => o.trim().length > 0);
  const canContinueFromOptions = validOptions.length >= 2;

  // Can we continue from segments?
  const canContinueFromSegments =
    framework !== null &&
    framework.segments.length >= 1 &&
    framework.segments.every((s) => s.description.trim().length > 0);

  // Group personas by segment
  const personasBySegment: Record<string, GeneratedPersona[]> = {};
  if (personas) {
    for (const p of personas) {
      if (!personasBySegment[p.segment]) personasBySegment[p.segment] = [];
      personasBySegment[p.segment].push(p);
    }
  }

  return (
    <div className="v3-app">
      <ApiKeyInput apiKey={apiKey} onSave={saveKey} onClear={clearKey} />

      {!hasKey ? null : step === 'input' ? (
        <div className="v3-input-screen">
          <h1 className="v3-title">Poll Simulator</h1>
          <p className="v3-subtitle">Type a question and see how 10,000 people would vote</p>
          <div className="v3-input-wrapper">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What should we name our new energy drink?"
              autoFocus
            />
            <div
              className="v3-attachment-zone"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {attachments.length >= MAX_ATTACHMENTS
                ? 'Max attachments reached'
                : 'Drop files here or click to attach (images, txt, csv, md)'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
            {attachments.length > 0 && (
              <div className="v3-attachment-chips">
                {attachments.map((att) => (
                  <span key={att.id} className="v3-attachment-chip">
                    <span className="v3-attachment-chip-icon">
                      {att.type === 'image' ? '\ud83d\uddbc' : '\ud83d\udcc4'}
                    </span>
                    <span className="v3-attachment-chip-name">{att.name}</span>
                    <button
                      className="v3-attachment-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAttachment(att.id);
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              className="btn-primary"
              disabled={!question.trim()}
              onClick={handleAdvancedSubmit}
            >
              Begin Simulation
            </button>
            <button
              className="btn-secondary"
              disabled={!question.trim()}
              onClick={handleSubmit}
            >
              I'm Feeling Lucky
            </button>
          </div>
        </div>
      ) : step === 'loading' ? (
        !advanced ? (
          <ProgressiveViz
            options={options}
            framework={framework}
            statusLabel={PROGRESS_LABELS[progressStep] || ''}
          />
        ) : loadingLabel ? (
          <div className="v3-loading">
            <div className="v2-spinner" />
            <p className="v3-loading-label">{loadingLabel}</p>
          </div>
        ) : (
          <div className="v3-loading">
            <div className="v2-spinner" />
            <ol className="v3-steps">
              {PIPELINE_STEPS.map((label, i) => {
                const idx = i + 1;
                const status = progressStep > idx ? 'done' : progressStep === idx ? 'active' : 'pending';
                return (
                  <li key={idx} className={`v3-step ${status}`}>
                    {status === 'done' ? '\u2713' : status === 'active' ? '\u25CF' : '\u25CB'}{' '}
                    {label}
                  </li>
                );
              })}
            </ol>
          </div>
        )
      ) : step === 'edit-options' ? (
        <div className="v3-edit-screen">
          <button className="v3-back-btn" onClick={handleReset}>&larr; Back</button>
          <h2 className="v3-edit-header">Edit Options</h2>
          <p className="v3-edit-question">{question}</p>
          <div className="v3-edit-list">
            {options.map((opt, i) => (
              <div key={i} className="v3-edit-item">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                <button
                  className="v3-edit-refresh"
                  onClick={() => handleOptionRefresh(i)}
                  disabled={optionPool.length === 0}
                  title={optionPool.length > 0 ? 'Swap for a different suggestion' : 'No more suggestions'}
                >
                  &#x21bb;
                </button>
                <button
                  className="v3-edit-delete"
                  onClick={() => handleOptionDelete(i)}
                  disabled={options.length <= 2}
                  title="Remove option"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <div className="v3-edit-actions">
            <button
              className="btn-secondary"
              onClick={handleOptionAdd}
              disabled={options.length >= 5}
            >
              Add Option
            </button>
            <button
              className="btn-secondary"
              onClick={handleRegenerateOptions}
            >
              Regenerate
            </button>
            <button
              className="btn-primary"
              onClick={handleContinueFromOptions}
              disabled={!canContinueFromOptions}
            >
              Continue
            </button>
          </div>
        </div>
      ) : step === 'edit-segments' && framework ? (
        <div className="v3-edit-screen">
          <button className="v3-back-btn" onClick={() => setStep('edit-options')}>&larr; Back</button>
          <h2 className="v3-edit-header">Describe Your Audience Segments</h2>
          <p style={{ color: '#999', fontSize: '14px', margin: '0 0 16px' }}>
            Describe each audience segment in your own words. Who are they? What do they care about?
          </p>
          {framework.segments.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <span style={{ color: '#888', fontSize: '13px' }}>Split:</span>
              {(SPLIT_PRESETS[framework.segments.length] ?? [{ label: 'Even', shares: framework.segments.map(() => Math.round(100 / framework.segments.length)) }]).map((preset) => {
                const isActive = currentSplitLabel() === preset.shares.join(' / ');
                return (
                  <button
                    key={preset.label}
                    onClick={() => handleApplySplit(preset.shares)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      borderRadius: '12px',
                      border: isActive ? '1px solid #4a9eff' : '1px solid #444',
                      background: isActive ? 'rgba(74, 158, 255, 0.15)' : 'transparent',
                      color: isActive ? '#4a9eff' : '#aaa',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <span style={{ color: '#666', fontSize: '12px', marginLeft: '4px' }}>
                {currentSplitLabel()}
              </span>
            </div>
          )}
          <div className="v3-edit-list">
            {framework.segments.map((seg, i) => (
              <div key={i} className="v3-segment-edit-card" style={{ position: 'relative' }}>
                <textarea
                  className="v3-segment-desc-input"
                  value={seg.description}
                  onChange={(e) => handleSegmentDescChange(i, e.target.value)}
                  placeholder={`e.g. "Budget-conscious parents who prioritize value and practicality"`}
                  rows={3}
                  style={{ width: '100%', paddingRight: framework.segments.length > 1 ? '36px' : undefined }}
                />
                {framework.segments.length > 1 && (
                  <button
                    className="v3-edit-delete"
                    onClick={() => handleSegmentDelete(i)}
                    title="Remove segment"
                    style={{ position: 'absolute', top: '8px', right: '8px' }}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="v3-edit-actions">
            <button
              className="btn-secondary"
              onClick={handleSegmentAdd}
            >
              + Add Segment
            </button>
            <button
              className="btn-primary"
              onClick={handleContinueFromSegments}
              disabled={!canContinueFromSegments}
            >
              Continue
            </button>
          </div>
        </div>
      ) : step === 'error' ? (
        <div className="v3-error">
          <p>{errorMsg || 'Something failed. Check your API key and try again.'}</p>
          <button className="btn-primary" onClick={handleReset}>Try Again</button>
        </div>
      ) : step === 'results' && voteData ? (
        <div className="v3-results">
          <div className="v3-results-header">
            <h1>{question}</h1>
            <button className="btn-secondary" onClick={handleReset}>New Question</button>
          </div>

          <VoteParticleViz
            segmentVotes={voteData.segmentVotes}
            aggregates={voteData.aggregates}
            options={options}
          />

          <div className="v2-vote-stats-row">
            {options.map((opt) => {
              const isWinner = opt === voteData.aggregates.winner;
              return (
                <div key={opt} className={`v2-vote-stat-card ${isWinner ? 'winner' : ''}`}>
                  {isWinner && <span className="v2-winner-badge">Winner</span>}
                  <span className="v2-stat-option">{opt}</span>
                  <span className="v2-stat-count">
                    {voteData.aggregates.voteCounts[opt].toLocaleString()}
                  </span>
                  <span className="v2-stat-pct">
                    {voteData.aggregates.votePercentages[opt].toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          <div className="v2-segment-color-legend">
            {voteData.segmentVotes.map((sv, i) => (
              <span key={sv.segmentName} className="v2-segment-color-legend-item">
                <span
                  className="v2-legend-dot"
                  style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                />
                {sv.segmentName} ({formatShare(sv.populationShare)} — {sv.winnerInSegment})
              </span>
            ))}
          </div>

          {voteData.prior && (
            <details className="v3-prior-debug" style={{ margin: '16px 0', padding: '12px', background: '#1a1a2e', borderRadius: '8px', fontSize: '13px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#aaa' }}>
                Prior Debug — confidence: {voteData.prior.confidence.toFixed(2)} — segment weight: {(0.85 - voteData.prior.confidence * (0.85 - 0.35)).toFixed(2)}
              </summary>
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', color: '#ccc' }}>
                {options.map((opt) => (
                  <Fragment key={opt}>
                    <span>{opt}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        height: '8px',
                        width: `${(voteData.prior!.distribution[opt] ?? 0) * 100 * 3}px`,
                        background: '#4a9eff',
                        borderRadius: '4px',
                        minWidth: '2px',
                      }} />
                      <span>{((voteData.prior!.distribution[opt] ?? 0) * 100).toFixed(1)}%</span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </details>
          )}

          {personas ? (
            <div className="v3-persona-section">
              {voteData.segmentVotes.map((sv, segIdx) => {
                const segPersonas = personasBySegment[sv.segmentName];
                if (!segPersonas || segPersonas.length === 0) return null;
                return (
                  <div key={sv.segmentName} className="v3-persona-group">
                    <h3 className="v3-persona-group-header">
                      <span
                        className="v2-legend-dot"
                        style={{ backgroundColor: SEGMENT_COLORS[segIdx % SEGMENT_COLORS.length] }}
                      />
                      {sv.segmentName}
                    </h3>
                    {segPersonas.map((p, i) => (
                      <div
                        key={`${p.name}-${i}`}
                        className="v3-persona-card"
                        style={{ animationDelay: `${(segIdx * 3 + i) * 0.07}s` }}
                      >
                        <div className="v3-persona-header">
                          <span className="v3-persona-name">{p.name}</span>
                          <span className="v3-persona-vote-pill">{p.vote}</span>
                        </div>
                        <p className="v3-persona-comment">{p.comment}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="v2-loading">
              <div className="v2-spinner" />
              <p>Generating audience reactions...</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
