/**
 * Viz 3: Radial Burst
 * Dots cluster in the center, then burst outward to pie-slice zones.
 * Options arranged in a circle. Creates a flower/explosion effect.
 */
import { useRef, useEffect, useMemo } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';

const COLORS = ['#6366f1', '#0ea5e9', '#f97316', '#14b8a6', '#e11d48', '#a855f7', '#84cc16', '#ec4899', '#eab308', '#64748b'];
const TAU = Math.PI * 2;

interface Props {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
  options: string[];
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function Viz3RadialBurst({ segmentVotes, aggregates, options }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const particles = useMemo(() => {
    const ps: { optIdx: number; segIdx: number; angle: number; dist: number; delay: number }[] = [];
    let idx = 0;
    segmentVotes.forEach((sv, segIdx) => {
      options.forEach((opt, optIdx) => {
        const count = sv.voteCounts[opt] ?? 0;
        for (let i = 0; i < count; i++) {
          ps.push({ optIdx, segIdx, angle: 0, dist: 0, delay: idx * 0.1 });
          idx++;
        }
      });
    });
    // Shuffle
    for (let i = ps.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ps[i], ps[j]] = [ps[j], ps[i]];
    }
    ps.forEach((p, i) => { p.delay = i * 0.08; });
    return ps;
  }, [segmentVotes, options]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.getBoundingClientRect().width;
    const h = 500;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    const N = options.length;
    const maxR = Math.min(w, h) / 2 - 50;
    const r = Math.max(1.5, Math.min(3, 250 / Math.sqrt(particles.length)));

    // Assign each particle a target angle within its option's slice
    const sliceAngle = TAU / N;
    const ps = particles.map((p) => {
      const baseAngle = -Math.PI / 2 + p.optIdx * sliceAngle;
      const angle = baseAngle + (Math.random() * 0.7 + 0.15) * sliceAngle;
      const dist = maxR * (0.3 + Math.random() * 0.65);
      return { ...p, angle, dist };
    });

    const DURATION = 100;
    let frame = 0;

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      frame++;

      // Draw slice dividers
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        const angle = -Math.PI / 2 + i * sliceAngle;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
        ctx.stroke();
      }

      // Draw particles
      for (const p of ps) {
        const elapsed = frame - p.delay;
        if (elapsed <= 0) continue;

        const t = Math.min(1, elapsed / DURATION);
        const eased = easeOutCubic(t);

        // Start in center cluster, move to target
        const startDist = 5 + Math.random() * 3; // tiny cluster
        const currentDist = startDist + (p.dist - startDist) * eased;
        const x = cx + Math.cos(p.angle) * currentDist;
        const y = cy + Math.sin(p.angle) * currentDist;

        ctx.fillStyle = COLORS[p.optIdx % COLORS.length];
        ctx.globalAlpha = 0.4 + eased * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Option labels at the outer edge
      const allDone = frame > particles.length * 0.08 + DURATION;
      const labelR = maxR + 20;
      const fontSize = Math.max(10, Math.min(14, w / N * 0.2));

      for (let i = 0; i < N; i++) {
        const angle = -Math.PI / 2 + (i + 0.5) * sliceAngle;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        const isWinner = options[i] === aggregates.winner;

        ctx.font = `${isWinner ? 'bold' : ''} ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isWinner ? COLORS[i % COLORS.length] : '#888';
        ctx.fillText(options[i], lx, ly);

        if (allDone) {
          const pct = aggregates.votePercentages[options[i]] ?? 0;
          ctx.font = `bold ${fontSize + 2}px system-ui, sans-serif`;
          ctx.fillText(`${pct.toFixed(1)}%`, lx, ly + fontSize + 4);
        }
      }

      // Center count
      if (allDone) {
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#666';
        ctx.fillText(`${aggregates.totalVotes}`, cx, cy - 8);
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText('votes', cx, cy + 10);
      }

      if (!allDone || frame < DURATION + 30) rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [particles, options, aggregates]);

  return (
    <div style={{ width: '100%' }}>
      <div ref={containerRef}><canvas ref={canvasRef} /></div>
    </div>
  );
}
