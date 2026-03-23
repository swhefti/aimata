import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as ops from '@/server/domains/ops';

export async function GET() {
  try {
    await requireUser();
    const outcomes = await ops.getOpportunityOutcomes();
    return NextResponse.json(outcomes);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
