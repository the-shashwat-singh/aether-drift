'use client';

import { useEffect, useState } from 'react';
import { DataFreshness } from '@/types';

interface DataStatusBadgeProps {
  freshness: DataFreshness;
}

function tleStatusColor(ageMinutes: number | null): string {
  if (ageMinutes === null) return 'bg-red-500';
  if (ageMinutes < 15) return 'bg-green-400';
  if (ageMinutes < 30) return 'bg-yellow-400';
  return 'bg-red-500';
}

function formatAge(ageMinutes: number | null): string {
  if (ageMinutes === null) return 'unknown';
  if (ageMinutes < 1) return 'just now';
  return `${Math.round(ageMinutes)} min ago`;
}

export default function DataStatusBadge({ freshness }: DataStatusBadgeProps) {
  // Re-render every 30s so "N min ago" stays roughly accurate without a
  // dedicated ticking clock for this low-stakes display.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const dotColor = tleStatusColor(freshness.tleAgeMinutes);

  return (
    <div
      className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-lg border border-space-border bg-space-sidebar/80 backdrop-blur-md px-3 py-2 font-mono text-[11px] text-text-secondary shadow-lg"
      role="status"
      aria-live="polite"
    >
      <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
      <span>
        TLE: {formatAge(freshness.tleAgeMinutes)} · ISS: {freshness.issLive ? 'live' : 'stale'} · Horizons:{' '}
        {freshness.horizonsOk ? 'OK' : 'degraded'}
      </span>
    </div>
  );
}
