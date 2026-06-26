import { NextRequest, NextResponse } from 'next/server';
import { SatelliteTrail, TimeWindow, NextISSPass, DriftReportData, ApiError } from '@/types';
import { buildDataSummary, generateDriftNarration, buildFallbackNarration } from '@/lib/claude';

interface DriftReportRequestBody {
  trails: SatelliteTrail[];
  location: string;
  window: TimeWindow;
  nextISSPass: NextISSPass | null;
}

function isValidBody(body: unknown): body is DriftReportRequestBody {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.trails) &&
    typeof b.location === 'string' &&
    b.location.length > 0 &&
    typeof b.window === 'object' &&
    b.window !== null &&
    typeof (b.window as TimeWindow).start === 'number' &&
    typeof (b.window as TimeWindow).end === 'number'
  );
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<Pick<DriftReportData, 'narrativeText' | 'isFallback'> | ApiError>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Request must include trails[], location string, window {start, end}, and nextISSPass.' },
      { status: 400 }
    );
  }

  const { trails, location, window, nextISSPass } = body;
  const dataSummary = buildDataSummary(trails, location, window, nextISSPass);

  try {
    const narrativeText = await generateDriftNarration(dataSummary);
    return NextResponse.json({ narrativeText, isFallback: false }, { status: 200 });
  } catch (err) {
    console.error('[/api/drift-report] Claude call failed, using fallback narration:', err);
    const narrativeText = buildFallbackNarration(trails, location, nextISSPass);
    return NextResponse.json({ narrativeText, isFallback: true }, { status: 200 });
  }
}
