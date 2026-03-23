// @ts-nocheck
import { useState } from 'react';
import { useApiKey } from '../../hooks/useApiKey';
import { ApiKeyInput } from '../ApiKeyInput';
import { createOpenAIClient } from '../../services/openai';
import { generateSegmentsAndVariables } from '../../services/segment-generator';
import { scoreOptionsV2 } from '../../services/option-scorer-v2';
import {
  computeSegmentScores,
  computeWeightedScores,
  simulateAllVotes,
  decomposeDrivers,
  generateNarrative,
} from '../../services/vote-engine-v2';
import { VoteParticleViz, SEGMENT_COLORS } from './VoteParticleViz';
import type {
  SegmentFramework,
  Sensitivity,
  OptionScoreResult,
  ScoringPass,
  V2AggregationResult,
  V2SegmentVoteResult,
  V2VoteAggregates,
  DriverDecomposition,
  V2Narrative,
} from '../../types/v2';
import './V2App.css';

const OPTION_COLORS = [
  'rgba(99, 102, 241, 0.85)',
  'rgba(236, 72, 153, 0.85)',
  'rgba(245, 158, 11, 0.85)',
  'rgba(16, 185, 129, 0.85)',
  'rgba(139, 92, 246, 0.85)',
  'rgba(59, 130, 246, 0.85)',
];

type Step = 'input' | 'generating' | 'segments' | 'scoring' | 'scored' | 'aggregating' | 'results' | 'error';

interface VoteData {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
  drivers: DriverDecomposition;
  weightedScores: Record<string, number>;
  segmentScores: Record<string, Record<string, number>>;
}

function sensitivityClassName(s: Sensitivity): string {
  if (s === 'HIGH') return 'sensitivity-high';
  if (s === 'MEDIUM') return 'sensitivity-medium';
  return 'sensitivity-low';
}

function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function rankClassName(rank: number, optionCount: number): string {
  if (optionCount <= 1) return 'score-high';
  const normalized = (rank - 1) / (optionCount - 1); // 0 = best, 1 = worst
  if (normalized <= 0.25) return 'score-high';
  if (normalized <= 0.5) return 'score-medium';
  if (normalized <= 0.75) return 'score-low';
  return 'score-negative';
}

