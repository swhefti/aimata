import { NextResponse } from 'next/server';
import * as advisor from '@/server/domains/advisor';

export async function POST() {
  try {
    const result = await advisor.runScanner();
    return NextResponse.json({
      success: true,
      run_id: result.runId,
      total_scored: result.totalScored,
      opportunities_surfaced: result.surfaced,
      scoring_version: result.scoringVersion,
      data_freshness: result.dataFreshness,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
