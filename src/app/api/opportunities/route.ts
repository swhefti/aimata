import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: feed, error } = await supabase
      .schema('trader')
      .from('opportunity_feed')
      .select('*')
      .order('opportunity_score', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch opportunity feed', details: error.message },
        { status: 500 }
      );
    }

    if (!feed || feed.length === 0) {
      return NextResponse.json([]);
    }

    // Enrich with latest quotes
    const tickers = feed.map((f: { ticker: string }) => f.ticker);
    const { data: quotes } = await supabase
      .from('market_quotes')
      .select('ticker, last_price, daily_change, pct_change')
      .in('ticker', tickers)
      .order('date', { ascending: false });

    // Dedupe quotes to latest per ticker
    const quoteMap = new Map<string, { last_price: number; daily_change: number; pct_change: number }>();
    for (const q of quotes ?? []) {
      if (!quoteMap.has(q.ticker)) {
        quoteMap.set(q.ticker, q);
      }
    }

    // Enrich with recent price history for sparklines (last 20 closes)
    const { data: priceData } = await supabase
      .from('price_history')
      .select('ticker, date, close')
      .in('ticker', tickers)
      .order('date', { ascending: false })
      .limit(tickers.length * 20);

    const priceMap = new Map<string, number[]>();
    for (const p of priceData ?? []) {
      const arr = priceMap.get(p.ticker) ?? [];
      if (arr.length < 20) {
        arr.push(p.close);
      }
      priceMap.set(p.ticker, arr);
    }

    const enriched = feed.map((f: Record<string, unknown>) => {
      const quote = quoteMap.get(f.ticker as string);
      const prices = priceMap.get(f.ticker as string)?.reverse() ?? [];
      return {
        ...f,
        last_price: quote?.last_price ?? null,
        daily_change: quote?.daily_change ?? null,
        pct_change: quote?.pct_change ?? null,
        price_history: prices,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Failed to fetch opportunities:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
