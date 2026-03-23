/**
 * Viz 1: Gravity Buckets
 * Dots rain from the sky and pile up in columns like balls in a physical simulation.
 * Columns grow upward as votes accumulate. Satisfying "filling up" feeling.
 */
import { useRef, useEffect, useMemo } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';

const COLORS = ['#0ea5e9', '#f97316', '#a855f7', '#14b8a6', '#e11d48', '#84cc16', '#6366f1', '#ec4899'];
const TAU = Math.PI * 2;

interface Props {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
  options: string[];
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '\u2026').width > max) t = t.slice(0, -1);
  return t + '\u2026';
}

export function Viz1GravityBuckets({ segmentVotes, aggregates, options }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const particles = useMemo(() => {
    const ps: { optIdx: number; segIdx: number; delay: number; landed: boolean; x: number; y: number; vy: number; targetY: number; r: number }[] = [];
    let idx = 0;
    segmentVotes.forEach((sv, segIdx) => {
      options.forEach((opt, optIdx) => {
        const count = sv.voteCounts[opt] ?? 0;
        for (let i = 0; i < count; i++) {
          ps.push({
            optIdx, segIdx,
            delay: idx * 0.3 + Math.random() * 30,
            landed: false,
            x: 0, y: -10, vy: 0, targetY: 0, r: 0,
          });
          idx++;
        }
      });
    });
    // Shuffle
    for (let i = ps.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ps[i], ps[j]] = [ps[j], ps[i]];
    }
    // Reassign delays after shuffle
    ps.forEach((p, i) => { p.delay = i * 0.15 + Math.random() * 15; });
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

    const N = options.length;
    const colW = w / N;
    const gap = Math.max(4, colW * 0.1);
    const r = Math.max(2, Math.min(4, (colW - gap * 2) / (Math.sqrt(particles.length / N) * 2.5)));
    const floorY = h - 50;

    // Track stack heights per column
    const stackCounts = new Array(N).fill(0);
    const dotsPerRow = Math.floor((colW - gap * 2) / (r * 2.2));

    // Init particles
    const ps = particles.map((p) => {
      const colCenter = (p.optIdx + 0.5) * colW;
      return {
        ...p,
        x: colCenter + (Math.random() - 0.5) * (colW - gap * 2 - r * 2),
        y: -r - Math.random() * 50,
        vy: 1 + Math.random() * 2,
        r,
      };
    });

    let frame = 0;

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      frame++;

      let allDone = true;

      // Draw column dividers
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      for (let i = 1; i < N; i++) {
        ctx.beginPath();
        ctx.moveTo(i * colW, 0);
        ctx.lineTo(i * colW, floorY);
        ctx.stroke();
      }

      // Floor
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, floorY, w, 2);

      // Update and draw particles
      for (const p of ps) {
        if (frame < p.delay) { allDone = false; continue; }

        if (!p.landed) {
          p.vy += 0.15; // gravity
          p.y += p.vy;

          // Calculate stack position
          const col = p.optIdx;
          const row = Math.floor(stackCounts[col] / dotsPerRow);
          const posInRow = stackCounts[col] % dotsPerRow;
          const stackY = floorY - r - row * r * 2.2;
          const colLeft = col * colW + gap;
          const stackX = colLeft + r + posInRow * r * 2.2;

          if (p.y >= stackY) {
            p.y = stackY;
            p.x = stackX;
            p.landed = true;
            p.vy = 0;
            stackCounts[col]++;
          } else {
            allDone = false;
          }
        }

        const color = COLORS[p.segIdx % COLORS.length];
        ctx.fillStyle = color;
        ctx.globalAlpha = p.landed ? 0.8 : 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Labels + counts
      const fontSize = Math.max(10, Math.min(14, colW * 0.18));
      for (let i = 0; i < N; i++) {
        const cx = (i + 0.5) * colW;
        const isWinner = options[i] === aggregates.winner;

        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isWinner ? '#6366f1' : '#475569';
        ctx.fillText(truncate(ctx, options[i], colW - 8), cx, floorY + 8);

        const count = stackCounts[i];
        ctx.font = `bold ${fontSize + 4}px system-ui, sans-serif`;
        ctx.textBaseline = 'bottom';
        const stackTop = floorY - Math.ceil(count / dotsPerRow) * r * 2.2 - r;
        ctx.fillText(count.toLocaleString(), cx, Math.min(stackTop - 4, floorY - 20));

        if (isWinner && allDone) {
          ctx.font = `bold ${fontSize - 2}px system-ui, sans-serif`;
          ctx.fillStyle = '#6366f1';
          ctx.fillText('WINNER', cx, floorY + 8 + fontSize + 4);
        }
      }

      if (!allDone) rafRef.current = requestAnimationFrame(animate);
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
