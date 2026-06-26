import { NextRequest, NextResponse } from 'next/server';
import { CloudCoverEntry, ApiError } from '@/types';
import { cacheGet, cacheSetWithTimestamp } from '@/lib/redis';
import { fetchCloudCover } from '@/lib/openmeteo';

const WEATHER_TTL_SECONDS = 1800;

export async function GET(req: NextRequest): Promise<NextResponse<CloudCoverEntry[] | ApiError>> {
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

  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;

  try {
    const cached = await cacheGet<CloudCoverEntry[]>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const entries = await fetchCloudCover(lat, lon);
    await cacheSetWithTimestamp(cacheKey, entries, WEATHER_TTL_SECONDS);
    return NextResponse.json(entries, { status: 200 });
  } catch (err) {
    console.error('[/api/weather] unexpected error:', err);

    const stale = await cacheGet<CloudCoverEntry[]>(cacheKey);
    if (stale) {
      return NextResponse.json(stale, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Cloud cover data is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
