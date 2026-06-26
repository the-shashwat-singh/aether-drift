import { NextRequest, NextResponse } from 'next/server';
import { PlanetArc, ApiError } from '@/types';
import { bucketKeyPart, todayDateStr } from '@/lib/locationBucket';
import { cacheGet, cacheSetWithTimestamp } from '@/lib/redis';
import { fetchAllPlanetArcs } from '@/lib/horizons';
import { getFallbackPlanetArcs } from '@/lib/demoCities';

const PLANETS_TTL_SECONDS = 3600;
const WINDOW_BEFORE_MS = 72 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest): Promise<NextResponse<PlanetArc[] | ApiError>> {
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');

  if (!latParam || !lonParam) {
    return NextResponse.json({ error: 'Query params lat and lon are required.' }, { status: 400 });
  }

  const lat = parseFloat(latParam);
  const lon = parseFloat(lonParam);

  if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'lat must be in [-90,90] and lon in [-180,180].' }, { status: 400 });
  }

  const cacheKey = `planets:${bucketKeyPart(lat, lon)}:${todayDateStr()}`;

  try {
    const cached = await cacheGet<PlanetArc[]>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const now = Date.now();
    const window = { start: now - WINDOW_BEFORE_MS, end: now + WINDOW_AFTER_MS };
    const contactEmail = process.env.NASA_HORIZONS_EMAIL || 'noreply@aetherdrift.app';

    const { arcs, errors } = await fetchAllPlanetArcs(lat, lon, window, contactEmail);

    if (errors.length > 0) {
      console.warn('[/api/planets] partial Horizons failures:', errors);
    }

    if (arcs.length === 0) {
      // Horizons rate-limited or fully unreachable — serve a coarse fallback
      // so the UI still shows something rather than an empty sky.
      const fallback = getFallbackPlanetArcs(now);
      return NextResponse.json(fallback, { status: 200 });
    }

    await cacheSetWithTimestamp(cacheKey, arcs, PLANETS_TTL_SECONDS);
    return NextResponse.json(arcs, { status: 200 });
  } catch (err) {
    console.error('[/api/planets] unexpected error:', err);
    const fallback = getFallbackPlanetArcs(Date.now());
    return NextResponse.json(fallback, { status: 200 });
  }
}
