import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as ops from '@/server/domains/ops';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const nodeRuns = await ops.getNodeRuns(id);
    return NextResponse.json(nodeRuns);
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
