import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as trader from '@/server/domains/trader';

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { ticker, manual_weight } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }

    if (manual_weight !== null && (typeof manual_weight !== 'number' || manual_weight < 0 || manual_weight > 100)) {
      return NextResponse.json({ error: 'manual_weight must be a number between 0 and 100, or null' }, { status: 400 });
    }

    const positions = await trader.updatePositionWeight(user.id, ticker, manual_weight);
    return NextResponse.json({ positions });
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
