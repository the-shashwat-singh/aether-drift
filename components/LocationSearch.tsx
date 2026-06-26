'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GeocodeResult } from '@/types';

interface LocationSearchProps {
  onSelect: (result: GeocodeResult) => void;
  currentLabel: string;
}

interface OpenMeteoGeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

/**
 * Forward-geocodes a free-text city query using Open-Meteo's free
 * geocoding endpoint (no API key, consistent with the rest of the stack's
 * weather provider).
 */
async function geocodeCity(query: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);

  const json: { results?: OpenMeteoGeocodeResult[] } = await res.json();
  if (!json.results) return [];

  return json.results.map((r) => ({
    label: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country,
  }));
}

export default function LocationSearch({ onSelect, currentLabel }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const found = await geocodeCity(q.trim());
      setResults(found);
    } catch (err) {
      console.error('[LocationSearch] geocode failed:', err);
      setError('Search unavailable right now.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => runSearch(query), 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(result: GeocodeResult) {
    onSelect(result);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor="location-search" className="sr-only">
        Search for a city
      </label>
      <input
        id="location-search"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={currentLabel || 'Search a city...'}
        className="w-full rounded-lg border border-space-border bg-space-sidebar/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:outline-2 focus-visible:outline-orbit-leo"
        autoComplete="off"
      />

      {isOpen && (query.trim().length >= 2 || isLoading) && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-space-border bg-space-sidebar/95 backdrop-blur-md shadow-xl overflow-hidden">
          {isLoading && (
            <div className="px-3 py-2 text-xs text-text-secondary font-mono">Searching…</div>
          )}
          {!isLoading && error && (
            <div className="px-3 py-2 text-xs text-red-400 font-mono">{error}</div>
          )}
          {!isLoading && !error && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-xs text-text-secondary font-mono">No matches found.</div>
          )}
          {!isLoading &&
            results.map((r, i) => (
              <button
                key={`${r.label}-${i}`}
                type="button"
                onClick={() => handleSelect(r)}
                className="block w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-space-btnHover transition-colors"
              >
                {r.label}
                {r.country ? <span className="text-text-secondary"> · {r.country}</span> : null}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
