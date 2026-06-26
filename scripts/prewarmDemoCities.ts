/**
 * Pre-warms the Redis cache with trail, planet, and weather data for the 5
 * demo cities, so the live demo never hits a cold-cache network call.
 *
 * Run with: npm run prewarm
 * Requires .env.local to be populated (UPSTASH_*, NASA_HORIZONS_EMAIL).
 */
import { DEMO_CITIES } from '../lib/demoCities';
import { bucketKeyPart, bucketWindowStart6h, todayDateStr } from '../lib/locationBucket';
import { cacheSetWithTimestamp } from '../lib/redis';
import { getActiveTles } from '../lib/celestrak';
import { propagateAll } from '../lib/propagate';
import { lookupOperator } from '../lib/operatorLookup';
import { fetchAllPlanetArcs } from '../lib/horizons';
import { fetchCloudCover } from '../lib/openmeteo';

const TRAILS_TTL_SECONDS = 3600;
const PLANETS_TTL_SECONDS = 3600;
const WEATHER_TTL_SECONDS = 1800;
const WINDOW_BEFORE_MS = 72 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 24 * 60 * 60 * 1000;

async function prewarmCity(city: { name: string; lat: number; lon: number }) {
  console.log(`\n[prewarm] ${city.name}`);
  const now = Date.now();
  const windowStart = now - 6 * 60 * 60 * 1000;
  const window = { start: windowStart, end: now };

  try {
    const { tles } = await getActiveTles();
    if (tles.length === 0) {
      console.warn(`[prewarm] no TLEs available, skipping trails for ${city.name}`);
    } else {
      let trails = propagateAll(tles, window, { lat: city.lat, lon: city.lon });
      trails = trails.map((t) => ({ ...t, operator: lookupOperator(t.name) }));

      const trailsKey = `trails:${bucketKeyPart(city.lat, city.lon)}:${bucketWindowStart6h(windowStart)}`;
      await cacheSetWithTimestamp(trailsKey, trails, TRAILS_TTL_SECONDS);
      console.log(`[prewarm] cached ${trails.length} trails -> ${trailsKey}`);
    }
  } catch (err) {
    console.error(`[prewarm] trails failed for ${city.name}:`, err);
  }

  try {
    const contactEmail = process.env.NASA_HORIZONS_EMAIL || 'noreply@aetherdrift.app';
    const planetWindow = { start: now - WINDOW_BEFORE_MS, end: now + WINDOW_AFTER_MS };
    const { arcs } = await fetchAllPlanetArcs(city.lat, city.lon, planetWindow, contactEmail);

    if (arcs.length > 0) {
      const planetsKey = `planets:${bucketKeyPart(city.lat, city.lon)}:${todayDateStr()}`;
      await cacheSetWithTimestamp(planetsKey, arcs, PLANETS_TTL_SECONDS);
      console.log(`[prewarm] cached ${arcs.length} planet arcs -> ${planetsKey}`);
    } else {
      console.warn(`[prewarm] no planet arcs returned for ${city.name}`);
    }
  } catch (err) {
    console.error(`[prewarm] planets failed for ${city.name}:`, err);
  }

  try {
    const entries = await fetchCloudCover(city.lat, city.lon);
    const weatherKey = `weather:${city.lat.toFixed(2)}:${city.lon.toFixed(2)}`;
    await cacheSetWithTimestamp(weatherKey, entries, WEATHER_TTL_SECONDS);
    console.log(`[prewarm] cached ${entries.length} cloud cover entries -> ${weatherKey}`);
  } catch (err) {
    console.error(`[prewarm] weather failed for ${city.name}:`, err);
  }
}

async function main() {
  console.log(`Pre-warming cache for ${DEMO_CITIES.length} demo cities...`);
  for (const city of DEMO_CITIES) {
    await prewarmCity(city);
  }
  console.log('\n[prewarm] done.');
}

main().catch((err) => {
  console.error('[prewarm] fatal error:', err);
  process.exit(1);
});
