import { NextResponse } from 'next/server';
import * as trader from '@/server/domains/trader';
import * as market from '@/server/domains/market';

export async function GET() {
  try {
    const feed = await trader.getOpportunityFeed();
    const enriched = await market.enrichWithQuotesAndSparklines(feed);
    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
