export type OrbitType = 'LEO' | 'MEO' | 'GEO' | 'ISS';

export interface SkyPoint {
  azimuth: number; // degrees, 0=N, 90=E, 180=S, 270=W
  altitude: number; // degrees above horizon, 0-90
  timestamp: number; // Unix ms
}

export interface SatelliteTrail {
  id: string;
  name: string;
  noradId: number;
  orbitType: OrbitType;
  points: SkyPoint[];
  maxAltitude: number;
  color: string;
  visibilityScore?: 'clear' | 'cloudy' | 'unknown';
  /** True when the underlying TLE used to compute this trail is stale (> 2h old). */
  staleData?: boolean;
  /** Orbital altitude in km, derived from TLE mean motion (semi-major axis - Earth radius). */
  altitudeKm?: number;
  /** Orbital period in minutes, derived from TLE mean motion. */
  periodMinutes?: number;
  /** Best-effort operator/country lookup. */
  operator?: string;
}

export interface LocationBucket {
  lat: number; // rounded to 0.5°
  lon: number;
  label: string;
}

export interface TimeWindow {
  start: number; // Unix ms
  end: number;
}

export interface NextISSPass {
  time: number;
  maxAlt: number;
  direction: string;
}

export interface DriftReportData {
  location: string;
  window: TimeWindow;
  topPasses: SatelliteTrail[];
  nextISSPass: NextISSPass | null;
  narrativeText: string; // Claude-generated
  isFallback?: boolean;
}

export interface PlanetArc {
  name: string;
  points: SkyPoint[];
  color: string;
}

export interface CloudCoverEntry {
  timestamp: number;
  cloudCoverPercent: number;
}

export interface ISSPassPrediction {
  risetime: number;
  duration: number;
  maxAlt: number;
}

export interface ISSLiveData {
  position: { lat: number; lon: number; alt: number };
  passes: ISSPassPrediction[];
  stale?: boolean;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  country?: string;
}

export interface FamousPass {
  id: string;
  title: string;
  lat: number;
  lon: number;
  timestamp: number;
  description: string;
}

export interface DataFreshness {
  tleAgeMinutes: number | null;
  issLive: boolean;
  horizonsOk: boolean;
}

/** Generic API error envelope returned by every route on failure. */
export interface ApiError {
  error: string;
  stale?: boolean;
}