function RankTable({ rankings, options, variableKeys, variableLabels, optionCount }: {
  rankings: Record<string, Record<string, number>>;
  options: string[];
  variableKeys: string[];
  variableLabels: Record<string, string>;
  optionCount: number;
}) {
  return (
    <div className="score-table-wrapper">
      <table className="score-table">
        <thead>
          <tr>
            <th>Option</th>
            {variableKeys.map((k) => (
              <th key={k}>{variableLabels[k]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option}>
              <td>{option}</td>
              {variableKeys.map((k) => {
                const rank = rankings[option]?.[k] ?? optionCount;
                return (
                  <td key={k} className={rankClassName(rank, optionCount)}>
                    {rank}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PassDebug({ passes, options, variableKeys, variableLabels, optionCount }: {
  passes: ScoringPass[];
  options: string[];
  variableKeys: string[];
  variableLabels: Record<string, string>;
  optionCount: number;
}) {
  return (
    <details className="pass-debug">
      <summary>Raw Ranking Passes ({passes.length})</summary>
      {passes.map((pass) => (
        <div key={pass.lens} className="pass-debug-section">
          <div className="pass-label-row">
            <span className="pass-label">{pass.lens}</span>
            <span className="pass-description">{pass.description}</span>
          </div>
          <RankTable
            rankings={pass.rankings}
            options={options}
            variableKeys={variableKeys}
            variableLabels={variableLabels}
            optionCount={optionCount}
          />
        </div>
      ))}
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  Results Step — Inline Components                                   */
/* ------------------------------------------------------------------ */

function NarrativeSummary({ narrative }: { narrative: V2Narrative }) {
  return (
    <div className="v2-narrative">
      <h2>{narrative.headline}</h2>
      <p className="v2-narrative-body">{narrative.body}</p>
      <ul className="v2-narrative-insights">
        {narrative.keyInsights.map((insight, i) => (
          <li key={i}>{insight}</li>
        ))}
      </ul>
    </div>
  );
}


function V2SegmentBreakdown({ segmentVotes, options }: { segmentVotes: V2SegmentVoteResult[]; options: string[] }) {
  return (
    <div className="v2-section">
      <h2>Segment Breakdown</h2>
      <div className="v2-segment-vote-list">
        {segmentVotes.map((sv) => (
          <div key={sv.segmentName} className="v2-segment-vote-row">
            <div className="v2-segment-vote-label">
              <strong>{sv.segmentName}</strong>
              <span className="v2-segment-vote-meta">
                {formatShare(sv.populationShare)} pop &middot; {sv.votesAllocated.toLocaleString()} votes
              </span>
            </div>
            <div className="v2-segment-vote-bars">
              {options.map((opt, i) => {
                const pct = sv.votePercentages[opt] ?? 0;
                return (
                  <div
                    key={opt}
                    className="v2-segment-vote-bar"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length],
                    }}
                    title={`${opt}: ${sv.voteCounts[opt]} votes (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="v2-legend">
        {options.map((opt, i) => (
          <span key={opt} className="v2-legend-item">
            <span className="v2-legend-dot" style={{ backgroundColor: OPTION_COLORS[i % OPTION_COLORS.length] }} />
            {opt}
          </span>
        ))}
      </div>
    </div>
  );
}

function V2DriverDecompositionView({ drivers }: { drivers: DriverDecomposition }) {
  const maxVarShare = Math.max(...drivers.byVariable.map((d) => Math.abs(d.contributionShare)), 0.01);
  const maxSegShare = Math.max(...drivers.bySegment.map((d) => Math.abs(d.contributionShare)), 0.01);

  return (
    <div className="v2-section">
      <h2>Why {drivers.winner} Wins</h2>

      <div className="v2-driver-group">
        <h3>Variable Contributions</h3>
        {drivers.byVariable.map((d) => {
          const pct = d.contributionShare * 100;
          const barWidth = (Math.abs(d.contributionShare) / maxVarShare) * 100;
          return (
            <div key={d.variableKey} className="v2-driver-row">
              <span className="v2-driver-label">{d.variableLabel}</span>
              <div className="v2-driver-bar-container">
                <div
                  className={`v2-driver-bar ${pct >= 0 ? 'positive' : 'negative'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`v2-driver-pct ${pct >= 0 ? 'positive' : 'negative'}`}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="v2-driver-group">
        <h3>Segment Contributions</h3>
        {drivers.bySegment.map((d) => {
          const pct = d.contributionShare * 100;
          const barWidth = (Math.abs(d.contributionShare) / maxSegShare) * 100;
          return (
            <div key={d.segmentName} className="v2-driver-row">
              <span className="v2-driver-label">
                {d.segmentName}
                <span className="v2-driver-meta">{formatShare(d.populationShare)} pop</span>
              </span>
              <div className="v2-driver-bar-container">
                <div
                  className={`v2-driver-bar ${pct >= 0 ? 'positive' : 'negative'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`v2-driver-pct ${pct >= 0 ? 'positive' : 'negative'}`}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main App Component                                                 */
/* ------------------------------------------------------------------ */

export function V2App() {
  const { apiKey, hasKey, saveKey, clearKey } = useApiKey();

  const [step, setStep] = useState<Step>('input');
  const [question, setQuestion] = useState('What should we name our new energy drink?');
  const [options, setOptions] = useState(['ThunderVolt', 'ZenFuel', 'CorePulse', 'AquaRush']);
  const [framework, setFramework] = useState<SegmentFramework | null>(null);
  const [scoreResult, setScoreResult] = useState<OptionScoreResult | null>(null);
  const [aggregation, setAggregation] = useState<V2AggregationResult | null>(null);
  const [voteData, setVoteData] = useState<VoteData | null>(null);
  const [narrative, setNarrative] = useState<V2Narrative | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filledOptions = options.filter((o) => o.trim().length > 0);
  const canProceed = question.trim().length > 0 && filledOptions.length >= 2;

  function handleOptionChange(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGenerate() {
    setStep('generating');
    try {
      const client = createOpenAIClient(apiKey);
      const result = await generateSegmentsAndVariables(client, question.trim(), filledOptions);
      if (result) {
        setFramework(result);
        setStep('segments');
      } else {
        setStep('error');
      }
    } catch {
      setStep('error');
    }
  }

  async function handleScore() {
    if (!framework) return;
    setStep('scoring');
    setErrorMsg(null);
    try {
      const client = createOpenAIClient(apiKey);
      const result = await scoreOptionsV2(client, question.trim(), filledOptions, framework.variables);
      if (result) {
        setScoreResult(result);
        setStep('scored');
      } else {
        setErrorMsg('Scoring failed after retry cycles — all results failed validation. Check browser console for details.');
        setStep('error');
      }
    } catch (err) {
      console.error('[V2App] Scoring error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error during scoring.');
      setStep('error');
    }
  }

  async function handleAggregate() {
    if (!framework || !scoreResult) return;
    setStep('aggregating');
    setErrorMsg(null);
    setNarrative(null);

    try {
      // Sync: compute scores + simulate votes + decompose drivers (instant)
      const variableLabels: Record<string, string> = {};
      for (const v of framework.variables) variableLabels[v.key] = v.label;

      const segmentScores = computeSegmentScores(framework, scoreResult.rankings, filledOptions);
      const weightedScores = computeWeightedScores(segmentScores, framework, filledOptions);
      const { aggregates, segmentVotes } = simulateAllVotes(segmentScores, framework, filledOptions);
      const drivers = decomposeDrivers(
        aggregates.winner, aggregates.runnerUp, weightedScores,
        segmentScores, scoreResult.rankings, framework, filledOptions, variableLabels,
      );

      const data: VoteData = { segmentVotes, aggregates, drivers, weightedScores, segmentScores };
      setVoteData(data);
      setStep('results');

      // Async: generate narrative in background (LLM call)
      const client = createOpenAIClient(apiKey);
      const narr = await generateNarrative(
        client, question.trim(), filledOptions, weightedScores,
        aggregates, drivers, segmentVotes, framework,
      );
      setNarrative(narr);
      setAggregation({
        weightedScores, segmentScores, aggregates, segmentVotes, drivers, narrative: narr,
      });
    } catch (err) {
      console.error('[V2App] Aggregation error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error during aggregation.');
      setStep('error');
    }
  }

  function handleReset() {
    setStep('input');
    setFramework(null);
    setScoreResult(null);
    setAggregation(null);
    setVoteData(null);
    setNarrative(null);
    setErrorMsg(null);
  }

  const variableLabels: Record<string, string> = {};
  if (framework) {
    for (const v of framework.variables) {
      variableLabels[v.key] = v.label;
    }
  }
  const variableKeys = framework?.variables.map((v) => v.key) ?? [];

  // Segments + variables + sensitivity matrix (shared between multiple steps)
  function renderFramework() {
    if (!framework) return null;
    return (
      <>
        {framework.reasoning && (
          <div className="v2-section">
            <h2>Audience Analysis</h2>
            <p className="v2-reasoning">{framework.reasoning}</p>
          </div>
        )}

        <div className="v2-section">
          <h2>Decision-Making Segments ({framework.segments.length})</h2>
          <div className="v2-segment-list">
            {framework.segments.map((seg) => (
              <div key={seg.name} className="v2-segment-card">
                <div className="v2-segment-header">
                  <h3>{seg.name}</h3>
                  <span className="segment-share">{formatShare(seg.populationShare)}</span>
                </div>
                <p>{seg.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-section">
          <h2>Evaluation Variables</h2>
          <div className="v2-variable-list">
            {framework.variables.map((v) => (
              <div key={v.key} className="v2-variable-item">
                <strong>{v.label}</strong>
                <p>{v.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-section">
          <h2>Sensitivity Matrix</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            How sensitive each segment is to each variable. HIGH = strong driver, MEDIUM = moderate factor, LOW = minor consideration.
          </p>
          <div className="weight-matrix-wrapper">
            <table className="weight-matrix">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Share</th>
                  {framework.variables.map((v) => (
                    <th key={v.key}>{v.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {framework.segments.map((seg) => (
                  <tr key={seg.name}>
                    <td>{seg.name}</td>
                    <td className="share-cell">{formatShare(seg.populationShare)}</td>
                    {framework.variables.map((v) => {
                      const s = framework.weights[seg.name]?.[v.key] ?? 'LOW';
                      return (
                        <td key={v.key} className={sensitivityClassName(s)}>
                          {s}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  function renderScoredDetails() {
    if (!framework || !scoreResult) return null;
    return (
      <>
        <div className="v2-section">
          <h2>Variable Definitions</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            Baseline definitions generated for consistent scoring across all lenses.
          </p>
          <div className="v2-variable-list">
            {variableKeys.map((key) => (
              <div key={key} className="v2-variable-item">
                <strong>{variableLabels[key]}</strong>
                <p>{scoreResult.definitions[key]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="v2-section">
          <h2>Option Rankings</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
            Average rank across {scoreResult.passes.length} lenses (1 = best). Lower is better.
          </p>
          <RankTable
            rankings={scoreResult.rankings}
            options={filledOptions}
            variableKeys={variableKeys}
            variableLabels={variableLabels}
            optionCount={filledOptions.length}
          />
        </div>

        <div className="v2-section">
          <PassDebug
            passes={scoreResult.passes}
            options={filledOptions}
            variableKeys={variableKeys}
            variableLabels={variableLabels}
            optionCount={filledOptions.length}
          />
        </div>
      </>
    );
  }

  return (
    <div className="v2-app">
      <h1>V2 Poll Engine</h1>
      <p className="subtitle">Debug: Segment-first voting with dynamic audience modeling</p>

      <ApiKeyInput apiKey={apiKey} onSave={saveKey} onClear={clearKey} />

      {!hasKey ? null : step === 'input' ? (
        <div className="v2-input-section">
          <label htmlFor="v2-question">Poll Question</label>
          <textarea
            id="v2-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What should we name our new energy drink?"
          />

          <label className="v2-options-label">Answer Options</label>
          <div className="options-list">
            {options.map((opt, i) => (
              <div key={i} className="option-row">
                <span className="option-number">{i + 1}</span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="option-input"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="btn-remove-option"
                    onClick={() => removeOption(i)}
                    title="Remove option"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-add-option" onClick={addOption}>
              + Add Option
            </button>
          </div>

          <div className="v2-actions">
            <button className="btn-primary" disabled={!canProceed} onClick={handleGenerate}>
              Proceed to Segments
            </button>
          </div>
        </div>
      ) : step === 'generating' ? (
        <div className="v2-loading">
          <div className="v2-spinner" />
          <p>Generating segments and variables...</p>
        </div>
      ) : step === 'scoring' ? (
        <div className="v2-results">
          {renderFramework()}
          <div className="v2-loading">
            <div className="v2-spinner" />
            <p>Scoring options (defining variables, then 3 ranking lenses)...</p>
          </div>
        </div>
      ) : step === 'aggregating' ? (
        <div className="v2-results">
          {renderFramework()}
          {renderScoredDetails()}
          <div className="v2-loading">
            <div className="v2-spinner" />
            <p>Simulating 10,000 votes and generating analysis...</p>
          </div>
        </div>
      ) : step === 'error' ? (
        <div className="v2-error">
          <p>{errorMsg || 'Something failed. Check your API key and try again.'}</p>
          <button className="btn-primary" onClick={handleReset}>Back to Input</button>
        </div>
      ) : step === 'segments' && framework ? (
        <div className="v2-results">
          {renderFramework()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button className="btn-primary" onClick={handleScore}>
              Score Options
            </button>
            <button className="btn-secondary" onClick={handleReset}>Start Over</button>
          </div>
        </div>
      ) : step === 'scored' && framework && scoreResult ? (
        <div className="v2-results">
          {renderFramework()}
          {renderScoredDetails()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button className="btn-primary" onClick={handleAggregate}>
              Run Vote Simulation
            </button>
            <button className="btn-secondary" onClick={handleReset}>Start Over</button>
          </div>
        </div>
      ) : step === 'results' && voteData ? (
        <div className="v2-results">
          <VoteParticleViz
            segmentVotes={voteData.segmentVotes}
            aggregates={voteData.aggregates}
            options={filledOptions}
          />
          <div className="v2-vote-stats-row">
            {filledOptions.map((opt) => {
              const isWinner = opt === voteData.aggregates.winner;
              return (
                <div key={opt} className={`v2-vote-stat-card ${isWinner ? 'winner' : ''}`}>
                  {isWinner && <span className="v2-winner-badge">Winner</span>}
                  <span className="v2-stat-option">{opt}</span>
                  <span className="v2-stat-count">{voteData.aggregates.voteCounts[opt].toLocaleString()}</span>
                  <span className="v2-stat-pct">{voteData.aggregates.votePercentages[opt].toFixed(1)}%</span>
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
                {sv.segmentName}
              </span>
            ))}
          </div>

          {narrative ? (
            <NarrativeSummary narrative={narrative} />
          ) : (
            <div className="v2-loading">
              <div className="v2-spinner" />
              <p>Generating narrative analysis...</p>
            </div>
          )}

          <V2SegmentBreakdown segmentVotes={voteData.segmentVotes} options={filledOptions} />
          <V2DriverDecompositionView drivers={voteData.drivers} />

          <details className="v2-detail-section">
            <summary>Full Framework &amp; Scoring Details</summary>
            <div className="v2-results" style={{ paddingTop: '1rem' }}>
              {renderFramework()}
              {renderScoredDetails()}
            </div>
          </details>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={handleReset}>Start Over</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
