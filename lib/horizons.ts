import { PlanetArc, SkyPoint, TimeWindow } from '@/types';
import { toSkyPoint } from './coordinates';

const HORIZONS_BASE_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const STEP_MINUTES = 15;

export interface HorizonsTarget {
  id: string; // JPL body ID, e.g. '301' for the Moon
  name: string;
  color: string;
}

export const HORIZONS_TARGETS: HorizonsTarget[] = [
  { id: '301', name: 'Moon', color: '#E0E0E0' },
  { id: '299', name: 'Venus', color: '#E0E0E0' },
  { id: '499', name: 'Mars', color: '#E0E0E0' },
  { id: '599', name: 'Jupiter', color: '#E0E0E0' },
  { id: '699', name: 'Saturn', color: '#E0E0E0' },
];

function formatHorizonsDate(d: Date): string {
  // Horizons accepts 'YYYY-MM-DD HH:MM' in TDB/UTC for OBSERVER ephemeris.
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Build the query string for a single Horizons OBSERVER-mode ephemeris
 * request: azimuth/altitude as seen from a given lat/lon, stepped across
 * the requested window.
 */
function buildHorizonsUrl(
  target: HorizonsTarget,
  lat: number,
  lon: number,
  window: TimeWindow,
  contactEmail: string
): string {
  const startStr = formatHorizonsDate(new Date(window.start));
  const stopStr = formatHorizonsDate(new Date(window.end));

  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${target.id}'`,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'OBSERVER',
    CENTER: 'coord@399',
    COORD_TYPE: 'GEODETIC',
    SITE_COORD: `'${lon},${lat},0'`,
    START_TIME: `'${startStr}'`,
    STOP_TIME: `'${stopStr}'`,
    STEP_SIZE: `'${STEP_MINUTES}m'`,
    QUANTITIES: "'4'", // 4 = Azimuth & Elevation
    ANG_FORMAT: 'DEG',
    APPARENT: 'REFRACTED',
    EXTRA_PREC: 'YES',
    CSV_FORMAT: 'YES',
  });

  // contactEmail is appended as a comment-style param for polite API usage
  // tracking; Horizons itself doesn't require auth.
  return `${HORIZONS_BASE_URL}?${params.toString()}&_contact=${encodeURIComponent(contactEmail)}`;
}

/**
 * Parse the $$SOE / $$EOE delimited CSV ephemeris block that Horizons embeds
 * inside its JSON `result.result` text field.
 *
 * Each data row (with QUANTITIES=4, CSV_FORMAT=YES) looks like:
 *   2460500.123456, A.D. 2024-Jul-15 14:30, , , 123.4567, 45.6789,
 * where columns are: JD, calendar date, solar/lunar presence flags, Azimuth, Elevation.
 */
function parseHorizonsCsv(resultText: string, windowStart: number): SkyPoint[] {
  const soeIndex = resultText.indexOf('$$SOE');
  const eoeIndex = resultText.indexOf('$$EOE');
  if (soeIndex === -1 || eoeIndex === -1) return [];

  const block = resultText.slice(soeIndex + 5, eoeIndex).trim();
  if (!block) return [];

  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  const points: SkyPoint[] = [];

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim());
    // cols: [JD, calendar date, flag1, flag2, Azimuth, Elevation]
    if (cols.length < 6) continue;

    const calendarDate = cols[1];
    const azimuth = parseFloat(cols[cols.length - 2]);
    const altitude = parseFloat(cols[cols.length - 1]);
    if (Number.isNaN(azimuth) || Number.isNaN(altitude)) continue;

    const timestamp = parseHorizonsCalendarDate(calendarDate) ?? windowStart;
    points.push(toSkyPoint(azimuth, altitude, timestamp));
  }

  return points;
}

/** Parse a Horizons calendar date like "A.D. 2024-Jul-15 14:30:00.0000" to Unix ms. */
function parseHorizonsCalendarDate(raw: string): number | null {
  const cleaned = raw.replace('A.D.', '').trim();
  const match = cleaned.match(
    /(\d{4})-(\w{3})-(\d{2})\s+(\d{2}):(\d{2})/
  );
  if (!match) return null;

  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const [, year, monStr, day, hour, minute] = match;
  const month = months[monStr];
  if (month === undefined) return null;

  return Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute));
}

export interface HorizonsFetchResult {
  arc: PlanetArc | null;
  error?: string;
}

/**
 * Fetch and parse a single body's azimuth/altitude arc from Horizons.
 * Returns { arc: null, error } on any failure so callers can fall back
 * gracefully without throwing.
 */
export async function fetchPlanetArc(
  target: HorizonsTarget,
  lat: number,
  lon: number,
  window: TimeWindow,
  contactEmail: string
): Promise<HorizonsFetchResult> {
  const url = buildHorizonsUrl(target, lat, lon, window, contactEmail);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `AetherDrift/1.0 (${contactEmail})` },
    });

    if (!res.ok) {
      return { arc: null, error: `Horizons HTTP ${res.status} for ${target.name}` };
    }

    const json = await res.json();
    const resultText: string | undefined = json?.result;
    if (!resultText) {
      return { arc: null, error: `Horizons returned no result for ${target.name}` };
    }

    const points = parseHorizonsCsv(resultText, window.start);
    if (points.length === 0) {
      return { arc: null, error: `Horizons returned no parsable ephemeris for ${target.name}` };
    }

    return { arc: { name: target.name, points, color: target.color } };
  } catch (err) {
    return {
      arc: null,
      error: `Horizons fetch failed for ${target.name}: ${(err as Error).message}`,
    };
  }
}

/**
 * Fetch all configured planetary/lunar arcs in parallel. Individual
 * failures are swallowed (logged) so one bad body doesn't take down the
 * whole response — the route falls back to demo-city pre-computed data if
 * everything fails.
 */
export async function fetchAllPlanetArcs(
  lat: number,
  lon: number,
  window: TimeWindow,
  contactEmail: string
): Promise<{ arcs: PlanetArc[]; errors: string[] }> {
  const results = await Promise.all(
    HORIZONS_TARGETS.map((target) => fetchPlanetArc(target, lat, lon, window, contactEmail))
  );

  const arcs: PlanetArc[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.arc) arcs.push(result.arc);
    if (result.error) errors.push(result.error);
  }

  return { arcs, errors };
}
