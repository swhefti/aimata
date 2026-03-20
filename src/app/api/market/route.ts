import { NextResponse } from 'next/server';
import * as trader from '@/server/domains/trader';
import * as market from '@/server/domains/market';

export async function GET() {
  try {
    const { scores } = await trader.getLatestRunScores();
    const feedTickers = await trader.getFeedTickers();
    const enriched = await market.enrichWithQuotesAndSparklines(scores);

    const result = enriched.map((s) => ({
      ...s,
      in_feed: feedTickers.has(s.ticker),
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
