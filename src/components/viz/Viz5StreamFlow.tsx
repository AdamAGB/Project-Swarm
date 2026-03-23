/**
 * Viz 5: Stream Flow
 * A river of dots flows from a single source on the left,
 * splitting into tributaries that flow to option pools on the right.
 * Thicker streams = more votes. Organic, flowing feel.
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

export function Viz5StreamFlow({ segmentVotes, aggregates, options }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const particles = useMemo(() => {
    const ps: { optIdx: number; segIdx: number; delay: number; speed: number }[] = [];
    let idx = 0;
    segmentVotes.forEach((sv, segIdx) => {
      options.forEach((opt, optIdx) => {
        const count = sv.voteCounts[opt] ?? 0;
        for (let i = 0; i < count; i++) {
          ps.push({ optIdx, segIdx, delay: 0, speed: 0.8 + Math.random() * 1.2 });
          idx++;
        }
      });
    });
    for (let i = ps.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ps[i], ps[j]] = [ps[j], ps[i]];
    }
    ps.forEach((p, i) => { p.delay = i * 0.2 + Math.random() * 10; });
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
    const h = 450;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const N = options.length;
    const sourceX = 30;
    const sourceY = h / 2;
    const forkX = w * 0.35;
    const poolX = w - 100;
    const r = Math.max(1.5, Math.min(3, 300 / Math.sqrt(particles.length)));

    // Target Y positions for each option (evenly spaced)
    const margin = 40;
    const spacing = (h - margin * 2) / (N - 1 || 1);
    const targetYs = options.map((_, i) => N === 1 ? h / 2 : margin + i * spacing);

    // Pool counts
    const poolCounts = new Array(N).fill(0);

    // Track each particle's position
    const ps = particles.map((p) => ({
      ...p,
      x: sourceX,
      y: sourceY,
      arrived: false,
      wobblePhase: Math.random() * TAU,
      wobbleAmp: 2 + Math.random() * 4,
    }));

    let frame = 0;

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      frame++;

      // Draw flow paths (faint curves from source through fork to each pool)
      for (let i = 0; i < N; i++) {
        const ty = targetYs[i];
        ctx.strokeStyle = COLORS[i % COLORS.length];
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY);
        ctx.bezierCurveTo(forkX * 0.5, sourceY, forkX * 0.8, sourceY, forkX, (sourceY + ty) / 2);
        ctx.bezierCurveTo(forkX * 1.2, ty, poolX * 0.7, ty, poolX, ty);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Draw pool circles
      for (let i = 0; i < N; i++) {
        const ty = targetYs[i];
        const isWinner = options[i] === aggregates.winner;
        const pct = aggregates.votePercentages[options[i]] ?? 0;
        const poolR = 8 + pct * 0.3;

        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.globalAlpha = isWinner ? 0.3 : 0.15;
        ctx.beginPath();
        ctx.arc(poolX, ty, poolR, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Update particles
      let allDone = true;
      for (const p of ps) {
        if (frame < p.delay) { allDone = false; continue; }
        if (p.arrived) continue;

        allDone = false;
        p.x += p.speed * 2.5;

        const ty = targetYs[p.optIdx];
        const progress = Math.min(1, (p.x - sourceX) / (poolX - sourceX));

        // Interpolate Y: start at sourceY, curve toward target
        const easedP = progress * progress; // ease in
        p.y = sourceY + (ty - sourceY) * easedP;

        // Add wobble
        const wobble = Math.sin(frame * 0.05 + p.wobblePhase) * p.wobbleAmp * (1 - progress);
        p.y += wobble;

        if (p.x >= poolX) {
          p.arrived = true;
          p.x = poolX;
          p.y = ty;
          poolCounts[p.optIdx]++;
        }
      }

      // Draw particles
      for (const p of ps) {
        if (frame < p.delay && !p.arrived) continue;
        if (p.arrived) continue; // Don't draw arrived particles, they're in the pool

        ctx.fillStyle = COLORS[p.optIdx % COLORS.length];
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Labels and counts
      const fontSize = Math.max(10, Math.min(14, h / N * 0.2));
      for (let i = 0; i < N; i++) {
        const ty = targetYs[i];
        const isWinner = options[i] === aggregates.winner;
        const color = COLORS[i % COLORS.length];

        // Option name
        ctx.font = `${isWinner ? 'bold' : ''} ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isWinner ? color : '#888';
        ctx.fillText(options[i], poolX + 20, ty - fontSize * 0.7);

        // Count
        ctx.font = `bold ${fontSize + 2}px system-ui, sans-serif`;
        ctx.fillStyle = isWinner ? '#fff' : '#aaa';
        ctx.fillText(poolCounts[i].toLocaleString(), poolX + 20, ty + fontSize * 0.5);

        if (isWinner && allDone) {
          const pct = aggregates.votePercentages[options[i]] ?? 0;
          ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText(`${pct.toFixed(1)}% \u2605`, poolX + 20, ty + fontSize * 1.5);
        }
      }

      // Source label
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#555';
      ctx.fillText(`${aggregates.totalVotes}`, sourceX, sourceY - 15);
      ctx.fillText('voters', sourceX, sourceY + 15);

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
