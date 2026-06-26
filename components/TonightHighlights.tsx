'use client';

import { useMemo } from 'react';
import { SatelliteTrail } from '@/types';

interface TonightHighlightsProps {
  trails: SatelliteTrail[];
  cityLabel: string;
}

function classifyPass(maxAlt: number): string {
  if (maxAlt > 60) return 'nearly overhead';
  if (maxAlt >= 30) return 'good pass';
  return 'low pass';
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Tonight = approx 6 PM to 6 AM local time, computed from the browser's local clock. */
function isWithinTonight(ts: number): boolean {
  const hour = new Date(ts).getHours();
  return hour >= 18 || hour < 6;
}

export default function TonightHighlights({ trails, cityLabel }: TonightHighlightsProps) {
  const { count, best } = useMemo(() => {
    const tonightTrails = trails.filter((t) => t.points.some((p) => isWithinTonight(p.timestamp)));
    const sorted = [...tonightTrails].sort((a, b) => b.maxAltitude - a.maxAltitude);
    return { count: tonightTrails.length, best: sorted[0] ?? null };
  }, [trails]);

  if (count === 0) {
    return (
      <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-3">
        <p className="text-sm text-text-primary">
          No passes expected tonight over <span className="font-medium">{cityLabel}</span>. Check back later.
        </p>
      </div>
    );
  }

  const bestPeak = best
    ? best.points.reduce((acc, p) => (p.altitude > acc.altitude ? p : acc), best.points[0])
    : null;

  return (
    <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-3">
      <p className="text-sm text-text-primary">
        Tonight over <span className="font-medium">{cityLabel}</span>: {count} pass{count === 1 ? '' : 'es'}.{' '}
        {best && bestPeak && (
          <>
            Best: <span className="font-medium">{best.name}</span> at {formatTime(bestPeak.timestamp)},{' '}
            {best.maxAltitude.toFixed(0)}° — {classifyPass(best.maxAltitude)}.
          </>
        )}
      </p>
    </div>
  );
}
