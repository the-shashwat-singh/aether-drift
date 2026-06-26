'use client';

import { useState, useEffect } from 'react';
import { SatelliteTrail } from '@/types';

interface SatelliteInfoCardProps {
  trail: SatelliteTrail | null;
  onClose: () => void;
  educationalMode: boolean;
}

interface FieldProps {
  label: string;
  value: string;
  tooltip?: string;
  educationalMode: boolean;
}

function Field({ label, value, tooltip, educationalMode }: FieldProps) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5" title={educationalMode ? tooltip : undefined}>
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-right text-sm font-mono text-text-primary">{value}</span>
    </div>
  );
}

export default function SatelliteInfoCard({ trail, onClose, educationalMode }: SatelliteInfoCardProps) {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    setIsPinned(false);
  }, [trail?.id]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && trail) onClose();
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [trail, onClose]);

  if (!trail) return null;

  const peak = trail.points.reduce((best, p) => (p.altitude > best.altitude ? p : best), trail.points[0]);

  return (
    <div
      className="fixed right-0 top-0 z-40 h-full w-full max-w-sm animate-slide-in-right border-l border-space-border bg-space-sidebar/95 backdrop-blur-md p-5 shadow-2xl overflow-y-auto"
      role="dialog"
      aria-label={`Details for ${trail.name}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{trail.name}</h2>
          <p className="text-xs font-mono text-text-secondary">NORAD {trail.noradId}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close satellite details"
          className="rounded-lg border border-space-border px-2 py-1 text-text-secondary hover:bg-space-btnHover hover:text-white transition-all"
        >
          ✕
        </button>
      </div>

      <span
        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-mono font-medium"
        style={{ backgroundColor: `${trail.color}33`, color: trail.color }}
      >
        {trail.orbitType}
      </span>

      <div className="mt-4 divide-y divide-space-border/50">
        <Field
          label="Operator / Country"
          value={trail.operator ?? 'Unknown'}
          tooltip="Best-effort lookup based on satellite name; many objects show as Unknown."
          educationalMode={educationalMode}
        />
        <Field
          label="Orbital altitude"
          value={trail.altitudeKm ? `${Math.round(trail.altitudeKm).toLocaleString()} km` : '—'}
          tooltip="Height above Earth's surface, derived from the satellite's mean motion."
          educationalMode={educationalMode}
        />
        <Field
          label="Orbital period"
          value={trail.periodMinutes ? `${trail.periodMinutes.toFixed(1)} min` : '—'}
          tooltip="Time to complete one full orbit of Earth."
          educationalMode={educationalMode}
        />
        <Field
          label="Max altitude (this view)"
          value={`${trail.maxAltitude.toFixed(1)}°`}
          tooltip="The highest point this object reached above your horizon during the selected window."
          educationalMode={educationalMode}
        />
        <Field
          label="Time of max altitude"
          value={peak ? new Date(peak.timestamp).toLocaleString() : '—'}
          educationalMode={educationalMode}
        />
        <Field
          label="Visibility"
          value={
            trail.visibilityScore === 'clear'
              ? 'Clear skies ☀️'
              : trail.visibilityScore === 'cloudy'
              ? 'Cloudy ☁️'
              : 'Unknown'
          }
          tooltip="Based on cloud cover forecast near the time of peak altitude."
          educationalMode={educationalMode}
        />
      </div>

      {trail.staleData && (
        <p className="mt-3 rounded-lg border border-orbit-geo/30 bg-orbit-geo/10 px-3 py-2 text-xs text-orbit-geo">
          This object&apos;s orbital data is more than 2 hours old — positions may have drifted slightly.
        </p>
      )}

      <button
        type="button"
        onClick={() => setIsPinned((p) => !p)}
        className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          isPinned
            ? 'bg-orbit-leo text-space-bg'
            : 'bg-space-btn text-white hover:bg-space-btnHover'
        }`}
      >
        {isPinned ? '📌 Pinned' : 'Pin this object'}
      </button>
    </div>
  );
}
