import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import { askWithRouting } from '@/server/graphs/router';
import { buildTickerContext, buildBasketContext, buildActionContext } from '@/server/graphs/context';

/**
 * POST /api/agents/ask
 * Contextual question → LangGraph routing → specialist answer.
 *
 * Body: { question, subjectType, subjectId?, context? }
 * If context is not provided, it's built from subjectType + subjectId.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { question, subjectType, subjectId } = body;

    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    const st = subjectType ?? 'market';

    // Build context from deterministic data if not provided
    let contextSummary = body.context as string | undefined;
    if (!contextSummary) {
      switch (st) {
        case 'ticker':
          contextSummary = subjectId ? await buildTickerContext(subjectId) : 'No ticker specified.';
          break;
        case 'basket':
          contextSummary = await buildBasketContext(user.id);
          break;
        case 'recommendation':
          contextSummary = subjectId ? await buildActionContext(user.id, subjectId) : await buildBasketContext(user.id);
          break;
        default:
          contextSummary = 'General market question.';
      }
    }

    const result = await askWithRouting(user.id, question, st, subjectId ?? null, contextSummary);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to process question', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
