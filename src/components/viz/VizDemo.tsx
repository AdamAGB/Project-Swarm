import { useState } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';
import { VoteParticleViz } from '../v2/VoteParticleViz';
import { Viz1GravityBuckets } from './Viz1GravityBuckets';
import { Viz2BarRace } from './Viz2BarRace';
import { Viz3RadialBurst } from './Viz3RadialBurst';
import { Viz4WaveForm } from './Viz4WaveForm';
import { Viz5StreamFlow } from './Viz5StreamFlow';
import '../v2/V2App.css';

const MOCK_OPTIONS = ['Golden Retriever', 'French Bulldog', 'Labrador', 'Poodle'];

function generateMockData(): { segmentVotes: V2SegmentVoteResult[]; aggregates: V2VoteAggregates } {
  const counts: Record<string, number> = {
    'Golden Retriever': 78,
    'French Bulldog': 52,
    'Labrador': 45,
    'Poodle': 25,
  };
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const pcts: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) pcts[k] = (v / total) * 100;

  const segmentVotes: V2SegmentVoteResult[] = [
    {
      segmentName: 'General',
      populationShare: 1,
      votesAllocated: total,
      voteCounts: counts,
      votePercentages: pcts,
      preferenceScores: counts,
      winnerInSegment: 'Golden Retriever',
    },
  ];

  const aggregates: V2VoteAggregates = {
    totalVotes: total,
    voteCounts: counts,
    votePercentages: pcts,
    winner: 'Golden Retriever',
    winnerCount: 78,
    winnerPercentage: pcts['Golden Retriever'],
    runnerUp: 'French Bulldog',
    runnerUpCount: 52,
    runnerUpPercentage: pcts['French Bulldog'],
  };

  return { segmentVotes, aggregates };
}

const VIZZES = [
  { name: 'Current (Dots → Doors)', key: 'current' },
  { name: '1. Gravity Buckets', key: 'gravity' },
  { name: '2. Bar Race', key: 'bar' },
  { name: '3. Radial Burst', key: 'radial' },
  { name: '4. Wave Form', key: 'wave' },
  { name: '5. Stream Flow', key: 'stream' },
];

export function VizDemo() {
  const [activeViz, setActiveViz] = useState('current');
  const [replayKey, setReplayKey] = useState(0);
  const { segmentVotes, aggregates } = generateMockData();

  function replay() {
    setReplayKey((k) => k + 1);
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Visualization Picker</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
        "Which dog breed should I adopt?" — {aggregates.totalVotes} votes
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {VIZZES.map((v) => (
          <button
            key={v.key}
            onClick={() => { setActiveViz(v.key); replay(); }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 6,
              border: activeViz === v.key ? '1px solid #4a9eff' : '1px solid #444',
              background: activeViz === v.key ? 'rgba(74, 158, 255, 0.15)' : 'transparent',
              color: activeViz === v.key ? '#4a9eff' : '#aaa',
              cursor: 'pointer',
            }}
          >
            {v.name}
          </button>
        ))}
        <button
          onClick={replay}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid #444',
            background: 'transparent',
            color: '#aaa',
            cursor: 'pointer',
          }}
        >
          &#x21bb; Replay
        </button>
      </div>

      <div key={replayKey} style={{ background: '#0a0a1a', borderRadius: 10, padding: '12px 0', overflow: 'hidden' }}>
        {activeViz === 'current' && (
          <VoteParticleViz segmentVotes={segmentVotes} aggregates={aggregates} options={MOCK_OPTIONS} />
        )}
        {activeViz === 'gravity' && (
          <Viz1GravityBuckets segmentVotes={segmentVotes} aggregates={aggregates} options={MOCK_OPTIONS} />
        )}
        {activeViz === 'bar' && (
          <Viz2BarRace segmentVotes={segmentVotes} aggregates={aggregates} options={MOCK_OPTIONS} />
        )}
        {activeViz === 'radial' && (
          <Viz3RadialBurst segmentVotes={segmentVotes} aggregates={aggregates} options={MOCK_OPTIONS} />
        )}
        {activeViz === 'wave' && (
          <Viz4WaveForm segmentVotes={segmentVotes} aggregates={aggregates} options={MOCK_OPTIONS} />
        )}
        {activeViz === 'stream' && (
          <Viz5StreamFlow segmentVotes={segmentVotes} aggregates={aggregates} options={MOCK_OPTIONS} />
        )}
      </div>
    </div>
  );
}
