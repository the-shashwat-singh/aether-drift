import { CloudCoverEntry } from '@/types';

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    cloudcover: number[];
  };
}

/**
 * Fetch hourly cloud cover for the past 3 days and next day for a given
 * lat/lon. No API key required.
 */
export async function fetchCloudCover(lat: number, lon: number): Promise<CloudCoverEntry[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: 'cloudcover',
    past_days: '3',
    forecast_days: '1',
    timezone: 'UTC',
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const json: OpenMeteoResponse = await res.json();
  if (!json.hourly?.time || !json.hourly?.cloudcover) {
    throw new Error('Open-Meteo response missing hourly cloud cover data');
  }

  const entries: CloudCoverEntry[] = json.hourly.time.map((isoTime, i) => ({
    timestamp: new Date(`${isoTime}Z`).getTime(),
    cloudCoverPercent: json.hourly.cloudcover[i] ?? 0,
  }));

  return entries;
}

/**
 * Look up the cloud cover percentage closest to a given timestamp, used to
 * derive a per-pass visibilityScore ('clear' | 'cloudy' | 'unknown').
 */
export function nearestCloudCover(
  entries: CloudCoverEntry[],
  timestamp: number
): number | null {
  if (entries.length === 0) return null;

  let closest = entries[0];
  let smallestDiff = Math.abs(entries[0].timestamp - timestamp);

  for (const entry of entries) {
    const diff = Math.abs(entry.timestamp - timestamp);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = entry;
    }
  }

  // If the nearest sample is more than 90 minutes away, treat as unknown.
  if (smallestDiff > 90 * 60 * 1000) return null;
  return closest.cloudCoverPercent;
}

export function cloudCoverToVisibilityScore(
  cloudCoverPercent: number | null
): 'clear' | 'cloudy' | 'unknown' {
  if (cloudCoverPercent === null) return 'unknown';
  return cloudCoverPercent < 40 ? 'clear' : 'cloudy';
}
