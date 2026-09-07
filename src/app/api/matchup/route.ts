import { NextResponse } from 'next/server';
import { getHostMatchup } from '@/lib/hostMatchup';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  try {
    const matchup = await getHostMatchup();
    return NextResponse.json(
      {
        athleteA: matchup.athleteA.name,
        athleteB: matchup.athleteB.name,
        currentPoseId: matchup.currentPoseId,
        updatedAt: matchup.updatedAt,
      },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json(
      { error: 'Could not load the current matchup' },
      { status: 502, headers: NO_STORE },
    );
  }
}
