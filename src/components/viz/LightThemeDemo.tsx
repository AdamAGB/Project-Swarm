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
  name: string;
  bg: string; cardBg: string; border: string; accent: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  inputBg: string; inputBorder: string; headerBg: string;
  btnSecondaryBg: string; btnSecondaryBorder: string;
}

const THEMES: Theme[] = [
  {
    name: '1. Cool Steel',
    bg: '#f4f6f8', cardBg: '#ffffff', border: '#e2e6ea', accent: '#2563eb',
    textPrimary: '#0f172a', textSecondary: '#475569', textMuted: '#94a3b8',
    inputBg: '#f8fafc', inputBorder: '#d1d5db', headerBg: '#ffffff',
    btnSecondaryBg: '#f1f5f9', btnSecondaryBorder: '#d1d5db',
  },
  {
    name: '2. Warm Paper',
    bg: '#f9f7f4', cardBg: '#ffffff', border: '#e8e2d8', accent: '#b45309',
    textPrimary: '#1c1410', textSecondary: '#6b5c4e', textMuted: '#a89888',
    inputBg: '#fdfbf8', inputBorder: '#d6cec2', headerBg: '#faf8f5',
    btnSecondaryBg: '#f5f0ea', btnSecondaryBorder: '#d6cec2',
  },
  {
    name: '3. Clean White',
    bg: '#ffffff', cardBg: '#f8f9fa', border: '#eaedf0', accent: '#111111',
    textPrimary: '#111111', textSecondary: '#555555', textMuted: '#999999',
    inputBg: '#f5f5f5', inputBorder: '#dddddd', headerBg: '#ffffff',
    btnSecondaryBg: '#f5f5f5', btnSecondaryBorder: '#dddddd',
  },
  {
    name: '4. Soft Lavender',
    bg: '#f5f3f8', cardBg: '#ffffff', border: '#e4ddf0', accent: '#7c3aed',
    textPrimary: '#1a1528', textSecondary: '#5c5070', textMuted: '#9b90a8',
    inputBg: '#faf8fc', inputBorder: '#d4cce2', headerBg: '#f8f5fb',
    btnSecondaryBg: '#f0ecf5', btnSecondaryBorder: '#d4cce2',
  },
  {
    name: '5. Mint Fresh',
    bg: '#f2f8f6', cardBg: '#ffffff', border: '#d8ece4', accent: '#059669',
    textPrimary: '#0a1f18', textSecondary: '#3d6858', textMuted: '#7aaa98',
    inputBg: '#f6fbf9', inputBorder: '#c8e0d6', headerBg: '#f4faf8',
    btnSecondaryBg: '#eaf5f0', btnSecondaryBorder: '#c8e0d6',
  },
  {
    name: '6. Light Slate',
    bg: '#f0f2f5', cardBg: '#ffffff', border: '#dce0e5', accent: '#4f46e5',
    textPrimary: '#1e1e2e', textSecondary: '#545468', textMuted: '#8e8ea0',
    inputBg: '#f5f6f8', inputBorder: '#cdd1d8', headerBg: '#f8f9fb',
    btnSecondaryBg: '#eceef2', btnSecondaryBorder: '#cdd1d8',
  },
  {
    name: '7. Sunny',
    bg: '#fffdf5', cardBg: '#ffffff', border: '#f0e8d0', accent: '#d97706',
    textPrimary: '#1a1806', textSecondary: '#6b6340', textMuted: '#a89c70',
    inputBg: '#fefcf4', inputBorder: '#e4dcc0', headerBg: '#fffef8',
    btnSecondaryBg: '#faf6e8', btnSecondaryBorder: '#e4dcc0',
  },
  {
    name: '8. Ice Blue',
    bg: '#f0f5fa', cardBg: '#ffffff', border: '#d4e2f0', accent: '#0284c7',
    textPrimary: '#0c1824', textSecondary: '#3e5c74', textMuted: '#7098b8',
    inputBg: '#f4f8fc', inputBorder: '#c0d4e6', headerBg: '#f2f7fc',
    btnSecondaryBg: '#e8f0f8', btnSecondaryBorder: '#c0d4e6',
  },
  {
    name: '9. Blush',
    bg: '#faf5f5', cardBg: '#ffffff', border: '#ecd8d8', accent: '#dc2626',
    textPrimary: '#1c0e0e', textSecondary: '#6b4a4a', textMuted: '#a88888',
    inputBg: '#fcf8f8', inputBorder: '#e0c8c8', headerBg: '#fbf7f7',
    btnSecondaryBg: '#f5ecec', btnSecondaryBorder: '#e0c8c8',
  },
  {
    name: '10. Concrete',
    bg: '#edeef0', cardBg: '#f8f8f9', border: '#d8dadf', accent: '#334155',
    textPrimary: '#0f1115', textSecondary: '#4a4e58', textMuted: '#868c98',
    inputBg: '#f2f3f5', inputBorder: '#cccfd5', headerBg: '#f2f3f5',
    btnSecondaryBg: '#e4e6ea', btnSecondaryBorder: '#cccfd5',
  },
];

