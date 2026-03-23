/**
 * Viz 4: Wave Form
 * Each option is a wave/mountain that rises from a flat line.
 * Amplitude = vote percentage. Creates an audio equalizer / mountain range feel.
 * Particles flow along the waves.
 */
import { useRef, useEffect } from 'react';
import type { V2SegmentVoteResult, V2VoteAggregates } from '../../types/v2';

const COLORS = ['#6366f1', '#0ea5e9', '#f97316', '#14b8a6', '#e11d48', '#a855f7', '#84cc16', '#ec4899', '#eab308', '#64748b'];

interface Props {
  segmentVotes: V2SegmentVoteResult[];
  aggregates: V2VoteAggregates;
  options: string[];
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function Viz4WaveForm({ aggregates, options }: Props) {
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
    const h = 420;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const N = options.length;
    const baseY = h - 60;
    const maxHeight = baseY - 40;
    const colW = w / N;
    const maxPct = Math.max(...options.map((o) => aggregates.votePercentages[o] ?? 0), 1);

    const DURATION = 90;
    let frame = 0;

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      frame++;

      const t = Math.min(1, frame / DURATION);
      const eased = easeOutCubic(t);

      // Base line
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      ctx.lineTo(w, baseY);
      ctx.stroke();

      // Draw mountains/waves
      for (let i = 0; i < N; i++) {
        const pct = aggregates.votePercentages[options[i]] ?? 0;
        const targetH = (pct / maxPct) * maxHeight;
        const currentH = targetH * eased;
        const cx = (i + 0.5) * colW;
        const color = COLORS[i % COLORS.length];
        const isWinner = options[i] === aggregates.winner;

        // Mountain shape using bezier curves
        const halfW = colW * 0.42;
        const gradient = ctx.createLinearGradient(cx, baseY - currentH, cx, baseY);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.globalAlpha = isWinner ? 0.9 : 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, baseY);
        ctx.bezierCurveTo(
          cx - halfW * 0.5, baseY,
          cx - halfW * 0.3, baseY - currentH,
          cx, baseY - currentH,
        );
        ctx.bezierCurveTo(
          cx + halfW * 0.3, baseY - currentH,
          cx + halfW * 0.5, baseY,
          cx + halfW, baseY,
        );
        ctx.closePath();
        ctx.fill();

        // Glow at peak
        if (currentH > 20) {
          ctx.fillStyle = color;
          ctx.globalAlpha = (isWinner ? 0.8 : 0.4) * eased;
          ctx.beginPath();
          ctx.arc(cx, baseY - currentH, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Count at peak
        const fontSize = Math.max(10, Math.min(16, colW * 0.2));
        if (currentH > fontSize + 10) {
          const displayPct = (pct * eased).toFixed(1);
          ctx.font = `bold ${fontSize + 2}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = isWinner ? '#fff' : '#ccc';
          ctx.fillText(`${displayPct}%`, cx, baseY - currentH - 8);

          ctx.font = `${fontSize - 2}px system-ui, sans-serif`;
          ctx.fillStyle = '#888';
          ctx.fillText(`${Math.round((aggregates.voteCounts[options[i]] ?? 0) * eased)}`, cx, baseY - currentH - 8 - fontSize);
        }

        // Label below base
        ctx.font = `${isWinner ? 'bold' : ''} ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isWinner ? color : '#666';

        let label = options[i];
        if (ctx.measureText(label).width > colW - 4) {
          while (label.length > 1 && ctx.measureText(label + '\u2026').width > colW - 4) label = label.slice(0, -1);
          label += '\u2026';
        }
        ctx.fillText(label, cx, baseY + 10);

        if (isWinner && t >= 1) {
          ctx.font = `bold ${fontSize - 2}px system-ui, sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText('WINNER', cx, baseY + 10 + fontSize + 2);
        }
      }

      if (frame <= DURATION + 20) rafRef.current = requestAnimationFrame(animate);
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
