import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as trader from '@/server/domains/trader';
import * as agents from '@/server/domains/agents';

export async function GET() {
  try {
    const user = await requireUser();
    const brief = await trader.getLatestBrief(user.id);
    return NextResponse.json({ brief });
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

export async function POST() {
  try {
    const user = await requireUser();
    const brief = await agents.generateDailyBrief(user.id);
    return NextResponse.json({ brief });
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
