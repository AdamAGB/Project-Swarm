/**
 * Viz 2: Bar Race
 * Horizontal bars race from left to right. Smooth, clean, satisfying.
 * Bars grow at different speeds based on vote velocity. Winner announced with flair.
 */
import { useRef, useEffect } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';

const BAR_COLORS = ['#6366f1', '#0ea5e9', '#f97316', '#14b8a6', '#e11d48', '#a855f7', '#84cc16', '#ec4899', '#eab308', '#64748b'];

interface Props {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
  options: string[];
}

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

export function Viz2BarRace({ aggregates, options }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.getBoundingClientRect().width;
    const N = options.length;
    const barH = Math.max(24, Math.min(48, (450 - 60) / N - 8));
    const h = N * (barH + 8) + 60;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const leftPad = Math.min(120, w * 0.22);
    const rightPad = 60;
    const maxBarW = w - leftPad - rightPad;
    const maxPct = Math.max(...options.map((o) => aggregates.votePercentages[o] ?? 0), 1);

    const DURATION = 120; // frames
    let frame = 0;

    // Sort options by percentage for visual ranking
    const sorted = [...options].sort((a, b) => (aggregates.votePercentages[b] ?? 0) - (aggregates.votePercentages[a] ?? 0));

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      frame++;

      const t = Math.min(1, frame / DURATION);
      const eased = easeOutQuart(t);

      for (let i = 0; i < sorted.length; i++) {
        const opt = sorted[i];
        const pct = aggregates.votePercentages[opt] ?? 0;
        const count = aggregates.voteCounts[opt] ?? 0;
        const isWinner = opt === aggregates.winner;
        const y = 20 + i * (barH + 8);

        // Bar
        const targetW = (pct / maxPct) * maxBarW;
        const currentW = targetW * eased;
        const color = BAR_COLORS[i % BAR_COLORS.length];

        // Bar shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.roundRect(leftPad + 2, y + 2, currentW, barH, 4);
        ctx.fill();

        // Bar fill
        ctx.fillStyle = color;
        ctx.globalAlpha = isWinner ? 1 : 0.75;
        ctx.beginPath();
        ctx.roundRect(leftPad, y, currentW, barH, 4);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Label (left of bar)
        const labelSize = Math.max(10, Math.min(14, barH * 0.4));
        ctx.font = `${isWinner ? 'bold' : ''} ${labelSize}px system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isWinner ? '#e0e0e0' : '#888';
        ctx.fillText(opt, leftPad - 8, y + barH / 2);

        // Count + percentage (right of bar or inside bar)
        const displayCount = Math.round(count * eased);
        const displayPct = (pct * eased).toFixed(1);
        const countText = `${displayCount} (${displayPct}%)`;
        ctx.font = `bold ${labelSize}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = isWinner ? '#fff' : '#aaa';

        if (currentW > ctx.measureText(countText).width + 16) {
          // Inside bar
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillText(countText, leftPad + currentW - ctx.measureText(countText).width - 8, y + barH / 2);
        } else {
          // Outside bar
          ctx.fillText(countText, leftPad + currentW + 6, y + barH / 2);
        }

        // Winner badge
        if (isWinner && t >= 1) {
          ctx.font = `bold ${labelSize - 2}px system-ui, sans-serif`;
          ctx.fillStyle = color;
          ctx.textAlign = 'left';
          ctx.fillText('\u2605 WINNER', leftPad + currentW + 6, y + barH / 2 + labelSize);
        }
      }

      // Total votes
      if (t >= 1) {
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#555';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${aggregates.totalVotes.toLocaleString()} total votes`, w - 8, h - 4);
      }

      if (frame <= DURATION + 10) rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [options, aggregates]);

  return (
    <div style={{ width: '100%' }}>
      <div ref={containerRef}><canvas ref={canvasRef} /></div>
    </div>
  );
}
