import { useState } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';
import { VoteParticleViz } from '../v2/VoteParticleViz';
import '../../App.css';
import '../v2/V2App.css';
import '../v3/V3App.css';

const OPTIONS = ['Red', 'Blue', 'Clear', 'Orange', 'Brown'];
function mockData() {
  const counts: Record<string, number> = { Red: 72, Blue: 48, Clear: 38, Orange: 28, Brown: 14 };
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const pcts: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) pcts[k] = (v / total) * 100;
  return {
    sv: [{ segmentName: 'General', populationShare: 1, votesAllocated: total, voteCounts: counts, votePercentages: pcts, preferenceScores: counts, winnerInSegment: 'Red' }] as V2SegmentVoteResult[],
    agg: { totalVotes: total, voteCounts: counts, votePercentages: pcts, winner: 'Red', winnerCount: 72, winnerPercentage: pcts['Red'], runnerUp: 'Blue', runnerUpCount: 48, runnerUpPercentage: pcts['Blue'] } as V2VoteAggregates,
  };
}

interface Theme {
  bg: string; cardBg: string; border: string; accent: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  inputBg: string; inputBorder: string;
}

const THEMES: { name: string; theme: Theme }[] = [
  {
    name: '1. Midnight Indigo',
    theme: { bg: '#0a0e1a', cardBg: '#111827', border: '#1e2740', accent: '#6366f1', textPrimary: '#f1f0eb', textSecondary: '#9ca3b8', textMuted: '#4b5568', inputBg: '#0f1629', inputBorder: '#263354' },
  },
  {
    name: '2. Warm Charcoal',
    theme: { bg: '#141210', cardBg: '#1c1a17', border: '#2a2722', accent: '#f59e0b', textPrimary: '#e8e4dc', textSecondary: '#a8a090', textMuted: '#5c564c', inputBg: '#1a1816', inputBorder: '#332f28' },
  },
  {
    name: '3. Deep Forest',
    theme: { bg: '#0a1210', cardBg: '#0f1c18', border: '#1a3028', accent: '#10b981', textPrimary: '#e8f0ec', textSecondary: '#88a898', textMuted: '#3d5a4c', inputBg: '#0c1812', inputBorder: '#1e3a2c' },
  },
  {
    name: '4. Slate Blue',
    theme: { bg: '#111827', cardBg: '#1e293b', border: '#334155', accent: '#3b82f6', textPrimary: '#f8fafc', textSecondary: '#94a3b8', textMuted: '#475569', inputBg: '#0f172a', inputBorder: '#334155' },
  },
  {
    name: '5. Obsidian',
    theme: { bg: '#050505', cardBg: '#0e0e0e', border: '#1a1a1a', accent: '#ffffff', textPrimary: '#ffffff', textSecondary: '#a0a0a0', textMuted: '#444444', inputBg: '#0a0a0a', inputBorder: '#222222' },
  },
  {
    name: '6. Plum Noir',
    theme: { bg: '#0e0a14', cardBg: '#16101e', border: '#2a1e38', accent: '#a855f7', textPrimary: '#f0e8f8', textSecondary: '#9888b0', textMuted: '#4a3860', inputBg: '#120e1a', inputBorder: '#2e2240' },
  },
  {
    name: '7. Arctic Steel',
    theme: { bg: '#f4f6f8', cardBg: '#ffffff', border: '#e2e6ea', accent: '#2563eb', textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8', inputBg: '#f8fafc', inputBorder: '#d1d5db' },
  },
  {
    name: '8. Copper Dark',
    theme: { bg: '#0c0a08', cardBg: '#161210', border: '#2a221c', accent: '#ea580c', textPrimary: '#f4ece4', textSecondary: '#b0a090', textMuted: '#5c4e40', inputBg: '#12100c', inputBorder: '#302820' },
  },
  {
    name: '9. Ocean Night',
    theme: { bg: '#080c14', cardBg: '#0c1220', border: '#162038', accent: '#06b6d4', textPrimary: '#e0f0f8', textSecondary: '#78a8c0', textMuted: '#2a4a60', inputBg: '#0a1018', inputBorder: '#1a2e48' },
  },
  {
    name: '10. Rose Dark',
    theme: { bg: '#100a0c', cardBg: '#1a1214', border: '#301e24', accent: '#f43f5e', textPrimary: '#f8e8ec', textSecondary: '#b08890', textMuted: '#5a3a42', inputBg: '#140e10', inputBorder: '#38222a' },
  },
];

function Page({ theme: t, replayKey }: { theme: Theme; replayKey: number }) {
  const { sv, agg } = mockData();
  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: t.textPrimary }}>Decision Wolf</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: t.textMuted }}>Hosted mode — change</span>
      </div>

      {/* Split: left copy, right viz */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', maxWidth: 1000, margin: '0 auto', width: '100%', padding: '48px 24px', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: t.accent, marginBottom: '14px', fontWeight: 600 }}>
            Synthetic Audience Intelligence
          </div>
          <h1 style={{ fontSize: '34px', fontWeight: 800, lineHeight: 1.15, marginBottom: '16px', color: t.textPrimary }}>
            Test any idea with<br />hundreds of AI voters.
          </h1>
          <p style={{ fontSize: '15px', color: t.textSecondary, lineHeight: 1.6, marginBottom: '28px' }}>
            Generate synthetic audiences across custom segments. See how different groups respond — powered by GPT, Claude, and Gemini.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
            <button style={{ flex: 1, padding: '14px 12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', border: `2px solid ${t.accent}`, background: `${t.accent}12` }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: t.textPrimary, marginBottom: '3px' }}>Simple — Hosted</div>
              <div style={{ fontSize: '11px', color: t.textMuted }}>Enter invite code</div>
            </button>
            <button style={{ flex: 1, padding: '14px 12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', border: `1px solid ${t.border}`, background: t.cardBg }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: t.textPrimary, marginBottom: '3px' }}>Advanced — Own Keys</div>
              <div style={{ fontSize: '11px', color: t.textMuted }}>Bring OpenAI, Claude, Gemini</div>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="text" placeholder="Enter invite code" style={{ flex: 1, padding: '10px 14px', fontSize: '14px', background: t.inputBg, borderRadius: '8px', color: t.textPrimary, border: `1px solid ${t.inputBorder}` }} />
            <button style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '8px', border: 'none', background: t.accent, color: t.bg === '#f4f6f8' ? '#fff' : '#fff', cursor: 'pointer' }}>Continue</button>
          </div>
        </div>
        <div key={replayKey} style={{ background: t.cardBg, borderRadius: '14px', padding: '20px 12px', border: `1px solid ${t.border}` }}>
          <p style={{ textAlign: 'center', fontSize: '14px', color: t.textSecondary, marginBottom: '10px', fontStyle: 'italic' }}>
            "What's the best gummy bear color?"
          </p>
          <VoteParticleViz segmentVotes={sv} aggregates={agg} options={OPTIONS} />
        </div>
      </div>

      {/* Input page preview */}
      <div style={{ borderTop: `1px solid ${t.border}`, padding: '48px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: t.textMuted, marginBottom: '8px' }}>Logged-in input page preview:</p>
          <p style={{ fontSize: '20px', color: t.textSecondary, fontWeight: 300, marginBottom: '20px' }}>Ask a question, poll your swarm</p>
          <textarea placeholder="e.g. Which tagline resonates best?" rows={2} style={{ width: '100%', padding: '14px 18px', fontSize: '16px', lineHeight: 1.5, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '10px', color: t.textPrimary, resize: 'none' }} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
            <button style={{ padding: '11px 28px', borderRadius: '8px', fontSize: '14px', background: t.accent, color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Add Poll</button>
            <button style={{ padding: '11px 20px', borderRadius: '8px', fontSize: '14px', background: t.cardBg, color: t.textPrimary, border: `1px solid ${t.border}`, cursor: 'pointer' }}>I'm Feeling Lucky</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ColorDemo() {
  const [active, setActive] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div>
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
        display: 'flex', gap: '3px', padding: '4px', borderRadius: '10px',
        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', maxWidth: '95vw', justifyContent: 'center',
      }}>
        {THEMES.map((t, i) => (
          <button
            key={t.name}
            onClick={() => { setActive(i); setReplayKey((k) => k + 1); }}
            style={{
              padding: '5px 10px', fontSize: '10px', borderRadius: '5px', cursor: 'pointer',
              border: 'none', whiteSpace: 'nowrap',
              background: active === i ? `${t.theme.accent}40` : 'transparent',
              color: active === i ? t.theme.accent : '#888',
            }}
          >
            {t.name}
          </button>
        ))}
        <button onClick={() => setReplayKey((k) => k + 1)} style={{ padding: '5px 8px', fontSize: '10px', borderRadius: '5px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#888' }}>↻</button>
      </div>
      <Page theme={THEMES[active].theme} replayKey={replayKey} />
    </div>
  );
}
