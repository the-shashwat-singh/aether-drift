import * as satellite from 'satellite.js';
import { SatelliteTrail, OrbitType, TimeWindow } from '@/types';
import {
  eciToAzAlt,
  toSkyPoint,
  classifyOrbit,
  deriveOrbitFromMeanMotion,
  ObserverPosition,
} from './coordinates';

export interface RawTle {
  name: string;
  noradId: number;
  line1: string;
  line2: string;
  /** Visual magnitude if known (lower = brighter). Undefined = unknown brightness. */
  magnitude?: number;
}

const ISS_NORAD_ID = 25544;

const ORBIT_COLORS: Record<OrbitType, string> = {
  ISS: '#FF6B35',
  LEO: '#4FC3F7',
  MEO: '#81C784',
  GEO: '#FFD54F',
};

/** Satellite is dropped from results if it never climbs above this altitude. */
const MIN_VISIBLE_ALTITUDE_DEG = 5;

/** Step size used for propagation across the requested window. */
const STEP_MINUTES = 1;

/**
 * Parse a raw TLE pair into a satellite.js SatRec, or return null if the
 * TLE lines are malformed (which does happen with live CelesTrak data).
 */
function parseSatRec(tle: RawTle): satellite.SatRec | null {
  try {
    const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    // satellite.js sets satrec.error on parse/propagation failure rather than throwing.
    if (satrec.error !== 0) return null;
    return satrec;
  } catch {
    return null;
  }
}

/**
 * Propagate a single TLE across [window.start, window.end] at STEP_MINUTES
 * resolution, converting each sample to topocentric az/alt for the given
 * observer. Returns null if the satellite never rises above
 * MIN_VISIBLE_ALTITUDE_DEG (per the performance/relevance rule), or if the
 * TLE fails to parse/propagate at all.
 */
export function propagateTle(
  tle: RawTle,
  window: TimeWindow,
  observer: ObserverPosition
): SatelliteTrail | null {
  const satrec = parseSatRec(tle);
  if (!satrec) return null;

  const stepMs = STEP_MINUTES * 60 * 1000;
  const points: ReturnType<typeof toSkyPoint>[] = [];
  let maxAltitude = -90;

  for (let t = window.start; t <= window.end; t += stepMs) {
    const date = new Date(t);
    const propagated = satellite.propagate(satrec, date);

    // propagate() returns `false` for position/velocity on decayed or
    // otherwise unpropagatable objects.
    if (!propagated.position || typeof propagated.position === 'boolean') continue;

    const { azimuth, altitude } = eciToAzAlt(propagated.position, date, observer);
    if (altitude > maxAltitude) maxAltitude = altitude;
    points.push(toSkyPoint(azimuth, altitude, t));
  }

  if (points.length === 0 || maxAltitude < MIN_VISIBLE_ALTITUDE_DEG) {
    return null;
  }

  const isIss = tle.noradId === ISS_NORAD_ID;
  const { altitudeKm, periodMinutes } = deriveOrbitFromMeanMotion(satrec.no);
  const orbitType: OrbitType = isIss ? 'ISS' : classifyOrbit(altitudeKm);

  return {
    id: `sat-${tle.noradId}`,
    name: tle.name,
    noradId: tle.noradId,
    orbitType,
    points,
    maxAltitude,
    color: ORBIT_COLORS[orbitType],
    visibilityScore: 'unknown',
    altitudeKm,
    periodMinutes,
  };
}

/**
 * Propagate a full set of TLEs, always including the ISS, and filtering to
 * the brightest MAX_SATELLITES by magnitude per the performance rules.
 * Satellites with unknown magnitude are treated as dimmer than any known
 * magnitude so brighter, known objects are prioritized when trimming.
 */
const MAX_SATELLITES = 200;
const MAGNITUDE_CUTOFF = 4.0;

export function selectInterestingTles(allTles: RawTle[]): RawTle[] {
  const iss = allTles.filter((t) => t.noradId === ISS_NORAD_ID);
  const others = allTles.filter((t) => t.noradId !== ISS_NORAD_ID);

  const brightEnough = others.filter(
    (t) => t.magnitude !== undefined && t.magnitude < MAGNITUDE_CUTOFF
  );

  const sorted = brightEnough.sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99));
  const trimmed = sorted.slice(0, MAX_SATELLITES);

  return [...iss, ...trimmed];
}

export function propagateAll(
  tles: RawTle[],
  window: TimeWindow,
  observer: ObserverPosition
): SatelliteTrail[] {
  const selected = selectInterestingTles(tles);
  const trails: SatelliteTrail[] = [];

  for (const tle of selected) {
    const trail = propagateTle(tle, window, observer);
    if (trail) trails.push(trail);
  }

  // Highest max-altitude first — most relevant passes lead the list.
  return trails.sort((a, b) => b.maxAltitude - a.maxAltitude);
}

export { ISS_NORAD_ID, ORBIT_COLORS, MIN_VISIBLE_ALTITUDE_DEG, MAX_SATELLITES };
