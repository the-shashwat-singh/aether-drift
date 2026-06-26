'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { SatelliteTrail, PlanetArc, TimeWindow, NextISSPass, FamousPass, DataFreshness } from '@/types';
import { useLocation } from '@/hooks/useLocation';
import { useTrails } from '@/hooks/useTrails';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { azimuthToCompassLabel } from '@/lib/coordinates';
import { nearestCloudCover, cloudCoverToVisibilityScore } from '@/lib/openmeteo';

import ErrorBoundary from '@/components/ErrorBoundary';
import StarTrailCompass from '@/components/StarTrailCompass';
import DriftReport from '@/components/DriftReport';
import TimeSlider from '@/components/TimeSlider';
import OrbitalShellToggle, { OrbitalShellVisibility } from '@/components/OrbitalShellToggle';
import LocationSearch from '@/components/LocationSearch';
import SatelliteInfoCard from '@/components/SatelliteInfoCard';
import OnboardingOverlay, { hasVisitedBefore } from '@/components/OnboardingOverlay';
import DataStatusBadge from '@/components/DataStatusBadge';
import ColorLegend from '@/components/ColorLegend';
import TonightHighlights from '@/components/TonightHighlights';
import FamousPassesPanel from '@/components/FamousPassesPanel';
import ShareButton from '@/components/ShareButton';
import Toast from '@/components/Toast';

import Globe from '@/components/Globe';

const DEFAULT_WINDOW_HOURS = { start: -6, end: 0 };

function defaultWindow(now: number): TimeWindow {
  return {
    start: now + DEFAULT_WINDOW_HOURS.start * 3600 * 1000,
    end: now + DEFAULT_WINDOW_HOURS.end * 3600 * 1000,
  };
}

function computeNextISSPass(trails: SatelliteTrail[]): NextISSPass | null {
  const iss = trails.find((t) => t.orbitType === 'ISS');
  if (!iss) return null;

  const now = Date.now();
  const futurePoints = iss.points.filter((p) => p.timestamp >= now && p.altitude > 0);
  if (futurePoints.length === 0) return null;

  const peak = futurePoints.reduce((best, p) => (p.altitude > best.altitude ? p : best), futurePoints[0]);

  return {
    time: peak.timestamp,
    maxAlt: peak.altitude,
    direction: azimuthToCompassLabel(peak.azimuth),
  };
}

