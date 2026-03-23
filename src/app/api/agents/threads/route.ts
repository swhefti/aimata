import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as ops from '@/server/domains/ops';

/**
 * GET /api/agents/threads?subjectType=basket&subjectId=XRP
 * Returns recent threads + messages for a subject.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const subjectType = searchParams.get('subjectType') ?? 'market';
    const subjectId = searchParams.get('subjectId') ?? null;

    const threads = await ops.getThreadsForSubject(user.id, subjectType, subjectId, 5);
    return NextResponse.json({ threads });
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
