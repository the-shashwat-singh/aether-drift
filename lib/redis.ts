import { Redis } from '@upstash/redis';

declare global {
  // eslint-disable-next-line no-var
  var __aetherRedis: Redis | undefined;
}

/**
 * Singleton Upstash Redis REST client.
 * Reused across hot-reloads in dev and across invocations in serverless
 * functions within the same execution context.
 */
function createClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL || 'https://dummy.upstash.io';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy_token';

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn(
      'Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN environment variables. Using dummy values.'
    );
  }

  return new Redis({ url, token });
}

export const redis: Redis = global.__aetherRedis ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  global.__aetherRedis = redis;
}

/**
 * Get a JSON value from Redis, returning null on miss or parse failure.
 * Upstash's REST client already deserializes JSON-stored values, but we
 * defensively handle the case where a value was stored as a raw string.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (err) {
    console.error(`[redis] GET failed for key "${key}":`, err);
    return null;
  }
}

/**
 * Set a JSON value in Redis with a TTL (seconds).
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error(`[redis] SET failed for key "${key}":`, err);
  }
}

/**
 * Fetch the age (in seconds) since a key was last written, by storing a
 * companion `${key}:writtenAt` timestamp alongside the primary value.
 */
export async function cacheSetWithTimestamp<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  try {
    const now = Date.now();
    await Promise.all([
      redis.set(key, value, { ex: ttlSeconds }),
      redis.set(`${key}:writtenAt`, now, { ex: ttlSeconds }),
    ]);
  } catch (err) {
    console.error(`[redis] SET (with timestamp) failed for key "${key}":`, err);
  }
}

export async function cacheGetWrittenAt(key: string): Promise<number | null> {
  try {
    const value = await redis.get<number>(`${key}:writtenAt`);
    return value ?? null;
  } catch (err) {
    console.error(`[redis] GET writtenAt failed for key "${key}":`, err);
    return null;
  }
}
