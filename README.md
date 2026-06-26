# Aether Drift: The Stellar Wake

See the sky as motion, not a snapshot. Pick a location and watch glowing trails of where satellites, the ISS, planets, and the Moon have been over the last 72 hours — and where they're going in the next 24.

Built for the AstralWeb Innovate Hackathon.

## Stack

- **Framework:** Next.js 14 (App Router)
- **3D Globe:** CesiumJS via `resium`
- **Star Trail Compass:** HTML5 Canvas (no 3D lib)
- **Satellite math:** `satellite.js` (SGP4 TLE propagation)
- **Styling:** Tailwind CSS, dark space theme only
- **Backend:** Next.js API Routes
- **Cache:** Upstash Redis (REST)
- **AI narration:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Notifications:** Web Notifications API
- **Weather:** Open-Meteo (no key required)

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill in .env.local with real values, see below
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CESIUM_TOKEN` | Free account at https://ion.cesium.com → Access Tokens |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Free database at https://console.upstash.com |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `NASA_HORIZONS_EMAIL` | Any contact email — Horizons doesn't require a key, this is just sent as a polite identifier |

The app will still run with missing keys, but:
- No `NEXT_PUBLIC_CESIUM_TOKEN` → the globe falls back to Cesium's default open imagery (no Bing/Ion base layer).
- No Upstash credentials → every request will hit upstream APIs directly (no caching), and TTL-based freshness logic won't have anything to read.
- No `ANTHROPIC_API_KEY` → the Drift Report falls back to a templated narration automatically.

## Pre-warming the demo cities

Before a live demo, run:

```bash
npm run prewarm
```

This populates Redis with trail, planet, and weather data for the 5 demo cities (New Delhi, Mumbai, New York, London, Tokyo) so the first load during a demo never hits a cold cache or a flaky upstream API.

## Project structure

```
app/                  Next.js App Router pages + API routes
  api/trails/         POST — satellite trail computation (TLE propagation)
  api/iss/            GET  — live ISS position + pass predictions
  api/planets/        GET  — planet/Moon sky arcs (NASA Horizons)
  api/weather/        GET  — cloud cover timeline (Open-Meteo)
  api/drift-report/   POST — Claude-generated plain-language sky narration
components/           All UI components (Globe, Compass, DriftReport, etc.)
lib/                  Server + shared logic: propagation, coordinates, caching, API wrappers
hooks/                Client hooks: location, trails fetching, ISS alarms
types/                Shared TypeScript types
public/data/bsc5.json Bundled star catalog (subset — see note below)
scripts/              Demo pre-warm script
```

## Notes on data sources

- **CelesTrak** active-satellite TLEs are fetched live and cached in Redis for 10 minutes (`tle:active`). Falls back to the last good cache entry if CelesTrak is unreachable, and a synthetic placeholder trail for the 5 demo cities if there's no cache at all.
- **NASA JPL Horizons** OBSERVER-mode ephemeris calls compute az/alt for the Moon, Venus, Mars, Jupiter, and Saturn. Horizons can be slow or rate-limited; failures fall back to a coarse synthetic Moon arc so the globe never looks empty.
- **OpenNotify** (ISS) is a small free API with two endpoints (`iss-now.json`, `iss-pass.json`); the free pass endpoint doesn't return per-pass max altitude, so that figure is estimated — the authoritative per-pass altitude for a given location/window is the propagated ISS trail from `/api/trails`.
- **Yale Bright Star Catalog**: `public/data/bsc5.json` ships with a representative set of ~50 real named bright stars plus ~1,550 randomly-distributed dimmer stars (mag 2.1–4.95) for visual density, **not** the full 9,000+ entry catalog. Swap this file for the full processed BSC5 JSON (e.g. from `brettonw/YaleBrightStarCatalog` on GitHub) before a real deployment if star-field accuracy matters.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause time animation |
| `←` / `→` | Scrub time window by 30 minutes |
| `R` | Reset to default window + home location |
| `E` | Toggle Educational Mode |
| `S` | Toggle orbital shells |
| `Esc` | Close info card / onboarding overlay |

## Known limitations

- The Globe's satellite/planet trails are rendered as stylized arcs anchored near the observer (an ENU-offset projection of az/alt), not raw ECEF orbital paths — this keeps the visualization centered on "what you'd see from here" rather than requiring the user to track tiny dots across a full orbital path on a 3D Earth. The Compass widget uses the same az/alt data with a flat radial projection, which is the precise, glanceable view.
- `iss-pass.json`'s free tier doesn't return max altitude per pass; `/api/trails`' propagated ISS samples are the more precise source when both are available.
