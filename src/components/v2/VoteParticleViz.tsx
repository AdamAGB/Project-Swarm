import { useRef, useEffect, useMemo, useState } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';

const SEGMENT_COLORS = [
  '#0ea5e9', '#f97316', '#a855f7', '#14b8a6',
  '#e11d48', '#84cc16', '#6366f1', '#ec4899',
];

const TAU = Math.PI * 2;

interface Particle {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  segmentIndex: number;
  optionIndex: number;
  startFrame: number;
  duration: number;
  opacity: number;
  wobbleAmpX: number;
  wobbleAmpY: number;
  wobbleFreq: number;
  wobblePhase: number;
}

interface Props {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
  options: string[];
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function VoteParticleViz({ segmentVotes, aggregates, options }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [replayKey, setReplayKey] = useState(0);
  const [arrivedCounts, setArrivedCounts] = useState<number[]>([]);
  const [allDone, setAllDone] = useState(false);

  const initialParticles = useMemo(() => {
    const ps: Particle[] = [];
    segmentVotes.forEach((sv, segIdx) => {
      options.forEach((opt, optIdx) => {
        const count = sv.voteCounts[opt] ?? 0;
        for (let i = 0; i < count; i++) {
          ps.push({
            sx: 0, sy: 0, tx: 0, ty: 0,
            segmentIndex: segIdx,
            optionIndex: optIdx,
            startFrame: 0,
            duration: 0,
            opacity: 0.3 + Math.random() * 0.7,
            wobbleAmpX: (Math.random() - 0.5) * 120,
            wobbleAmpY: (Math.random() - 0.5) * 60,
            wobbleFreq: 2 + Math.random() * 4,
            wobblePhase: Math.random() * Math.PI * 2,
          });
        }
      });
    });
    return ps;
  }, [segmentVotes, options]);

  const totalPerOption = useMemo(() =>
    options.map((opt) =>
      segmentVotes.reduce((sum, sv) => sum + (sv.voteCounts[opt] ?? 0), 0)
    ), [segmentVotes, options]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setArrivedCounts([]);
    setAllDone(false);

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const N = options.length;
    const h = 420;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const colW = w / N;
    const gap = Math.max(2, colW * 0.08);
    const r = Math.max(1.5, Math.min(3.5, (colW - gap * 2) / (Math.sqrt(Math.max(initialParticles.length / N, 1)) * 2.8)));
    const floorY = h - 4;

    // How many dots fit per row in a column
    const dotsPerRow = Math.max(1, Math.floor((colW - gap * 2) / (r * 2.2)));

    // Helper: compute stack position for the Nth dot in a column
    function stackPos(col: number, slot: number): { x: number; y: number } {
      const colLeft = col * colW + gap;
      const row = Math.floor(slot / dotsPerRow);
      const posInRow = slot % dotsPerRow;
      return {
        x: colLeft + r + posInRow * r * 2.2,
        y: floorY - r - row * r * 2.2,
      };
    }

    const SPAWN_SPREAD = 60;

    const segDecisiveness = segmentVotes.map((sv) => {
      const pcts = options.map((opt) => sv.votePercentages[opt] ?? 0);
      return Math.max(...pcts) / 100;
    });

    // Shuffle particles
    const shuffled = [...initialParticles].sort(() => Math.random() - 0.5);

    // Assign timing first
    const timed = shuffled.map((p, i) => {
      const spawnFrame = Math.floor((i / shuffled.length) * SPAWN_SPREAD);
      const decisiveness = segDecisiveness[p.segmentIndex] ?? 0.5;
      const duration = Math.floor(60 + Math.random() * 160 - decisiveness * 40);
      const arrivalFrame = spawnFrame + duration;
      return { ...p, spawnFrame, duration, arrivalFrame };
    });

    // Sort by arrival time within each column to assign stack slots
    const slotCounters = new Array(N).fill(0);
    const byColumn: { idx: number; arrivalFrame: number; optionIndex: number }[] =
      timed.map((p, idx) => ({ idx, arrivalFrame: p.arrivalFrame, optionIndex: p.optionIndex }));
    byColumn.sort((a, b) => a.arrivalFrame - b.arrivalFrame);

    const slotAssignments = new Array(timed.length).fill(0);
    for (const { idx, optionIndex } of byColumn) {
      slotAssignments[idx] = slotCounters[optionIndex];
      slotCounters[optionIndex]++;
    }

    // Build final particle array with correct targets
    const ps = timed.map((p, i) => {
      const pos = stackPos(p.optionIndex, slotAssignments[i]);
      return {
        ...p,
        sx: Math.random() * w,
        sy: Math.random() * (h * 0.35) + 10,
        tx: pos.x,
        ty: pos.y,
        startFrame: p.spawnFrame,
        landed: false,
        finalX: pos.x,
        finalY: pos.y,
      };
    });

    // Track landing order per column
    const landedCounts = new Array(N).fill(0);
    const allDoneFrame = SPAWN_SPREAD + 220 + 20;
    const stopFrame = allDoneFrame + 10;
    let frameCount = 0;
    let lastReportedCounts = new Array(N).fill(-1);

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      frameCount++;

      const done = frameCount >= allDoneFrame;

      // Draw column dividers (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let i = 1; i < N; i++) {
        ctx.beginPath();
        ctx.moveTo(i * colW, 0);
        ctx.lineTo(i * colW, floorY);
        ctx.stroke();
      }

      // Check for newly landed particles and assign stack positions
      for (const p of ps) {
        const elapsed = frameCount - p.startFrame;
        if (!p.landed && elapsed >= p.duration) {
          p.landed = true;
          const col = p.optionIndex;
          const slot = landedCounts[col];
          landedCounts[col]++;
          const pos = stackPos(col, slot);
          p.finalX = pos.x;
          p.finalY = pos.y;
        }
      }

      // Count arrived
      const currentCounts = new Array(N).fill(0);
      for (const p of ps) {
        if (p.landed) currentCounts[p.optionIndex]++;
      }

      // Update React state for labels (throttled)
      const countsChanged = currentCounts.some((c, i) => c !== lastReportedCounts[i]);
      if (countsChanged || done) {
        lastReportedCounts = [...currentCounts];
        setArrivedCounts([...currentCounts]);
        if (done) setAllDone(true);
      }

      // Render particles — in-flight with wobble, landed at neat stack positions
      const OPACITY_BANDS = [0.3, 0.5, 0.7, 0.85, 1.0];
      const segCount = segmentVotes.length;

      for (let s = 0; s < segCount; s++) {
        const color = SEGMENT_COLORS[s % SEGMENT_COLORS.length];
        for (const bandMax of OPACITY_BANDS) {
          const bandMin = bandMax === OPACITY_BANDS[0] ? 0 : OPACITY_BANDS[OPACITY_BANDS.indexOf(bandMax) - 1];
          ctx.globalAlpha = bandMax;
          ctx.fillStyle = color;
          ctx.beginPath();

          for (const p of ps) {
            if (p.segmentIndex !== s) continue;
            if (p.opacity <= bandMin || p.opacity > bandMax) continue;

            const elapsed = frameCount - p.startFrame;

            if (elapsed <= 0) {
              // Not started — draw at spawn
              ctx.moveTo(p.sx + r, p.sy);
              ctx.arc(p.sx, p.sy, r, 0, TAU);
              continue;
            }

            if (p.landed) {
              // Landed — draw at neat stack position
              ctx.moveTo(p.finalX + r, p.finalY);
              ctx.arc(p.finalX, p.finalY, r, 0, TAU);
              continue;
            }

            // In flight — wobble toward column
            const t = easeOutCubic(elapsed / p.duration);
            const wobbleFade = (1 - t) * (1 - t);
            const wobble = Math.sin(t * p.wobbleFreq * TAU + p.wobblePhase) * wobbleFade;
            const x = p.sx + (p.tx - p.sx) * t + wobble * p.wobbleAmpX;
            const y = p.sy + (p.ty - p.sy) * t + wobble * p.wobbleAmpY;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (frameCount >= stopFrame) return;
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initialParticles, options, aggregates, segmentVotes, replayKey, totalPerOption]);

  return (
    <div className="v2-section">
      <div className="v2-section-header">
        <h2>Vote Results ({aggregates.totalVotes.toLocaleString()} simulated votes)</h2>
        <button
          className="v3-replay-btn"
          onClick={() => setReplayKey((k) => k + 1)}
          title="Replay animation"
        >
          &#x21bb;
        </button>
      </div>
      <div className="v2-particle-container" ref={containerRef}>
        <canvas ref={canvasRef} className="v2-particle-canvas" />
      </div>
      {/* Labels rendered as HTML so long text wraps properly */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: '4px',
        marginTop: '4px',
      }}>
        {options.map((opt, i) => {
          const isWinner = opt === aggregates.winner;
          const count = arrivedCounts[i] ?? 0;
          const displayCount = allDone ? totalPerOption[i] : count;
          const pct = aggregates.votePercentages[opt] ?? 0;

          return (
            <div key={opt} style={{ textAlign: 'center', padding: '2px 2px' }}>
              <div style={{
                fontSize: Math.max(14, Math.min(20, 200 / options.length)),
                fontWeight: 700,
                color: isWinner ? '#6366f1' : '#475569',
              }}>
                {displayCount.toLocaleString()}
              </div>
              {allDone && (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {pct.toFixed(1)}%
                </div>
              )}
              <div style={{
                fontSize: Math.max(10, Math.min(13, 140 / options.length)),
                fontWeight: isWinner ? 700 : 400,
                color: isWinner ? '#6366f1' : '#888',
                lineHeight: 1.2,
                marginTop: 2,
                wordBreak: 'break-word',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
              }}>
                {opt}
              </div>
              {isWinner && allDone && (
                <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', marginTop: 2 }}>
                  WINNER
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { SEGMENT_COLORS };
