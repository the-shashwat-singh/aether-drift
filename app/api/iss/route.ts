import { NextRequest, NextResponse } from 'next/server';
import { ISSLiveData, ApiError, ISSPassPrediction } from '@/types';
import { cacheGet, cacheSetWithTimestamp } from '@/lib/redis';

const ISS_POSITION_URL = 'http://api.open-notify.org/iss-now.json';
const ISS_PASS_URL = 'http://api.open-notify.org/iss-pass.json';

const POSITION_TTL_SECONDS = 5;
const PASSES_TTL_SECONDS = 300;

interface OpenNotifyPositionResponse {
  message: string;
  iss_position: { latitude: string; longitude: string };
  timestamp: number;
}

interface OpenNotifyPassResponse {
  message: string;
  response: Array<{ risetime: number; duration: number }>;
}

async function fetchIssPosition(): Promise<{ lat: number; lon: number; alt: number }> {
  const cacheKey = 'iss:position';
  const cached = await cacheGet<{ lat: number; lon: number; alt: number }>(cacheKey);
  if (cached) return cached;

  const res = await fetch(ISS_POSITION_URL);
  if (!res.ok) throw new Error(`OpenNotify position HTTP ${res.status}`);

  const json: OpenNotifyPositionResponse = await res.json();
  if (json.message !== 'success') throw new Error('OpenNotify position returned non-success message');

  const position = {
    lat: parseFloat(json.iss_position.latitude),
    lon: parseFloat(json.iss_position.longitude),
    alt: 408, // OpenNotify doesn't return altitude; 408km is the ISS's typical orbital altitude
  };

  await cacheSetWithTimestamp(cacheKey, position, POSITION_TTL_SECONDS);
  return position;
}

async function fetchIssPasses(lat: number, lon: number): Promise<ISSPassPrediction[]> {
  const cacheKey = `iss:passes:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = await cacheGet<ISSPassPrediction[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), n: '10' });
  const res = await fetch(`${ISS_PASS_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`OpenNotify pass HTTP ${res.status}`);

  const json: OpenNotifyPassResponse = await res.json();
  if (json.message !== 'success') throw new Error('OpenNotify pass returned non-success message');

  const passes: ISSPassPrediction[] = json.response.map((p) => ({
    risetime: p.risetime * 1000,
    duration: p.duration,
    // OpenNotify's free pass endpoint doesn't return max altitude directly;
    // we estimate a typical value here. For precise per-pass altitude, the
    // /api/trails route's propagated ISS trail is the authoritative source.
    maxAlt: 45,
  }));

  await cacheSetWithTimestamp(cacheKey, passes, PASSES_TTL_SECONDS);
  return passes;
}

export async function GET(req: NextRequest): Promise<NextResponse<ISSLiveData | ApiError>> {
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

  try {
    const [position, passes] = await Promise.all([fetchIssPosition(), fetchIssPasses(lat, lon)]);
    return NextResponse.json({ position, passes }, { status: 200 });
  } catch (err) {
    console.error('[/api/iss] upstream failure:', err);

    // Attempt to serve stale cache as a last resort.
    const stalePosition = await cacheGet<{ lat: number; lon: number; alt: number }>('iss:position');
    const stalePasses = await cacheGet<ISSPassPrediction[]>(`iss:passes:${lat.toFixed(2)}:${lon.toFixed(2)}`);

    if (stalePosition) {
      return NextResponse.json(
        { position: stalePosition, passes: stalePasses ?? [], stale: true },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'ISS live data is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
