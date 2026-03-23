import { useState, useCallback } from 'react';
import { VoteParticleViz, SEGMENT_COLORS } from './VoteParticleViz';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';
import './V2App.css';

const PRESETS = {
  'Landslide (4 options, 5 segments)': {
    options: ['ThunderVolt', 'ZenFuel', 'CorePulse', 'AquaRush'],
    segments: [
      { name: 'Budget Pragmatists', share: 0.3, splits: [0.15, 0.45, 0.25, 0.15] },
      { name: 'Premium Seekers', share: 0.2, splits: [0.1, 0.55, 0.2, 0.15] },
      { name: 'Brand Loyalists', share: 0.2, splits: [0.2, 0.35, 0.3, 0.15] },
      { name: 'Health Skeptics', share: 0.15, splits: [0.25, 0.3, 0.25, 0.2] },
      { name: 'Convenience Shoppers', share: 0.15, splits: [0.2, 0.4, 0.2, 0.2] },
    ],
  },
  'Close race (3 options, 4 segments)': {
    options: ['Alpha', 'Beta', 'Gamma'],
    segments: [
      { name: 'Young Professionals', share: 0.35, splits: [0.38, 0.32, 0.30] },
      { name: 'Families', share: 0.25, splits: [0.28, 0.40, 0.32] },
      { name: 'Retirees', share: 0.25, splits: [0.30, 0.30, 0.40] },
      { name: 'Students', share: 0.15, splits: [0.35, 0.30, 0.35] },
    ],
  },
  'Two-way split (2 options, 3 segments)': {
    options: ['Yes', 'No'],
    segments: [
      { name: 'Supporters', share: 0.45, splits: [0.72, 0.28] },
      { name: 'Opponents', share: 0.35, splits: [0.25, 0.75] },
      { name: 'Undecided', share: 0.2, splits: [0.52, 0.48] },
    ],
  },
  'Many options (6 options, 6 segments)': {
    options: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'],
    segments: [
      { name: 'Segment A', share: 0.2, splits: [0.30, 0.20, 0.15, 0.15, 0.10, 0.10] },
      { name: 'Segment B', share: 0.18, splits: [0.10, 0.35, 0.15, 0.15, 0.15, 0.10] },
      { name: 'Segment C', share: 0.17, splits: [0.15, 0.10, 0.30, 0.20, 0.10, 0.15] },
      { name: 'Segment D', share: 0.17, splits: [0.10, 0.15, 0.10, 0.30, 0.20, 0.15] },
      { name: 'Segment E', share: 0.15, splits: [0.15, 0.15, 0.15, 0.10, 0.30, 0.15] },
      { name: 'Segment F', share: 0.13, splits: [0.10, 0.10, 0.15, 0.15, 0.15, 0.35] },
    ],
  },
};

type PresetKey = keyof typeof PRESETS;

