'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { SatelliteTrail, TimeWindow, NextISSPass } from '@/types';
import { azimuthToCompassLabel } from '@/lib/coordinates';
import PassAlarmButton from './PassAlarmButton';

interface DriftReportProps {
  trails: SatelliteTrail[];
  location: string;
  window: TimeWindow;
  nextISSPass: NextISSPass | null;
  isLoadingTrails: boolean;
}

function visibilityEmoji(score?: 'clear' | 'cloudy' | 'unknown'): string {
  if (score === 'clear') return '☀️';
  if (score === 'cloudy') return '☁️';
  return '❔';
}

function formatTimeOfDay(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function useCountdown(targetMs: number | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (targetMs === null) {
      setLabel(null);
      return;
    }

    function tick() {
      const diff = targetMs! - Date.now();
      if (diff <= 0) {
        setLabel('now');
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      setLabel(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return label;
}

function DriftReportSkeleton() {
  return (
    <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-4 space-y-3" aria-busy="true">
      <div className="h-4 w-1/2 animate-pulse rounded bg-space-border" />
      <div className="h-3 w-full animate-pulse rounded bg-space-border" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-space-border" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-space-border" />
      <div className="space-y-2 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-3 w-full animate-pulse rounded bg-space-border" />
        ))}
      </div>
    </div>
  );
}

function DriftReportInner({ trails, location, window: timeWindow, nextISSPass, isLoadingTrails }: DriftReportProps) {
  const [narrativeText, setNarrativeText] = useState<string>('');
  const [isFallback, setIsFallback] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countdown = useCountdown(nextISSPass?.time ?? null);

  const fetchReport = useCallback(async () => {
    if (trails.length === 0 && !nextISSPass) {
      setNarrativeText('No notable passes were detected in this window. Try widening the time range.');
      return;
    }

    setIsLoadingReport(true);
    setError(null);

    try {
      const res = await fetch('/api/drift-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trails, location, window: timeWindow, nextISSPass }),
      });

      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

      const data: { narrativeText: string; isFallback?: boolean } = await res.json();
      setNarrativeText(data.narrativeText);
      setIsFallback(Boolean(data.isFallback));
    } catch (err) {
      console.error('[DriftReport] failed to fetch narration:', err);
      setError('Data temporarily unavailable.');
    } finally {
      setIsLoadingReport(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trails, location, timeWindow.start, timeWindow.end, nextISSPass]);

  useEffect(() => {
    if (isLoadingTrails) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingTrails, location, timeWindow.start, timeWindow.end]);

  if (isLoadingTrails || (isLoadingReport && !narrativeText)) {
    return <DriftReportSkeleton />;
  }

  const topPasses = [...trails].sort((a, b) => b.maxAltitude - a.maxAltitude).slice(0, 5);
  const windowLabel = `${new Date(timeWindow.start).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  })} – ${new Date(timeWindow.end).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{location}</h2>
          <p className="text-[11px] text-text-secondary">{windowLabel}</p>
        </div>
        <button
          type="button"
          onClick={fetchReport}
          aria-label="Refresh Drift Report"
          className="rounded-lg border border-space-border p-1.5 text-text-secondary hover:bg-space-btnHover hover:text-white transition-all"
          disabled={isLoadingReport}
        >
          <span className={isLoadingReport ? 'inline-block animate-spin' : 'inline-block'}>⟳</span>
        </button>
      </div>

      {error ? (
        <p className="text-sm text-text-secondary italic">Data temporarily unavailable.</p>
      ) : (
        <p className="text-[15px] italic leading-relaxed text-text-primary">
          {narrativeText}
          {isFallback && (
            <span className="ml-1 text-[10px] not-italic text-text-secondary">(auto-summary)</span>
          )}
        </p>
      )}

      {topPasses.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-space-border pt-3">
          {topPasses.map((trail) => {
            const peak = trail.points.reduce(
              (best, p) => (p.altitude > best.altitude ? p : best),
              trail.points[0]
            );
            return (
              <li key={trail.id} className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 truncate text-text-primary">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: trail.color }}
                    aria-hidden="true"
                  />
                  {trail.name}
                </span>
                <span className="flex items-center gap-2 text-text-secondary shrink-0">
                  <span>{trail.maxAltitude.toFixed(0)}°</span>
                  <span>{peak ? formatTimeOfDay(peak.timestamp) : '—'}</span>
                  <span aria-hidden="true">{visibilityEmoji(trail.visibilityScore)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {nextISSPass && (
        <div className="mt-3 rounded-lg border border-orbit-iss/30 bg-orbit-iss/10 px-3 py-2">
          <p className="text-xs text-text-secondary">Next ISS pass in</p>
          <p className="font-mono text-lg text-orbit-iss">{countdown ?? '—'}</p>
          <p className="text-[11px] text-text-secondary">
            Peak {nextISSPass.maxAlt.toFixed(0)}° toward {nextISSPass.direction || azimuthToCompassLabel(0)}
          </p>
        </div>
      )}

      <div className="mt-3">
        <PassAlarmButton nextISSPass={nextISSPass} locationLabel={location} />
      </div>
    </div>
  );
}

export default memo(DriftReportInner);
