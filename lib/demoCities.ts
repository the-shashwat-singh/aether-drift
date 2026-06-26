import { SatelliteTrail, PlanetArc } from '@/types';

export interface DemoCity {
  name: string;
  lat: number;
  lon: number;
}

export const DEMO_CITIES: DemoCity[] = [
  { name: 'New Delhi, India', lat: 28.6139, lon: 77.209 },
  { name: 'Mumbai, India', lat: 19.076, lon: 72.8777 },
  { name: 'New York, USA', lat: 40.7128, lon: -74.006 },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
  { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503 },
];

/**
 * Build a deterministic, physically-plausible-looking fallback ISS trail
 * for a demo city when live propagation or upstream APIs are unavailable.
 * This guarantees the Globe, Compass, and Drift Report always render
 * *something* coherent during a live demo even with no network.
 *
 * The arc is a simple parametric sweep from horizon to a peak altitude and
 * back down — not a real orbit, but visually and numerically sane as a
 * last-resort placeholder.
 */
function buildSyntheticIssTrail(city: DemoCity, windowStart: number): SatelliteTrail {
  const points = [];
  const durationMs = 8 * 60 * 1000; // a typical ~8 minute visible pass
  const steps = 40;
  const peakAltitude = 55 + (Math.abs(city.lat) % 10); // varies a bit per city, stays plausible
  const startAzimuth = 250; // WSW-ish rise, common for many real passes
  const endAzimuth = 110; // ESE-ish set

  for (let i = 0; i <= steps; i += 1) {
    const progress = i / steps; // 0 -> 1
    const altitude = Math.sin(progress * Math.PI) * peakAltitude;
    const azimuth = startAzimuth + (endAzimuth - startAzimuth) * progress;
    points.push({
      azimuth: ((azimuth % 360) + 360) % 360,
      altitude: Math.max(0, altitude),
      timestamp: windowStart + progress * durationMs,
    });
  }

  const maxAltitude = Math.max(...points.map((p) => p.altitude));

  return {
    id: 'sat-25544',
    name: 'ISS (ZARYA)',
    noradId: 25544,
    orbitType: 'ISS',
    points,
    maxAltitude,
    color: '#FF6B35',
    visibilityScore: 'unknown',
    altitudeKm: 418,
    periodMinutes: 92.68,
    operator: 'NASA / Roscosmos / ESA / JAXA / CSA',
    staleData: true,
  };
}

const FALLBACK_TRAIL_CACHE = new Map<string, SatelliteTrail[]>();

/**
 * Get (and memoize) a fallback trail set for a demo city. Used by
 * /api/trails when CelesTrak is unreachable and no cached real data exists
 * for that city's bucket.
 */
export function getFallbackTrailsForCity(city: DemoCity, windowStart: number): SatelliteTrail[] {
  const key = `${city.name}:${Math.floor(windowStart / 3600000)}`;
  const cached = FALLBACK_TRAIL_CACHE.get(key);
  if (cached) return cached;

  const trails = [buildSyntheticIssTrail(city, windowStart)];
  FALLBACK_TRAIL_CACHE.set(key, trails);
  return trails;
}

export function findNearestDemoCity(lat: number, lon: number): DemoCity {
  let nearest = DEMO_CITIES[0];
  let smallestDist = Infinity;

  for (const city of DEMO_CITIES) {
    const dist = Math.hypot(city.lat - lat, city.lon - lon);
    if (dist < smallestDist) {
      smallestDist = dist;
      nearest = city;
    }
  }

  return nearest;
}

/**
 * Synthetic fallback planet arc (Moon only) for when Horizons is
 * unreachable/rate-limited. Coarse but keeps the UI populated.
 */
export function getFallbackPlanetArcs(windowStart: number): PlanetArc[] {
  const points = [];
  const steps = 24;
  const totalMs = 96 * 60 * 60 * 1000; // -72h to +24h

  for (let i = 0; i <= steps; i += 1) {
    const progress = i / steps;
    const altitude = Math.sin(progress * Math.PI * 2) * 40 + 10;
    points.push({
      azimuth: (progress * 360) % 360,
      altitude: Math.max(0, altitude),
      timestamp: windowStart - 72 * 3600 * 1000 + progress * totalMs,
    });
  }

  return [{ name: 'Moon', points, color: '#E0E0E0' }];
}
