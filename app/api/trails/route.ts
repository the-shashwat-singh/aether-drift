import { NextRequest, NextResponse } from 'next/server';
import { SatelliteTrail, TimeWindow, ApiError } from '@/types';
import { bucketKeyPart, bucketWindowStart6h } from '@/lib/locationBucket';
import { cacheGet, cacheSetWithTimestamp, cacheGetWrittenAt } from '@/lib/redis';
import { getActiveTles } from '@/lib/celestrak';
import { propagateAll } from '@/lib/propagate';
import { lookupOperator } from '@/lib/operatorLookup';
import { findNearestDemoCity, getFallbackTrailsForCity } from '@/lib/demoCities';

const TRAILS_TTL_SECONDS = 3600;
const STALE_TLE_THRESHOLD_MINUTES = 120;

interface TrailsRequestBody {
  lat: number;
  lon: number;
  windowStart: number;
  windowEnd: number;
}

function isValidBody(body: unknown): body is TrailsRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.lat === 'number' &&
    typeof b.lon === 'number' &&
    typeof b.windowStart === 'number' &&
    typeof b.windowEnd === 'number' &&
    b.lat >= -90 &&
    b.lat <= 90 &&
    b.lon >= -180 &&
    b.lon <= 180 &&
    b.windowEnd > b.windowStart
  );
}

export async function POST(req: NextRequest): Promise<NextResponse<SatelliteTrail[] | ApiError>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Request must include numeric lat (-90..90), lon (-180..180), windowStart, and windowEnd (> windowStart).' },
      { status: 400 }
    );
  }

  const { lat, lon, windowStart, windowEnd } = body;
  const window: TimeWindow = { start: windowStart, end: windowEnd };

  const cacheKey = `trails:${bucketKeyPart(lat, lon)}:${bucketWindowStart6h(windowStart)}`;

  try {
    const cached = await cacheGet<SatelliteTrail[]>(cacheKey);
    if (cached) {
      const writtenAt = await cacheGetWrittenAt(cacheKey);
      const tagged = tagStaleness(cached, writtenAt);
      return NextResponse.json(tagged, { status: 200 });
    }

    const { tles, stale: tleStale, ageMinutes } = await getActiveTles();

    if (tles.length === 0) {
      // Total upstream failure with nothing cached at all — fall back to a
      // synthetic trail for demoing if this is near one of our pre-warmed
      // demo cities; otherwise return an honest empty result with a stale flag.
      const nearestCity = findNearestDemoCity(lat, lon);
      const fallback = getFallbackTrailsForCity(nearestCity, windowStart);
      return NextResponse.json(fallback, { status: 200 });
    }

    const observer = { lat, lon };
    let trails = propagateAll(tles, window, observer);

    const isStaleTle = tleStale || (ageMinutes !== null && ageMinutes > STALE_TLE_THRESHOLD_MINUTES);
    trails = trails.map((t) => ({
      ...t,
      operator: lookupOperator(t.name),
      staleData: isStaleTle,
    }));

    await cacheSetWithTimestamp(cacheKey, trails, TRAILS_TTL_SECONDS);

    return NextResponse.json(trails, { status: 200 });
  } catch (err) {
    console.error('[/api/trails] unexpected error:', err);
    return NextResponse.json(
      { error: 'Unable to compute satellite trails right now. Please try again shortly.' },
      { status: 500 }
    );
  }
}

function tagStaleness(trails: SatelliteTrail[], writtenAt: number | null): SatelliteTrail[] {
  if (writtenAt === null) return trails;
  const ageMinutes = (Date.now() - writtenAt) / 60000;
  if (ageMinutes <= STALE_TLE_THRESHOLD_MINUTES) return trails;
  return trails.map((t) => ({ ...t, staleData: true }));
}
