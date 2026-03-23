import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as trader from '@/server/domains/trader';

export async function GET() {
  try {
    const user = await requireUser();
    const result = await trader.getUserBasket(user.id);
    return NextResponse.json(result);
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

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    if (!body.ticker) {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }

    const positions = await trader.addPositionToBasket(user.id, body);
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

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json({ error: 'ticker query param is required' }, { status: 400 });
    }

    const positions = await trader.removePositionFromBasket(user.id, ticker);
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