function buildMockData(preset: (typeof PRESETS)[PresetKey], totalVotes: number) {
  const { options, segments } = preset;

  const segmentVotes: V2SegmentVoteResult[] = segments.map((seg) => {
    const allocated = Math.round(totalVotes * seg.share);
    const voteCounts: Record<string, number> = {};
    const votePercentages: Record<string, number> = {};
    const preferenceScores: Record<string, number> = {};
    let remaining = allocated;

    options.forEach((opt, i) => {
      const isLast = i === options.length - 1;
      const count = isLast ? remaining : Math.round(allocated * seg.splits[i]);
      voteCounts[opt] = count;
      remaining -= count;
      votePercentages[opt] = allocated > 0 ? (count / allocated) * 100 : 0;
      preferenceScores[opt] = seg.splits[i];
    });

    const winnerInSegment = options.reduce((a, b) => voteCounts[a] >= voteCounts[b] ? a : b);

    return {
      segmentName: seg.name,
      populationShare: seg.share,
      votesAllocated: allocated,
      voteCounts,
      votePercentages,
      preferenceScores,
      winnerInSegment,
    };
  });

  // Aggregate
  const voteCounts: Record<string, number> = {};
  const votePercentages: Record<string, number> = {};
  options.forEach((opt) => {
    voteCounts[opt] = segmentVotes.reduce((sum, sv) => sum + (sv.voteCounts[opt] ?? 0), 0);
  });
  const actualTotal = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  options.forEach((opt) => {
    votePercentages[opt] = actualTotal > 0 ? (voteCounts[opt] / actualTotal) * 100 : 0;
  });

  const sorted = [...options].sort((a, b) => voteCounts[b] - voteCounts[a]);
  const winner = sorted[0];
  const runnerUp = sorted[1] ?? sorted[0];

  const aggregates: V2VoteAggregates = {
    totalVotes: actualTotal,
    voteCounts,
    votePercentages,
    winner,
    winnerCount: voteCounts[winner],
    winnerPercentage: votePercentages[winner],
    runnerUp,
    runnerUpCount: voteCounts[runnerUp],
    runnerUpPercentage: votePercentages[runnerUp],
  };

  return { segmentVotes, aggregates, options };
}

export function ParticlePlayground() {
  const [presetKey, setPresetKey] = useState<PresetKey>('Landslide (4 options, 5 segments)');
  const [totalVotes, setTotalVotes] = useState(10000);
  const [runId, setRunId] = useState(0);

  const data = buildMockData(PRESETS[presetKey], totalVotes);

  const replay = useCallback(() => {
    setRunId((n) => n + 1);
  }, []);

  return (
    <div className="v2-app" style={{ maxWidth: 1000 }}>
      <h1>Particle Viz Playground</h1>
      <p className="subtitle">Tweak settings and replay to iterate on the animation</p>

      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '1 1 250px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Preset
          </label>
          <select
            value={presetKey}
            onChange={(e) => { setPresetKey(e.target.value as PresetKey); setRunId((n) => n + 1); }}
            style={{
              padding: '0.45rem 0.6rem',
              fontSize: '0.85rem',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            {Object.keys(PRESETS).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: '0 0 160px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Total Votes: {totalVotes.toLocaleString()}
          </label>
          <input
            type="range"
            min={500}
            max={20000}
            step={500}
            value={totalVotes}
            onChange={(e) => setTotalVotes(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <button
          className="btn-primary"
          onClick={replay}
          style={{ alignSelf: 'flex-end' }}
        >
          Replay Animation
        </button>
      </div>

      <VoteParticleViz
        key={runId}
        segmentVotes={data.segmentVotes}
        aggregates={data.aggregates}
        options={data.options}
      />

      <div className="v2-segment-color-legend" style={{ marginTop: '0.75rem' }}>
        {data.segmentVotes.map((sv, i) => (
          <span key={sv.segmentName} className="v2-segment-color-legend-item">
            <span
              className="v2-legend-dot"
              style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
            />
            {sv.segmentName}
          </span>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="v2-vote-stats-row">
          {data.options.map((opt) => {
            const isWinner = opt === data.aggregates.winner;
            return (
              <div key={opt} className={`v2-vote-stat-card ${isWinner ? 'winner' : ''}`}>
                {isWinner && <span className="v2-winner-badge">Winner</span>}
                <span className="v2-stat-option">{opt}</span>
                <span className="v2-stat-count">{data.aggregates.voteCounts[opt].toLocaleString()}</span>
                <span className="v2-stat-pct">{data.aggregates.votePercentages[opt].toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <details style={{ marginTop: '1rem' }}>
        <summary style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          Raw mock data
        </summary>
        <pre style={{
          fontSize: '0.7rem',
          background: 'var(--color-surface-alt)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-sm)',
          overflow: 'auto',
          maxHeight: 300,
        }}>
          {JSON.stringify({ segmentVotes: data.segmentVotes, aggregates: data.aggregates }, null, 2)}
        </pre>
      </details>
    </div>
  );
}
