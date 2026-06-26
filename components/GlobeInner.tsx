'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import {
  Viewer,
  Entity,
  PolylineGraphics,
  EllipsoidGraphics,
  PointGraphics,
} from 'resium';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { SatelliteTrail, PlanetArc } from '@/types';
import { OrbitalShellVisibility } from './OrbitalShellToggle';

interface GlobeProps {
  trails: SatelliteTrail[];
  planetArcs: PlanetArc[];
  location: { lat: number; lon: number; label: string };
  shellVisibility: OrbitalShellVisibility;
  onSelectTrail: (trail: SatelliteTrail) => void;
}

interface StarPoint {
  ra: number; // right ascension, degrees
  dec: number; // declination, degrees
  mag: number; // visual magnitude
}

const EARTH_RADIUS_M = 6378137;
const LEO_RING_ALTITUDE_M = 400000;
const MEO_RING_ALTITUDE_M = 20200000;
const GEO_RING_ALTITUDE_M = 35786000;
const STAR_MAGNITUDE_CUTOFF = 5.0;

/** Convert equatorial RA/Dec to a unit-sphere ECI-ish Cartesian direction for distant "fixed" star rendering. */
function raDecToCartesian(raDeg: number, decDeg: number, distance: number): Cesium.Cartesian3 {
  const ra = Cesium.Math.toRadians(raDeg);
  const dec = Cesium.Math.toRadians(decDeg);
  const x = distance * Math.cos(dec) * Math.cos(ra);
  const y = distance * Math.cos(dec) * Math.sin(ra);
  const z = distance * Math.sin(dec);
  return new Cesium.Cartesian3(x, y, z);
}

function trailToCartesianArray(
  trail: { points: Array<{ azimuth: number; altitude: number }> },
  observerLon: number,
  observerLat: number
): Cesium.Cartesian3[] {
  // Project each az/alt sample outward from the observer position onto a
  // shell above Earth's surface, approximating the satellite's sky path as
  // a visual trail anchored near the observer (a simplified but visually
  // faithful representation suitable for this globe view; true ECEF
  // positions are used for the Compass widget's precision needs).
  const observerCartesian = Cesium.Cartesian3.fromDegrees(observerLon, observerLat, 0);

  return trail.points.map((p) => {
    const azRad = Cesium.Math.toRadians(p.azimuth);
    const altRad = Cesium.Math.toRadians(Math.max(p.altitude, 0));

    // Local ENU offset direction based on azimuth/altitude, scaled by a
    // visually pleasing arc radius proportional to (90 - altitude).
    const horizontalDistance = (1 - altRad / (Math.PI / 2)) * 2000000;
    const east = Math.sin(azRad) * horizontalDistance;
    const north = Math.cos(azRad) * horizontalDistance;
    const up = Math.sin(altRad) * 800000 + 200000;

    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(observerCartesian);
    const localOffset = new Cesium.Cartesian3(east, north, up);
    const worldPos = Cesium.Matrix4.multiplyByPoint(transform, localOffset, new Cesium.Cartesian3());

    return worldPos;
  });
}

