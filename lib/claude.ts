import Anthropic from '@anthropic-ai/sdk';
import { SatelliteTrail, NextISSPass, TimeWindow } from '@/types';
import { azimuthToCompassLabel } from './coordinates';

declare global {
  // eslint-disable-next-line no-var
  var __aetherAnthropic: Anthropic | undefined;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable.');
  }
  if (!global.__aetherAnthropic) {
    global.__aetherAnthropic = new Anthropic({ apiKey });
  }
  return global.__aetherAnthropic;
}

const SYSTEM_PROMPT = `You are Aether Drift's narrator. Write 3-4 sentences of vivid, plain-English sky report for a specific location and time window. Sound like a knowledgeable friend, not a manual. Mention the most notable satellite passes (highest altitude = most visible), whether the ISS appeared, any planets visible, and what's coming up next. Use specific times and directions. Keep it under 100 words.`;

const MODEL = 'claude-sonnet-4-6';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

/**
 * Build a concise data summary string from trails + ISS pass info, used as
 * the Claude user-message payload. Kept compact so the narration stays
 * grounded in the actual numbers rather than inventing details.
 */
export function buildDataSummary(
  trails: SatelliteTrail[],
  location: string,
  window: TimeWindow,
  nextISSPass: NextISSPass | null
): string {
  const topPasses = [...trails].sort((a, b) => b.maxAltitude - a.maxAltitude).slice(0, 5);

  const passLines = topPasses.map((t) => {
    const peak = t.points.reduce((best, p) => (p.altitude > best.altitude ? p : best), t.points[0]);
    const direction = peak ? azimuthToCompassLabel(peak.azimuth) : 'unknown direction';
    const time = peak ? formatTime(peak.timestamp) : 'unknown time';
    return `- ${t.name} (${t.orbitType}): peaked at ${t.maxAltitude.toFixed(0)}° altitude, ${time} UTC, toward ${direction}`;
  });

  const issLine = nextISSPass
    ? `Next ISS pass: ${formatTime(nextISSPass.time)} UTC, max altitude ${nextISSPass.maxAlt.toFixed(0)}°, direction ${nextISSPass.direction}.`
    : 'No upcoming ISS pass in range.';

  return [
    `Location: ${location}`,
    `Window: ${formatTime(window.start)} to ${formatTime(window.end)} UTC`,
    `Top passes:`,
    passLines.join('\n') || '(none above 5° altitude in this window)',
    issLine,
  ].join('\n');
}

/**
 * Call Claude to generate the plain-language Drift Report narration.
 * Throws on failure — callers (the /api/drift-report route) are
 * responsible for catching and falling back to a templated summary.
 */
export async function generateDriftNarration(dataSummary: string): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 220,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: dataSummary }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude response contained no text block.');
  }

  return textBlock.text.trim();
}

/**
 * Deterministic, template-based fallback narration used when the Claude
 * API call fails. Mirrors the same information the AI version would
 * surface, just without the natural-language flourish.
 */
export function buildFallbackNarration(
  trails: SatelliteTrail[],
  location: string,
  nextISSPass: NextISSPass | null
): string {
  const best = [...trails].sort((a, b) => b.maxAltitude - a.maxAltitude)[0];

  const bestLine = best
    ? `The best pass over ${location} was ${best.name}, reaching ${best.maxAltitude.toFixed(0)}° above the horizon.`
    : `No notable passes were visible over ${location} in this window.`;

  const issLine = nextISSPass
    ? `Next up: the ISS passes at ${formatTime(nextISSPass.time)} UTC, climbing to ${nextISSPass.maxAlt.toFixed(0)}° toward the ${nextISSPass.direction}.`
    : `No ISS pass is currently predicted in range.`;

  return `${bestLine} ${issLine}`;
}
