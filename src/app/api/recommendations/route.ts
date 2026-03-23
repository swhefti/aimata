import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as advisor from '@/server/domains/advisor';

/**
 * GET: Fetch latest recommendation state for the user's basket.
 * POST: Generate fresh recommendations (deterministic, no LLM).
 */

export async function GET() {
  try {
    const user = await requireUser();
    const result = await advisor.generateRecommendations(user.id);
    if (!result) {
      return NextResponse.json({ recommendations: null, message: 'No active basket' });
    }
    return NextResponse.json({ recommendations: result });
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
    const result = await advisor.generateRecommendations(user.id);
    if (!result) {
      return NextResponse.json({ recommendations: null, message: 'No active basket' });
    }
    return NextResponse.json({ recommendations: result });
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
