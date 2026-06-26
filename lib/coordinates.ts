import * as satellite from 'satellite.js';
import { SkyPoint } from '@/types';

export interface ObserverPosition {
  lat: number; // degrees
  lon: number; // degrees
  heightKm?: number; // observer elevation above sea level, km
}

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Convert an ECI (Earth-Centered Inertial) position, as produced by
 * satellite.js's SGP4 propagator, into topocentric azimuth/altitude as
 * seen from a ground observer.
 *
 * @param eciPositionKm  ECI position vector in km, e.g. propagateResult.position
 * @param dateUtc        The UTC Date the ECI position corresponds to
 *                       (needed to rotate ECI -> ECEF using GMST)
 * @param observer        Observer's geodetic lat/lon (degrees) and height (km).
 */
export function eciToAzAlt(
  eciPositionKm: satellite.EciVec3<number>,
  dateUtc: Date,
  observer: ObserverPosition
): { azimuth: number; altitude: number; rangeKm: number } {
  const observerGd = {
    latitude: degreesToRadians(observer.lat),
    longitude: degreesToRadians(observer.lon),
    height: observer.heightKm ?? 0,
  };

  const gmst = satellite.gstime(dateUtc);
  const positionEcf = satellite.eciToEcf(eciPositionKm, gmst);
  const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

  const azimuthDeg = radiansToDegrees(lookAngles.azimuth);
  const altitudeDeg = radiansToDegrees(lookAngles.elevation);

  // satellite.js azimuth convention is already 0=N, 90=E, clockwise, matching
  // our SkyPoint convention, but it can return slightly negative values due
  // to floating point — normalize to [0, 360).
  const normalizedAzimuth = ((azimuthDeg % 360) + 360) % 360;

  return {
    azimuth: normalizedAzimuth,
    altitude: altitudeDeg,
    rangeKm: lookAngles.rangeSat,
  };
}

/**
 * Build a SkyPoint from a raw az/alt/timestamp triple, clamping altitude to
 * a sane [-90, 90] range to guard against numerical noise near the horizon.
 */
export function toSkyPoint(azimuth: number, altitude: number, timestamp: number): SkyPoint {
  return {
    azimuth,
    altitude: Math.max(-90, Math.min(90, altitude)),
    timestamp,
  };
}

/**
 * Classify an orbital altitude (km, above Earth's surface) into the
 * LEO/MEO/GEO buckets used throughout the UI.
 */
export function classifyOrbit(altitudeKm: number): 'LEO' | 'MEO' | 'GEO' {
  if (altitudeKm < 2000) return 'LEO';
  if (altitudeKm < 35786) return 'MEO';
  return 'GEO';
}

/** Earth's mean equatorial radius in km, used to derive altitude from semi-major axis. */
export const EARTH_RADIUS_KM = 6378.137;

/** Earth's standard gravitational parameter (km^3/s^2), used for orbit derivation. */
export const EARTH_MU_KM3_S2 = 398600.4418;

/**
 * Derive orbital altitude (km) and period (minutes) from a satellite.js
 * SatRec's mean motion (radians/minute, field `no`).
 */
export function deriveOrbitFromMeanMotion(meanMotionRadPerMin: number): {
  altitudeKm: number;
  periodMinutes: number;
} {
  const periodMinutes = (2 * Math.PI) / meanMotionRadPerMin;
  const periodSeconds = periodMinutes * 60;
  // Kepler's third law: a^3 = mu * (T / 2pi)^2
  const semiMajorAxisKm = Math.cbrt(
    EARTH_MU_KM3_S2 * Math.pow(periodSeconds / (2 * Math.PI), 2)
  );
  const altitudeKm = semiMajorAxisKm - EARTH_RADIUS_KM;
  return { altitudeKm, periodMinutes };
}

/**
 * Great-circle bearing-based cardinal direction label for a given azimuth.
 */
export function azimuthToCompassLabel(azimuth: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(((azimuth % 360) + 360) % 360 / 22.5) % 16;
  return directions[index];
}
