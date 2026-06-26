import { LocationBucket } from '@/types';

/**
 * Round a coordinate to the nearest 0.5° grid step. This keeps cache hit
 * rates high for nearby requests (e.g. a user panning slightly, or two
 * people in the same city) without meaningfully degrading the sky-position
 * accuracy of trail math — 0.5° of latitude/longitude is well under the
 * angular resolution that matters for naked-eye satellite spotting.
 */
function roundToGrid(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

export function bucketLocation(lat: number, lon: number, label = ''): LocationBucket {
  return {
    lat: roundToGrid(lat),
    lon: roundToGrid(lon),
    label,
  };
}

/** Two-decimal-place string form used directly inside Redis cache keys. */
export function bucketKeyPart(lat: number, lon: number): string {
  const b = bucketLocation(lat, lon);
  return `${b.lat.toFixed(2)}:${b.lon.toFixed(2)}`;
}

/**
 * Bucket a Unix-ms timestamp into a 6-hour window, returned as a stable
 * integer suitable for cache keys (e.g. trails:{lat}:{lon}:{windowBucketHour}).
 */
export function bucketWindowStart6h(windowStartMs: number): number {
  const sixHoursMs = 6 * 60 * 60 * 1000;
  return Math.floor(windowStartMs / sixHoursMs) * sixHoursMs;
}

/** Today's date as YYYY-MM-DD (UTC), used for daily-granularity cache keys. */
export function todayDateStr(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