function Page({ t, replayKey }: { t: Theme; replayKey: number }) {
  const { sv, agg } = mockData();
  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}`, background: t.headerBg }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: t.textPrimary }}>Decision Wolf</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: t.textMuted }}>Hosted mode — change</span>
      </div>

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
            <button style={{ flex: 1, padding: '14px 12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', border: `2px solid ${t.accent}`, background: `${t.accent}0a` }}>
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
            <button style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600, borderRadius: '8px', border: 'none', background: t.accent, color: '#fff', cursor: 'pointer' }}>Continue</button>
          </div>
        </div>
        <div key={replayKey} style={{ background: t.cardBg, borderRadius: '14px', padding: '20px 12px', border: `1px solid ${t.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p style={{ textAlign: 'center', fontSize: '14px', color: t.textSecondary, marginBottom: '10px', fontStyle: 'italic' }}>
            "What's the best gummy bear color?"
          </p>
          <VoteParticleViz segmentVotes={sv} aggregates={agg} options={OPTIONS} />
        </div>
      </div>

      {/* Input page preview */}
      <div style={{ borderTop: `1px solid ${t.border}`, padding: '48px 24px', background: t.bg }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: t.textMuted, marginBottom: '8px' }}>Logged-in input page preview:</p>
          <p style={{ fontSize: '20px', color: t.textPrimary, fontWeight: 300, marginBottom: '20px' }}>Ask a question, poll your swarm</p>
          <textarea placeholder="e.g. Which tagline resonates best?" rows={2} style={{ width: '100%', padding: '14px 18px', fontSize: '16px', lineHeight: 1.5, background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '10px', color: t.textPrimary, resize: 'none' }} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
            <button style={{ padding: '11px 28px', borderRadius: '8px', fontSize: '14px', background: t.accent, color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Add Poll</button>
            <button style={{ padding: '11px 20px', borderRadius: '8px', fontSize: '14px', background: t.btnSecondaryBg, color: t.textPrimary, border: `1px solid ${t.btnSecondaryBorder}`, cursor: 'pointer' }}>I'm Feeling Lucky</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LightThemeDemo() {
  const [active, setActive] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div>
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
        display: 'flex', gap: '3px', padding: '4px', borderRadius: '10px',
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
        border: '1px solid #ddd', flexWrap: 'wrap', maxWidth: '95vw', justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      }}>
        {THEMES.map((t, i) => (
          <button
            key={t.name}
            onClick={() => { setActive(i); setReplayKey((k) => k + 1); }}
            style={{
              padding: '5px 10px', fontSize: '10px', borderRadius: '5px', cursor: 'pointer',
              border: 'none', whiteSpace: 'nowrap',
              background: active === i ? `${t.accent}20` : 'transparent',
              color: active === i ? t.accent : '#666',
            }}
          >
            {t.name}
          </button>
        ))}
        <button onClick={() => setReplayKey((k) => k + 1)} style={{ padding: '5px 8px', fontSize: '10px', borderRadius: '5px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#666' }}>↻</button>
      </div>
      <Page t={THEMES[active]} replayKey={replayKey} />
    </div>
  );
}
