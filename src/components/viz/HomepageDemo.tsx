import { useState } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';
import { VoteParticleViz } from '../v2/VoteParticleViz';
import '../../App.css';
import '../v2/V2App.css';
import '../v3/V3App.css';

const MOCK_OPTIONS = ['Golden Retriever', 'French Bulldog', 'Labrador', 'Poodle', 'Beagle'];

function generateMockData(): { segmentVotes: V2SegmentVoteResult[]; aggregates: V2VoteAggregates } {
  const counts: Record<string, number> = {
    'Golden Retriever': 68, 'French Bulldog': 47, 'Labrador': 41, 'Poodle': 25, 'Beagle': 19,
  };
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const pcts: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) pcts[k] = (v / total) * 100;

  return {
    segmentVotes: [{
      segmentName: 'General', populationShare: 1, votesAllocated: total,
      voteCounts: counts, votePercentages: pcts, preferenceScores: counts, winnerInSegment: 'Golden Retriever',
    }],
    aggregates: {
      totalVotes: total, voteCounts: counts, votePercentages: pcts,
      winner: 'Golden Retriever', winnerCount: 68, winnerPercentage: pcts['Golden Retriever'],
      runnerUp: 'French Bulldog', runnerUpCount: 47, runnerUpPercentage: pcts['French Bulldog'],
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Version 1: Hero with viz below, warm palette                       */
/* ------------------------------------------------------------------ */
function V1({ data, replayKey }: { data: ReturnType<typeof generateMockData>; replayKey: number }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0c0c1a', color: '#f0f0f0', padding: '0 16px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', paddingTop: '12vh', textAlign: 'center' }}>
        <h1 style={{ fontSize: '42px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '12px',
          background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Decision Wolf
        </h1>
        <p style={{ fontSize: '17px', color: '#b0b8c8', lineHeight: 1.6, maxWidth: 480, margin: '0 auto 32px' }}>
          Generate hundreds of synthetic AI voters with custom segments to poll on any question.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '48px' }}>
          <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '15px', borderRadius: '10px' }}>
            Get Started
          </button>
        </div>
        <div key={replayKey} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px 8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Live preview — "What dog breed should I adopt?"</p>
          <VoteParticleViz segmentVotes={data.segmentVotes} aggregates={data.aggregates} options={MOCK_OPTIONS} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 2: Split screen — text left, viz right                     */
/* ------------------------------------------------------------------ */
function V2({ data, replayKey }: { data: ReturnType<typeof generateMockData>; replayKey: number }) {
  return (
    <div style={{ minHeight: '100vh', background: '#09090f', color: '#f0f0f0', display: 'flex', alignItems: 'center', padding: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', maxWidth: 1000, margin: '0 auto', width: '100%', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6366f1', marginBottom: '12px', fontWeight: 600 }}>
            AI-Powered Polling
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1.15, marginBottom: '16px', color: '#fff' }}>
            Ask any question.<br />Get real answers.
          </h1>
          <p style={{ fontSize: '16px', color: '#8892a6', lineHeight: 1.6, marginBottom: '28px' }}>
            Decision Wolf generates hundreds of diverse AI voters across custom audience segments. See how different groups think — in seconds.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-primary" style={{ padding: '12px 24px', borderRadius: '8px' }}>Get Started</button>
            <button className="btn-secondary" style={{ padding: '12px 24px', borderRadius: '8px' }}>Learn More</button>
          </div>
        </div>
        <div key={replayKey} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '12px 4px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <VoteParticleViz segmentVotes={data.segmentVotes} aggregates={data.aggregates} options={MOCK_OPTIONS} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 3: Centered minimal with glowing viz                       */
/* ------------------------------------------------------------------ */
function V3({ data, replayKey }: { data: ReturnType<typeof generateMockData>; replayKey: number }) {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #1a1040 0%, #0a0a14 60%)', color: '#f0f0f0', padding: '0 16px' }}>
      <div style={{ maxWidth: 660, margin: '0 auto', paddingTop: '10vh', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: '#a78bfa', marginBottom: '16px', fontWeight: 500 }}>
          Synthetic Polling Engine
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: 700, lineHeight: 1.2, marginBottom: '14px', color: '#e8e0f8' }}>
          What would 500 people think?
        </h1>
        <p style={{ fontSize: '16px', color: '#7a8098', lineHeight: 1.6, maxWidth: 420, margin: '0 auto 36px' }}>
          Poll any question across AI-generated audience segments. Multi-model voting with confidence intervals.
        </p>
        <button className="btn-primary" style={{
          padding: '14px 36px', fontSize: '16px', borderRadius: '12px', marginBottom: '48px',
          background: '#6366f1', boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)',
        }}>
          Start Polling
        </button>
        <div key={replayKey} style={{
          borderRadius: '16px', padding: '16px 8px', position: 'relative',
          background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.12)',
          boxShadow: '0 0 60px rgba(99, 102, 241, 0.08)',
        }}>
          <VoteParticleViz segmentVotes={data.segmentVotes} aggregates={data.aggregates} options={MOCK_OPTIONS} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 4: Dark with high contrast, stats-forward                  */
