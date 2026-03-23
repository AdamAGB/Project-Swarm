import { useRef, useEffect } from 'react';
import type { SegmentFramework } from '../../types/v2';
import { SEGMENT_COLORS } from '../v2/VoteParticleViz';

const TAU = Math.PI * 2;
const DOOR_W = 28;
const DOOR_H = 40;

interface Props {
  options: string[];
  framework: SegmentFramework | null;
  statusLabel: string;
}

interface WanderDot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  segIdx: number;
  opacity: number;
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
) {
  const doorL = cx - DOOR_W / 2;
  const doorT = baseY - DOOR_H;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(doorL + 3, doorT + 3, DOOR_W, DOOR_H);

  // Door
  ctx.fillStyle = '#475569';
  ctx.fillRect(doorL, doorT, DOOR_W, DOOR_H);

  // Doorknob
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(cx + DOOR_W / 2 - 6, baseY - DOOR_H / 2, 2.5, 0, TAU);
  ctx.fill();
}

export function ProgressiveViz({ options, framework, statusLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dotsRef = useRef<WanderDot[]>([]);
  const optionsRef = useRef<string[]>(options);
  const houseFadeStartRef = useRef<number | null>(null);
  const dotsSpawnTimeRef = useRef<number | null>(null);
  const prevFrameworkRef = useRef<SegmentFramework | null>(null);

  // Keep options ref in sync
  optionsRef.current = options;

  // Track when options first appear for house fade-in
  useEffect(() => {
    if (options.length > 0 && houseFadeStartRef.current === null) {
      houseFadeStartRef.current = performance.now();
    }
  }, [options.length]);

  // Spawn wandering dots when framework arrives
  useEffect(() => {
    if (framework && framework !== prevFrameworkRef.current) {
      prevFrameworkRef.current = framework;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      const totalDots = 600;
      const dots: WanderDot[] = [];
      framework.segments.forEach((seg, segIdx) => {
        const count = Math.max(10, Math.round(seg.populationShare * totalDots));
        for (let i = 0; i < count; i++) {
          dots.push({
            x: Math.random() * w,
            y: Math.random() * (h * 0.5) + 10,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            segIdx,
            opacity: 0.3 + Math.random() * 0.7,
          });
        }
      });
      dotsRef.current = dots;
      dotsSpawnTimeRef.current = performance.now();
    }
  }, [framework]);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = 500;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const houseBaseY = h - 30;

    function animate() {
      if (!ctx) return;
      const now = performance.now();
      ctx.clearRect(0, 0, w, h);

      const opts = optionsRef.current;

      // Draw houses when options are available
      if (opts.length > 0) {
        const N = opts.length;
        const colW = w / N;
        const fadeStart = houseFadeStartRef.current;
        const elapsed = fadeStart ? (now - fadeStart) / 1000 : 0;
        const alpha = Math.min(1, elapsed / 0.6);

        ctx.save();
        ctx.globalAlpha = alpha;
        for (let i = 0; i < N; i++) {
          const cx = (i + 0.5) * colW;
          drawDoor(ctx, cx, houseBaseY);

          ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#334155';
          ctx.fillText(opts[i], cx, houseBaseY + 6);
        }
        ctx.restore();
      }

      // Update and draw wandering dots
      const dots = dotsRef.current;
      if (dots.length > 0) {
        const r = 2;
        const spawnTime = dotsSpawnTimeRef.current ?? now;
        const dotsAge = (now - spawnTime) / 1000;
        const dotsAlpha = Math.min(0.75, dotsAge / 1.0);

        for (const d of dots) {
          d.vx += (Math.random() - 0.5) * 0.2;
          d.vy += (Math.random() - 0.5) * 0.2;
          d.vx *= 0.99;
          d.vy *= 0.99;
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < r) { d.x = r; d.vx = Math.abs(d.vx); }
          if (d.x > w - r) { d.x = w - r; d.vx = -Math.abs(d.vx); }
          if (d.y < r) { d.y = r; d.vy = Math.abs(d.vy); }
          if (d.y > h * 0.55) { d.y = h * 0.55; d.vy = -Math.abs(d.vy); }
        }

        // Batch render by segment color + opacity band
        const OPACITY_BANDS = [0.3, 0.5, 0.7, 0.85, 1.0];
        const bySegment = new Map<number, WanderDot[]>();
        for (const d of dots) {
          let arr = bySegment.get(d.segIdx);
          if (!arr) { arr = []; bySegment.set(d.segIdx, arr); }
          arr.push(d);
        }

        ctx.save();
        for (const [segIdx, segDots] of bySegment) {
          const color = SEGMENT_COLORS[segIdx % SEGMENT_COLORS.length];
          for (const bandMax of OPACITY_BANDS) {
            const bandMin = bandMax === OPACITY_BANDS[0] ? 0 : OPACITY_BANDS[OPACITY_BANDS.indexOf(bandMax) - 1];
            ctx.globalAlpha = dotsAlpha * bandMax;
            ctx.fillStyle = color;
            ctx.beginPath();
            for (const d of segDots) {
              if (d.opacity <= bandMin || d.opacity > bandMax) continue;
              ctx.moveTo(d.x + r, d.y);
              ctx.arc(d.x, d.y, r, 0, TAU);
            }
            ctx.fill();
          }
        }
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="v3-progressive-viz">
      <div className="v2-particle-container" ref={containerRef}>
        <canvas ref={canvasRef} className="v2-particle-canvas" />
      </div>
      <div className="v3-progressive-status">
        <div className="v2-spinner" />
        <span>{statusLabel}</span>
      </div>
    </div>
  );
}
