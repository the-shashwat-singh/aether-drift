'use client';

import { useState, useEffect, useCallback } from 'react';
import { findNearestDemoCity } from '@/lib/demoCities';

export interface LocationState {
  lat: number;
  lon: number;
  label: string;
  source: 'geolocation' | 'default' | 'manual' | 'url';
}

const DEFAULT_LOCATION: LocationState = {
  lat: 28.6139,
  lon: 77.209,
  label: 'New Delhi, India',
  source: 'default',
};

/**
 * Resolves the user's location in priority order:
 * 1. Explicit override (e.g. from URL params) passed via setLocation
 * 2. Browser geolocation (if permitted)
 * 3. Default fallback (New Delhi)
 *
 * Geolocation results are reverse-labeled using the nearest known demo
 * city as a friendly approximation (a full geocoding reverse lookup is out
 * of scope for this hook — LocationSearch handles forward geocoding).
 */
export function useLocation(initial?: Partial<LocationState>) {
  const [location, setLocationState] = useState<LocationState>({
    ...DEFAULT_LOCATION,
    ...initial,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const requestGeolocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearestCity = findNearestDemoCity(latitude, longitude);
        setLocationState({
          lat: latitude,
          lon: longitude,
          label: `Near ${nearestCity.name.split(',')[0]}`,
          source: 'geolocation',
        });
        setIsLocating(false);
      },
      (err) => {
        setGeoError(err.message || 'Unable to retrieve your location.');
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  const setLocation = useCallback(
    (next: Omit<LocationState, 'source'> & { source?: LocationState['source'] }) => {
      setLocationState({ source: 'manual', ...next });
    },
    []
  );

  // Attempt geolocation once on mount, unless an explicit initial location
  // (e.g. from a shared URL) was provided.
  useEffect(() => {
    if (!initial?.lat && !initial?.lon) {
      requestGeolocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, setLocation, isLocating, geoError, requestGeolocation };
}