function GlobeInner({ trails, planetArcs, location, shellVisibility, onSelectTrail }: GlobeProps) {
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  // Cache buster for Vercel CDN issue
  useEffect(() => {
    console.debug('Globe initialized with cache buster v2');
  }, []);
  // Track previous trails to know what to add/remove
  const prevTrails = useRef<SatelliteTrail[]>([]);
  const [stars, setStars] = useState<StarPoint[]>([]);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [creditContainer] = useState<HTMLDivElement | undefined>(() =>
    typeof document !== 'undefined' ? document.createElement('div') : undefined
  );

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
    if (token) {
      Cesium.Ion.defaultAccessToken = token;
    }
    setCesiumReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/bsc5.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Star catalog HTTP ${res.status}`);
        return res.json();
      })
      .then((data: StarPoint[]) => {
        if (cancelled) return;
        const filtered = data.filter((s) => s.mag < STAR_MAGNITUDE_CUTOFF);
        setStars(filtered);
      })
      .catch((err) => {
        console.error('[Globe] failed to load star catalog:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleViewerRef = useCallback((e: { cesiumElement?: Cesium.Viewer } | null) => {
    if (e?.cesiumElement) viewerRef.current = e.cesiumElement;
  }, []);

  // Fly the camera to the selected location whenever it changes.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !cesiumReady) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(location.lon, location.lat, 4000000),
      duration: 1.5,
    });
  }, [location.lat, location.lon, cesiumReady]);

  if (!cesiumReady) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-space-bg">
        <p className="text-sm text-text-secondary">Loading globe…</p>
      </div>
    );
  }

  return (
    <Viewer
      full
      ref={handleViewerRef}
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      homeButton={false}
      sceneModePicker={false}
      navigationHelpButton={false}
      geocoder={false}
      fullscreenButton={false}
      selectionIndicator={false}
      infoBox={false}
      creditContainer={creditContainer}
    >
      {/* Background stars rendered as distant point primitives */}
      {stars.map((star, i) => {
        const position = raDecToCartesian(star.ra, star.dec, 50000000000);
        const brightness = Math.max(0.3, 1 - star.mag / STAR_MAGNITUDE_CUTOFF);
        return (
          <Entity key={`star-${i}`} position={position}>
            <PointGraphics
              pixelSize={Math.max(1, 3 - star.mag * 0.4)}
              color={Cesium.Color.WHITE.withAlpha(brightness)}
            />
          </Entity>
        );
      })}

      {/* Location pin */}
      <Entity
        position={Cesium.Cartesian3.fromDegrees(location.lon, location.lat, 0)}
        name={location.label}
      >
        <PointGraphics pixelSize={10} color={Cesium.Color.fromCssColorString('#FFD54F')} outlineColor={Cesium.Color.BLACK} outlineWidth={1} />
      </Entity>

      {/* Satellite + ISS trails */}
      {trails.map((trail) => {
        const positions = trailToCartesianArray(trail, location.lon, location.lat);
        const isIss = trail.orbitType === 'ISS';
        return (
          <Entity key={trail.id} onClick={() => onSelectTrail(trail)} name={trail.name}>
            <PolylineGraphics
              positions={positions}
              width={isIss ? 4 : 1.5}
              material={
                new Cesium.PolylineGlowMaterialProperty({
                  glowPower: isIss ? 0.3 : 0.1,
                  color: Cesium.Color.fromCssColorString(trail.color).withAlpha(isIss ? 1 : 0.6),
                })
              }
            />
          </Entity>
        );
      })}

      {/* Planet/Moon arcs as dashed polylines */}
      {planetArcs.map((arc) => {
        const positions = trailToCartesianArray(arc, location.lon, location.lat);
        return (
          <Entity key={`planet-${arc.name}`} name={arc.name}>
            <PolylineGraphics
              positions={positions}
              width={1.5}
              material={
                new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color.fromCssColorString(arc.color),
                  dashLength: 12,
                })
              }
            />
          </Entity>
        );
      })}

      {/* Orbital shell rings, centered on Earth */}
      {shellVisibility.LEO && (
        <Entity position={Cesium.Cartesian3.ZERO}>
          <EllipsoidGraphics
            radii={
              new Cesium.Cartesian3(
                EARTH_RADIUS_M + LEO_RING_ALTITUDE_M,
                EARTH_RADIUS_M + LEO_RING_ALTITUDE_M,
                EARTH_RADIUS_M + LEO_RING_ALTITUDE_M
              )
            }
            material={Cesium.Color.fromCssColorString('#4FC3F7').withAlpha(0.06)}
            outline
            outlineColor={Cesium.Color.fromCssColorString('#4FC3F7').withAlpha(0.25)}
          />
        </Entity>
      )}
      {shellVisibility.MEO && (
        <Entity position={Cesium.Cartesian3.ZERO}>
          <EllipsoidGraphics
            radii={
              new Cesium.Cartesian3(
                EARTH_RADIUS_M + MEO_RING_ALTITUDE_M,
                EARTH_RADIUS_M + MEO_RING_ALTITUDE_M,
                EARTH_RADIUS_M + MEO_RING_ALTITUDE_M
              )
            }
            material={Cesium.Color.fromCssColorString('#81C784').withAlpha(0.05)}
            outline
            outlineColor={Cesium.Color.fromCssColorString('#81C784').withAlpha(0.2)}
          />
        </Entity>
      )}
      {shellVisibility.GEO && (
        <Entity position={Cesium.Cartesian3.ZERO}>
          <EllipsoidGraphics
            radii={
              new Cesium.Cartesian3(
                EARTH_RADIUS_M + GEO_RING_ALTITUDE_M,
                EARTH_RADIUS_M + GEO_RING_ALTITUDE_M,
                EARTH_RADIUS_M + GEO_RING_ALTITUDE_M
              )
            }
            material={Cesium.Color.fromCssColorString('#FFD54F').withAlpha(0.04)}
            outline
            outlineColor={Cesium.Color.fromCssColorString('#FFD54F').withAlpha(0.15)}
          />
        </Entity>
      )}
    </Viewer>
  );
}

export default memo(GlobeInner);
