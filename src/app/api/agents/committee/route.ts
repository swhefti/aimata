import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import { runCommitteeSynthesis } from '@/server/graphs/committee';
import { buildCommitteeContext } from '@/server/graphs/context';

/**
 * POST /api/agents/committee
 * Run the committee synthesis graph.
 * Gathers deterministic context, runs all 4 specialists + synthesis.
 * Returns the unified committee brief with specialist breakdowns.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const subjectType = body.subjectType ?? 'basket';
    const subjectId = body.subjectId ?? null;

    // Build deterministic context from existing data
    const contextSummary = await buildCommitteeContext(user.id, subjectType, subjectId);

    // Run the committee graph
    const result = await runCommitteeSynthesis(
      user.id,
      subjectType,
      subjectId,
      contextSummary,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Committee synthesis failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
