'use client';

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { SatelliteTrail, TimeWindow } from '@/types';

interface StarTrailCompassProps {
  trails: SatelliteTrail[];
  window: TimeWindow;
  onSelectTrail: (trail: SatelliteTrail) => void;
  educationalMode: boolean;
  showOnboardingGhost: boolean;
}

const CANVAS_SIZE = 320;
const ANIMATION_DURATION_MS = 1500;
const MIN_RENDER_ALTITUDE = 10; // per performance rules: only render 10°+ trails on the compass

interface HoverState {
  trail: SatelliteTrail;
  x: number;
  y: number;
}

/** Map (azimuth, altitude) to compass canvas coordinates. 0° az = top, clockwise. */
function projectToCanvas(
  azimuth: number,
  altitude: number,
  canvasRadius: number,
  center: number
): { x: number; y: number } {
  const angleRad = ((azimuth - 90) * Math.PI) / 180; // shift so 0°=top instead of math-standard 0°=right
  const radius = Math.max(0, (90 - altitude) / 90) * canvasRadius;
  return {
    x: center + radius * Math.cos(angleRad),
    y: center + radius * Math.sin(angleRad),
  };
}

function drawBaseGrid(ctx: CanvasRenderingContext2D, center: number, canvasRadius: number) {
  ctx.save();

  // Concentric altitude rings at 0/30/60/90 (zenith)
  const rings = [0, 30, 60, 90];
  ctx.strokeStyle = 'rgba(107, 158, 199, 0.25)';
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(107, 158, 199, 0.6)';

  for (const altitude of rings) {
    const r = Math.max(0, (90 - altitude) / 90) * canvasRadius;
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();

    if (altitude === 30 || altitude === 60) {
      ctx.fillText(`${altitude}°`, center + 4, center - r + 10);
    }
  }

  // Cardinal labels
  const labelOffset = canvasRadius + 14;
  ctx.font = '12px ui-sans-serif, sans-serif';
  ctx.fillStyle = '#E8F4FD';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cardinals: Array<[string, number]> = [
    ['N', 0],
    ['E', 90],
    ['S', 180],
    ['W', 270],
  ];

  for (const [label, az] of cardinals) {
    const pos = projectToCanvas(az, -90, labelOffset, center); // altitude -90 -> radius beyond rim
    ctx.fillText(label, pos.x, pos.y);
  }

  ctx.restore();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: SatelliteTrail,
  center: number,
  canvasRadius: number,
  progress: number,
  isHovered: boolean
) {
  const visiblePoints = trail.points.filter((p) => p.altitude >= MIN_RENDER_ALTITUDE);
  if (visiblePoints.length < 2) return;

  const pointCount = Math.max(2, Math.floor(visiblePoints.length * progress));
  const isIss = trail.orbitType === 'ISS';

  ctx.save();
  ctx.lineWidth = isHovered ? (isIss ? 4.5 : 2.5) : isIss ? 3 : 1.5;
  ctx.strokeStyle = trail.color;
  ctx.globalAlpha = trail.staleData ? 0.4 : isIss ? 1 : 0.6;

  if (isIss) {
    ctx.shadowColor = trail.color;
    ctx.shadowBlur = isHovered ? 14 : 8;
  }

  ctx.beginPath();
  for (let i = 0; i < pointCount; i += 1) {
    const p = visiblePoints[i];
    const { x, y } = projectToCanvas(p.azimuth, p.altitude, canvasRadius, center);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function StarTrailCompassInner({
  trails,
  window: timeWindow,
  onSelectTrail,
  educationalMode,
  showOnboardingGhost,
}: StarTrailCompassProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartRef = useRef<number>(0);
  const [hover, setHover] = useState<HoverState | null>(null);

  const renderableTrails = trails.filter((t) => t.maxAltitude >= MIN_RENDER_ALTITUDE);

  const draw = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const size = CANVAS_SIZE;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const center = size / 2;
      const canvasRadius = size / 2 - 24;

      drawBaseGrid(ctx, center, canvasRadius);

      for (const trail of renderableTrails) {
        drawTrail(ctx, trail, center, canvasRadius, progress, hover?.trail.id === trail.id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [renderableTrails, hover]
  );

  useEffect(() => {
    animationStartRef.current = performance.now();

    function tick(now: number) {
      const elapsed = now - animationStartRef.current;
      const progress = Math.min(1, elapsed / ANIMATION_DURATION_MS);
      draw(progress);
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderableTrails.map((t) => t.id).join(','), timeWindow.start, timeWindow.end]);

  // Redraw immediately (no re-animation) when only hover changes.
  useEffect(() => {
    draw(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const center = CANVAS_SIZE / 2;
      const canvasRadius = CANVAS_SIZE / 2 - 24;

      let closest: HoverState | null = null;
      let smallestDist = 14; // px hit-test radius

      for (const trail of renderableTrails) {
        for (const p of trail.points) {
          if (p.altitude < MIN_RENDER_ALTITUDE) continue;
          const { x, y } = projectToCanvas(p.azimuth, p.altitude, canvasRadius, center);
          const dist = Math.hypot(x - mouseX, y - mouseY);
          if (dist < smallestDist) {
            smallestDist = dist;
            closest = { trail, x: mouseX, y: mouseY };
          }
        }
      }

      setHover(closest);
    },
    [renderableTrails]
  );

  const handleClick = useCallback(() => {
    if (hover) onSelectTrail(hover.trail);
  }, [hover, onSelectTrail]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
        role="img"
        aria-label="Star Trail Compass showing satellite paths across the sky"
        className="cursor-pointer rounded-full"
      />

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-space-border bg-space-sidebar/95 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: hover.x + 12, top: hover.y - 12 }}
        >
          <p className="font-medium text-text-primary">{hover.trail.name}</p>
          <p className="font-mono text-text-secondary">{hover.trail.maxAltitude.toFixed(0)}° max</p>
        </div>
      )}

      {showOnboardingGhost && (
        <div className="pointer-events-none absolute inset-0 animate-fade-in">
          <span className="absolute -right-4 top-1/2 -translate-y-1/2 text-[11px] text-text-secondary whitespace-nowrap">
            Your Horizon →
          </span>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-text-secondary text-center w-20">
            ← Directly Overhead
          </span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] text-text-secondary whitespace-nowrap">
            These arcs = what flew over you
          </span>
        </div>
      )}

      {educationalMode && (
        <div className="pulse-ring-target edu-mode absolute inset-0 rounded-full" aria-hidden="true" />
      )}
    </div>
  );
}

export default memo(StarTrailCompassInner);