function PageInner() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();

  const urlLat = searchParams.get('lat');
  const urlLon = searchParams.get('lon');
  const urlLoc = searchParams.get('loc');
  const urlT = searchParams.get('t');

  const { location, setLocation } = useLocation(
    urlLat && urlLon
      ? {
          lat: parseFloat(urlLat),
          lon: parseFloat(urlLon),
          label: urlLoc ? decodeURIComponent(urlLoc) : 'Shared location',
          source: 'url',
        }
      : undefined
  );

  const nowRef = useRef(Date.now());
  const [timeWindow, setWindowState] = useState<TimeWindow>(() => {
    if (urlT) {
      const startHours = parseFloat(urlT);
      if (!Number.isNaN(startHours)) {
        return { start: nowRef.current + startHours * 3600 * 1000, end: nowRef.current };
      }
    }
    return defaultWindow(nowRef.current);
  });

  const [planetArcs, setPlanetArcs] = useState<PlanetArc[]>([]);
  const [shellVisibility, setShellVisibility] = useState<OrbitalShellVisibility>({
    LEO: true,
    MEO: false,
    GEO: false,
  });
  const [selectedTrail, setSelectedTrail] = useState<SatelliteTrail | null>(null);
  const [educationalMode, setEducationalMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeFamousPassId, setActiveFamousPassId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sky' | 'highlights'>('sky');

  const { trails, isLoading: isLoadingTrails } = useTrails({ lat: location.lat, lon: location.lon, window: timeWindow });

  // Fetch planet arcs whenever location changes (window is fixed -72h/+24h server-side).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/planets?lat=${location.lat}&lon=${location.lon}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((data: PlanetArc[]) => {
        if (!cancelled) setPlanetArcs(data);
      })
      .catch((err) => {
        console.error('[page] failed to fetch planet arcs:', err);
        if (!cancelled) setPlanetArcs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lon]);

  // Apply cloud-cover visibility scores onto trails for display purposes.
  const [enrichedTrails, setEnrichedTrails] = useState<SatelliteTrail[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (trails.length === 0) {
      setEnrichedTrails([]);
      return;
    }

    fetch(`/api/weather?lat=${location.lat}&lon=${location.lon}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return res.json();
      })
      .then((cloudEntries) => {
        if (cancelled) return;
        const tagged = trails.map((t) => {
          const peak = t.points.reduce((best, p) => (p.altitude > best.altitude ? p : best), t.points[0]);
          const cloud = nearestCloudCover(cloudEntries, peak.timestamp);
          return { ...t, visibilityScore: cloudCoverToVisibilityScore(cloud) };
        });
        setEnrichedTrails(tagged);
      })
      .catch((err) => {
        console.error('[page] failed to fetch weather, using unknown visibility:', err);
        if (!cancelled) setEnrichedTrails(trails);
      });

    return () => {
      cancelled = true;
    };
  }, [trails, location.lat, location.lon]);

  const nextISSPass = useMemo(() => computeNextISSPass(enrichedTrails), [enrichedTrails]);

  const freshness: DataFreshness = useMemo(
    () => ({
      tleAgeMinutes: enrichedTrails.some((t) => t.staleData) ? 121 : 5,
      issLive: !enrichedTrails.find((t) => t.orbitType === 'ISS')?.staleData,
      horizonsOk: planetArcs.length > 0,
    }),
    [enrichedTrails, planetArcs]
  );

  // First-visit onboarding check (client-only, avoids hydration mismatch).
  useEffect(() => {
    if (!hasVisitedBefore()) setShowOnboarding(true);
  }, []);

  // Sync state to the URL for shareability.
  useEffect(() => {
    const offsetHours = (timeWindow.start - Date.now()) / 3600000;
    const params = new URLSearchParams({
      lat: location.lat.toFixed(4),
      lon: location.lon.toFixed(4),
      t: offsetHours.toFixed(1),
      loc: encodeURIComponent(location.label),
    });
    router.replace(`/?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.lat, location.lon, location.label, timeWindow.start]);

  const handleScrub = useCallback(
    (deltaMinutes: number) => {
      setWindowState((prev) => ({
        start: prev.start + deltaMinutes * 60 * 1000,
        end: prev.end + deltaMinutes * 60 * 1000,
      }));
    },
    []
  );

  const handleReset = useCallback(() => {
    setWindowState(defaultWindow(Date.now()));
    setLocation({ lat: 28.6139, lon: 77.209, label: 'New Delhi, India' });
    setActiveFamousPassId(null);
  }, [setLocation]);

  const [isPlaying, setIsPlaying] = useState(false);

  useKeyboardShortcuts({
    onPlayPause: () => setIsPlaying((p) => !p),
    onScrubLeft: () => handleScrub(-30),
    onScrubRight: () => handleScrub(30),
    onReset: handleReset,
    onToggleEducational: () => setEducationalMode((e) => !e),
    onToggleShells: () =>
      setShellVisibility((v) => {
        const allOn = v.LEO && v.MEO && v.GEO;
        return { LEO: !allOn, MEO: !allOn, GEO: !allOn };
      }),
    onEscape: () => {
      setSelectedTrail(null);
      setShowOnboarding(false);
    },
  });

  const handleSelectFamousPass = useCallback((pass: FamousPass) => {
    setLocation({ lat: pass.lat, lon: pass.lon, label: pass.title.split(' — ')[1] || pass.title });
    setWindowState({ start: pass.timestamp - 3 * 3600 * 1000, end: pass.timestamp + 3600 * 1000 });
    setActiveFamousPassId(pass.id);
    setActiveTab('sky');
  }, [setLocation]);

  const buildShareUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, []);

  if (!isMounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-space-bg">
        <p className="text-sm text-text-secondary">Loading Aether Drift…</p>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-space-bg">
      {/* Globe fills the background */}
      <div className="absolute inset-0">
        <ErrorBoundary label="Globe">
          <Globe
            trails={enrichedTrails}
            planetArcs={planetArcs}
            location={location}
            shellVisibility={shellVisibility}
            onSelectTrail={setSelectedTrail}
          />
        </ErrorBoundary>
        <ColorLegend />
      </div>

      {/* Sidebar */}
      <aside className="absolute left-0 top-0 z-10 h-full w-full max-w-sm overflow-y-auto border-r border-space-border bg-space-sidebar/80 backdrop-blur-md p-4 space-y-4">
        <header>
          <h1 className="text-lg font-semibold text-text-primary">Aether Drift</h1>
          <p className="text-xs text-text-secondary">The Stellar Wake</p>
        </header>

        <LocationSearch
          currentLabel={location.label}
          onSelect={(result) => setLocation({ lat: result.lat, lon: result.lon, label: result.label })}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('sky')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-all ${
              activeTab === 'sky' ? 'bg-space-btn text-white' : 'text-text-secondary hover:bg-space-btnHover/50'
            }`}
          >
            Sky
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('highlights')}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-all ${
              activeTab === 'highlights' ? 'bg-space-btn text-white' : 'text-text-secondary hover:bg-space-btnHover/50'
            }`}
          >
            Highlights
          </button>
        </div>

        {activeTab === 'highlights' ? (
          <FamousPassesPanel onSelect={handleSelectFamousPass} activePassId={activeFamousPassId} />
        ) : (
          <>
            <ErrorBoundary label="TonightHighlights">
              <TonightHighlights trails={enrichedTrails} cityLabel={location.label} />
            </ErrorBoundary>

            <div className="flex justify-center">
              <ErrorBoundary label="StarTrailCompass">
                <StarTrailCompass
                  trails={enrichedTrails}
                  window={timeWindow}
                  onSelectTrail={setSelectedTrail}
                  educationalMode={educationalMode}
                  showOnboardingGhost={false}
                />
              </ErrorBoundary>
            </div>

            <ErrorBoundary label="DriftReport">
              <DriftReport
                trails={enrichedTrails}
                location={location.label}
                window={timeWindow}
                nextISSPass={nextISSPass}
                isLoadingTrails={isLoadingTrails}
              />
            </ErrorBoundary>

            <ErrorBoundary label="TimeSlider">
              <TimeSlider window={timeWindow} onChange={setWindowState} />
            </ErrorBoundary>

            <ErrorBoundary label="OrbitalShellToggle">
              <OrbitalShellToggle visibility={shellVisibility} onChange={setShellVisibility} />
            </ErrorBoundary>

            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={educationalMode}
                  onChange={(e) => setEducationalMode(e.target.checked)}
                  className="h-4 w-4 accent-orbit-leo cursor-pointer"
                />
                Educational mode
              </label>
              <ShareButton buildUrl={buildShareUrl} onShared={() => setToastMessage('Link copied to clipboard')} />
            </div>
          </>
        )}
      </aside>

      <ErrorBoundary label="DataStatusBadge">
        <DataStatusBadge freshness={freshness} />
      </ErrorBoundary>

      {selectedTrail && (
        <ErrorBoundary label="SatelliteInfoCard">
          <SatelliteInfoCard
            trail={selectedTrail}
            onClose={() => setSelectedTrail(null)}
            educationalMode={educationalMode}
          />
        </ErrorBoundary>
      )}

      {showOnboarding && <OnboardingOverlay onDismiss={() => setShowOnboarding(false)} />}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-space-bg">
          <p className="text-sm text-text-secondary">Loading Aether Drift…</p>
        </div>
      }
    >
      <PageInner />
    </Suspense>
  );
}