/* ------------------------------------------------------------------ */
function V4({ data, replayKey }: { data: ReturnType<typeof generateMockData>; replayKey: number }) {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '0 16px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', paddingTop: '10vh' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Decision Wolf
          </h1>
          <p style={{ fontSize: '18px', color: '#aaa', fontWeight: 300 }}>
            Synthetic audience intelligence
          </p>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '36px',
          padding: '16px 0', borderTop: '1px solid #222', borderBottom: '1px solid #222',
        }}>
          {[
            { label: 'AI Models', value: '3' },
            { label: 'Voters per poll', value: '200-500' },
            { label: 'Confidence intervals', value: '95%' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <button className="btn-primary" style={{
          display: 'block', margin: '0 auto 40px', padding: '14px 40px', fontSize: '16px',
          borderRadius: '8px', background: '#fff', color: '#000', fontWeight: 700,
        }}>
          Try It Now
        </button>

        <div key={replayKey} style={{ borderRadius: '12px', padding: '12px 4px', border: '1px solid #1a1a1a' }}>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#444', marginBottom: '8px' }}>
            "What dog breed should I adopt?" — 200 voters
          </p>
          <VoteParticleViz segmentVotes={data.segmentVotes} aggregates={data.aggregates} options={MOCK_OPTIONS} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 5: Viz as full background, glassmorphism overlay            */
/* ------------------------------------------------------------------ */
function V5({ data, replayKey }: { data: ReturnType<typeof generateMockData>; replayKey: number }) {
  return (
    <div style={{ minHeight: '100vh', background: '#060610', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* Viz as background */}
      <div key={replayKey} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }}>
        <div style={{ maxWidth: 900, margin: '80px auto 0' }}>
          <VoteParticleViz segmentVotes={data.segmentVotes} aggregates={data.aggregates} options={MOCK_OPTIONS} />
        </div>
      </div>

      {/* Overlay content */}
      <div style={{
        position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px',
      }}>
        <div style={{
          background: 'rgba(10, 10, 20, 0.75)', backdropFilter: 'blur(20px)',
          borderRadius: '20px', padding: '48px 40px', maxWidth: 480, textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '12px',
            background: 'linear-gradient(135deg, #818cf8, #38bdf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Decision Wolf
          </h1>
          <p style={{ fontSize: '15px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '28px' }}>
            Generate hundreds of synthetic AI voters with custom segments to poll on any question. Deeper, more tailored insights.
          </p>
          <button className="btn-primary" style={{
            padding: '14px 36px', fontSize: '15px', borderRadius: '10px', width: '100%',
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)', border: 'none',
          }}>
            Get Started
          </button>
          <p style={{ fontSize: '12px', color: '#555', marginTop: '16px' }}>
            Powered by OpenAI, Claude & Gemini
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Demo switcher                                                      */
/* ------------------------------------------------------------------ */

const VERSIONS = [
  { name: '1. Gradient hero + viz below', key: '1' },
  { name: '2. Split screen', key: '2' },
  { name: '3. Glow centered', key: '3' },
  { name: '4. High contrast stats', key: '4' },
  { name: '5. Viz background + glass card', key: '5' },
];

export function HomepageDemo() {
  const [active, setActive] = useState('1');
  const [replayKey, setReplayKey] = useState(0);
  const data = generateMockData();

  function switchTo(key: string) {
    setActive(key);
    setReplayKey((k) => k + 1);
  }

  return (
    <div>
      {/* Floating nav */}
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
        display: 'flex', gap: '4px', padding: '4px', borderRadius: '10px',
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {VERSIONS.map((v) => (
          <button
            key={v.key}
            onClick={() => switchTo(v.key)}
            style={{
              padding: '6px 12px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer',
              border: 'none', whiteSpace: 'nowrap',
              background: active === v.key ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
              color: active === v.key ? '#a5b4fc' : '#888',
            }}
          >
            {v.name}
          </button>
        ))}
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          style={{
            padding: '6px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer',
            border: 'none', background: 'transparent', color: '#888',
          }}
        >
          ↻
        </button>
      </div>

      {active === '1' && <V1 data={data} replayKey={replayKey} />}
      {active === '2' && <V2 data={data} replayKey={replayKey} />}
      {active === '3' && <V3 data={data} replayKey={replayKey} />}
      {active === '4' && <V4 data={data} replayKey={replayKey} />}
      {active === '5' && <V5 data={data} replayKey={replayKey} />}
    </div>
  );
}
