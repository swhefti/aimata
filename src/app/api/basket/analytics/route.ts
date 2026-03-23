import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as trader from '@/server/domains/trader';

export async function GET() {
  try {
    const user = await requireUser();
    const analytics = await trader.computeAndSnapshotAnalytics(user.id);
    return NextResponse.json(analytics);
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
