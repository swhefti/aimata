import { NextResponse } from 'next/server';
import * as trader from '@/server/domains/trader';
import * as market from '@/server/domains/market';
import * as agents from '@/server/domains/agents';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    const opportunity = await trader.getOpportunityByTicker(ticker);
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const [priceHistory, fundamentals, quotesMap] = await Promise.all([
      market.getPriceHistory([ticker], 30),
      market.getFundamentals([ticker]),
      market.getLatestQuotes([ticker]),
    ]);

    const quote = quotesMap.get(ticker) ?? null;

    const commentary = await agents.getTickerCommentary(ticker, {
      scores: opportunity as unknown as Record<string, unknown>,
      priceHistory,
      fundamentals: fundamentals[0] ?? null,
      quote,
    });

    return NextResponse.json({
      opportunity,
      price_history: priceHistory,
      fundamentals: fundamentals[0] ?? null,
      quote,
      commentary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
