import { useState } from 'react';
import '../../App.css';
import '../v2/V2App.css';
import '../v3/V3App.css';

/* ------------------------------------------------------------------ */
/*  Version 1: Minimal centered — just the input, nothing else         */
/* ------------------------------------------------------------------ */
function V1() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#e0e0e0' }}>Decision Wolf</span>
        <span style={{ fontSize: '11px', color: '#555' }}>Hosted mode — change</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <textarea
            placeholder="Ask your question and poll your swarm"
            rows={3}
            style={{
              width: '100%', padding: '16px 18px', fontSize: '16px', lineHeight: 1.5,
              background: '#111318', border: '1px solid #252530', borderRadius: '12px',
              color: '#e0e0e0', resize: 'none', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button className="btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px' }}>
              Begin Simulation
            </button>
            <button className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '10px', fontSize: '14px' }}>
              I'm Feeling Lucky
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 2: Google-style with title above input                     */
/* ------------------------------------------------------------------ */
function V2() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '11px', color: '#555' }}>Hosted mode — change</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', marginTop: '-80px' }}>
        <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
          <h1 style={{
            fontSize: '32px', fontWeight: 800, marginBottom: '28px', letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Decision Wolf
          </h1>
          <textarea
            placeholder="Ask your question and poll your swarm"
            rows={3}
            style={{
              width: '100%', padding: '16px 18px', fontSize: '16px', lineHeight: 1.5,
              background: '#111318', border: '1px solid #252530', borderRadius: '12px',
              color: '#e0e0e0', resize: 'none', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
            <button className="btn-primary" style={{ padding: '12px 28px', borderRadius: '10px', fontSize: '14px' }}>
              Begin Simulation
            </button>
            <button className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '10px', fontSize: '14px' }}>
              I'm Feeling Lucky
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 3: Card-style input on dark background                     */
/* ------------------------------------------------------------------ */
function V3() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#e0e0e0' }}>Decision Wolf</span>
        <span style={{ fontSize: '11px', color: '#555' }}>Hosted mode — change</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', marginTop: '-40px' }}>
        <div style={{
          width: '100%', maxWidth: 540, padding: '32px 28px',
          background: '#111318', borderRadius: '16px', border: '1px solid #1e1e2a',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <p style={{ fontSize: '13px', color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            New Poll
          </p>
          <textarea
            placeholder="Ask your question and poll your swarm"
            rows={3}
            style={{
              width: '100%', padding: '14px 16px', fontSize: '15px', lineHeight: 1.5,
              background: '#0a0a12', border: '1px solid #252530', borderRadius: '10px',
              color: '#e0e0e0', resize: 'none', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button className="btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px' }}>
              Begin Simulation
            </button>
            <button className="btn-secondary" style={{ padding: '12px 20px', borderRadius: '10px', fontSize: '14px' }}>
              I'm Feeling Lucky
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 4: Top bar with inline input (Slack/Linear feel)           */
/* ------------------------------------------------------------------ */
function V4() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <div style={{
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#e0e0e0' }}>Decision Wolf</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: '#555' }}>Hosted mode — change</span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', marginTop: '-60px' }}>
        <p style={{ fontSize: '20px', color: '#888', fontWeight: 300, marginBottom: '20px' }}>
          What do you want to ask?
        </p>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <textarea
            placeholder="Ask your question and poll your swarm"
            rows={2}
            style={{
              width: '100%', padding: '14px 18px', fontSize: '16px', lineHeight: 1.5,
              background: 'transparent', border: '1px solid #333', borderRadius: '10px',
              color: '#e0e0e0', resize: 'none', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
            <button className="btn-primary" style={{ padding: '11px 28px', borderRadius: '8px', fontSize: '14px' }}>
              Begin Simulation
            </button>
            <button className="btn-secondary" style={{ padding: '11px 20px', borderRadius: '8px', fontSize: '14px' }}>
              I'm Feeling Lucky
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version 5: Purple accent, bold title, input below                  */
/* ------------------------------------------------------------------ */
function V5() {
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #12101f 0%, #09090f 50%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '11px', color: '#555' }}>Hosted mode — change</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', marginTop: '-60px' }}>
        <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', color: '#fff', fontWeight: 800,
          }}>
            S
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#e0e0e0', marginBottom: '6px' }}>
            Decision Wolf
          </h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
            Poll your synthetic audience
          </p>
          <textarea
            placeholder="Ask your question and poll your swarm"
            rows={3}
            style={{
              width: '100%', padding: '16px 18px', fontSize: '15px', lineHeight: 1.5,
              background: 'rgba(255,255,255,0.03)', border: '1px solid #252530', borderRadius: '12px',
              color: '#e0e0e0', resize: 'none', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button className="btn-primary" style={{
              flex: 1, padding: '13px', borderRadius: '10px', fontSize: '14px',
              background: '#6366f1',
            }}>
              Begin Simulation
            </button>
            <button className="btn-secondary" style={{ padding: '13px 20px', borderRadius: '10px', fontSize: '14px' }}>
              I'm Feeling Lucky
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Switcher                                                           */
/* ------------------------------------------------------------------ */

const VERSIONS = [
  { name: '1. Minimal centered', key: '1' },
  { name: '2. Google-style title', key: '2' },
  { name: '3. Card on dark', key: '3' },
  { name: '4. Linear/Slack feel', key: '4' },
  { name: '5. Purple accent', key: '5' },
];

export function InputPageDemo() {
  const [active, setActive] = useState('1');

  return (
    <div>
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
        display: 'flex', gap: '4px', padding: '4px', borderRadius: '10px',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {VERSIONS.map((v) => (
          <button
            key={v.key}
            onClick={() => setActive(v.key)}
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
      </div>

      {active === '1' && <V1 />}
      {active === '2' && <V2 />}
      {active === '3' && <V3 />}
      {active === '4' && <V4 />}
      {active === '5' && <V5 />}
    </div>
  );
}
