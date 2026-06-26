import { RawTle } from './propagate';
import { cacheGet, cacheSetWithTimestamp, cacheGetWrittenAt } from './redis';

const CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
const TLE_CACHE_KEY = 'tle:active';
const TLE_TTL_SECONDS = 600; // 10 minutes

/**
 * A small set of well-known bright objects with hand-curated approximate
 * visual magnitudes. CelesTrak's TLE feed doesn't include magnitude, so we
 * seed known bright/interesting objects here; everything else is treated
 * as magnitude-unknown and deprioritized (but the ISS is always kept
 * regardless of brightness, per spec).
 */
const KNOWN_BRIGHT_NORAD_IDS: Record<number, number> = {
  25544: -1.5, // ISS (kept regardless, but bright anyway)
  20580: 2.0, // Hubble Space Telescope
  48274: 3.5, // CSS (Tiangong)
  // Common Starlink/communication satellites tend to flare brightly;
  // without a live magnitude feed we leave most as "unknown" and let the
  // ISS + any explicit entries above lead the brightness ranking.
};

/** Parse a 3-line-per-record TLE text blob into RawTle objects. */
export function parseTleText(raw: string): RawTle[] {
  const lines = raw.split('\n').map((l) => l.trimEnd());
  const tles: RawTle[] = [];

  for (let i = 0; i < lines.length - 2; i += 1) {
    const nameLine = lines[i].trim();
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1?.startsWith('1 ') || !line2?.startsWith('2 ')) continue;

    const noradId = parseInt(line1.slice(2, 7).trim(), 10);
    if (Number.isNaN(noradId)) continue;

    tles.push({
      name: nameLine || `SAT-${noradId}`,
      noradId,
      line1,
      line2,
      magnitude: KNOWN_BRIGHT_NORAD_IDS[noradId],
    });

    i += 2; // skip past the two data lines we just consumed
  }

  return tles;
}

export interface TleFetchResult {
  tles: RawTle[];
  stale: boolean;
  ageMinutes: number | null;
}

/**
 * Fetch active-satellite TLEs, preferring the Redis cache. Falls back to a
 * live CelesTrak fetch on cache miss, and falls back to a *stale* cache
 * entry (if any) if the live fetch fails entirely.
 */
export async function getActiveTles(): Promise<TleFetchResult> {
  const cached = await cacheGet<RawTle[]>(TLE_CACHE_KEY);
  const writtenAt = await cacheGetWrittenAt(TLE_CACHE_KEY);
  const ageMinutes = writtenAt ? (Date.now() - writtenAt) / 60000 : null;

  if (cached && ageMinutes !== null && ageMinutes < TLE_TTL_SECONDS / 60) {
    return { tles: cached, stale: false, ageMinutes };
  }

  try {
    const res = await fetch(CELESTRAK_URL, {
      headers: { 'User-Agent': 'AetherDrift/1.0' },
      // CelesTrak occasionally rate-limits; keep this a plain GET with no
      // special headers beyond UA to stay within their usage policy.
    });

    if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);

    const text = await res.text();
    const tles = parseTleText(text);

    if (tles.length === 0) throw new Error('CelesTrak returned no parsable TLEs');

    await cacheSetWithTimestamp(TLE_CACHE_KEY, tles, TLE_TTL_SECONDS);
    return { tles, stale: false, ageMinutes: 0 };
  } catch (err) {
    console.error('[celestrak] live fetch failed, falling back to stale cache:', err);

    if (cached) {
      return { tles: cached, stale: true, ageMinutes };
    }

    // No cache and no live data at all — surface an empty set; the route
    // layer decides how to message this to the client.
    return { tles: [], stale: true, ageMinutes: null };
  }
}
