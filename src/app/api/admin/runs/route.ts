import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as ops from '@/server/domains/ops';

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? 50);
    const offset = Number(searchParams.get('offset') ?? 0);
    const runs = await ops.getGraphRuns(limit, offset);
    return NextResponse.json(runs);
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
