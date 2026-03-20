import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as agentService from '@/server/agents/service';
import type { AgentName } from '@/types';

/**
 * POST /api/agents/ask
 * Minimal agent interaction entry point.
 * User asks a specific agent a contextual question.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { agent, question, context, subjectType, subjectId } = body;

    if (!agent || !question) {
      return NextResponse.json({ error: 'agent and question are required' }, { status: 400 });
    }

    const validAgents = ['Mark', 'Nia', 'Paul', 'Rex'];
    if (!validAgents.includes(agent)) {
      return NextResponse.json({ error: 'Invalid agent name' }, { status: 400 });
    }

    const artifact = await agentService.askAgent(
      agent as AgentName,
      question,
      context ?? '',
      subjectType ?? 'market',
      subjectId ?? null,
      user.id,
    );

    return NextResponse.json({ artifact });
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
