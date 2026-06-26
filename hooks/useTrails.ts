'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SatelliteTrail, TimeWindow } from '@/types';

interface UseTrailsOptions {
  lat: number;
  lon: number;
  window: TimeWindow;
  debounceMs?: number;
}

interface UseTrailsResult {
  trails: SatelliteTrail[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches satellite trails for a given location + time window from
 * /api/trails, debouncing rapid changes (e.g. dragging the TimeSlider) by
 * 300ms before firing the network request. Keeps an in-memory cache keyed
 * by a rounded lat/lon/window signature so flipping back and forth between
 * recently-seen windows doesn't refetch.
 */
export function useTrails({ lat, lon, window, debounceMs = 300 }: UseTrailsOptions): UseTrailsResult {
  const [trails, setTrails] = useState<SatelliteTrail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memoCache = useRef<Map<string, SatelliteTrail[]>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const requestNonce = useRef(0);

  const cacheKey = `${lat.toFixed(2)}:${lon.toFixed(2)}:${window.start}:${window.end}`;

  const fetchTrails = useCallback(async () => {
    const myNonce = ++requestNonce.current;

    const memoized = memoCache.current.get(cacheKey);
    if (memoized) {
      setTrails(memoized);
      setIsLoading(false);
      setError(null);
      return;
    }

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/trails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, windowStart: window.start, windowEnd: window.end }),
        signal: controller.signal,
      });

      if (myNonce !== requestNonce.current) return; // a newer request superseded this one

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      const data: SatelliteTrail[] = await res.json();
      memoCache.current.set(cacheKey, data);
      setTrails(data);
      setError(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('[useTrails] fetch failed:', err);
      setError('Data temporarily unavailable. Showing the most recent data we have.');
    } finally {
      if (myNonce === requestNonce.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, lat, lon, window.start, window.end]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchTrails();
    }, debounceMs);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, debounceMs]);

  const refetch = useCallback(() => {
    memoCache.current.delete(cacheKey);
    fetchTrails();
  }, [cacheKey, fetchTrails]);

  return { trails, isLoading, error, refetch };
}
