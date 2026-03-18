import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Get the latest run
    const { data: latestRun } = await supabase
      .schema('trader')
      .from('opportunity_runs')
      .select('id')
      .order('ran_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestRun) {
      return NextResponse.json([]);
    }

    // Get all scores from the latest run
    const { data: scores, error } = await supabase
      .schema('trader')
      .from('opportunity_scores')
      .select('*')
      .eq('run_id', latestRun.id)
      .order('opportunity_score', { ascending: false });

    if (error || !scores) {
      return NextResponse.json([]);
    }

    // Get feed tickers (those that made the cut)
    const { data: feedItems } = await supabase
      .schema('trader')
      .from('opportunity_feed')
      .select('ticker');
    const feedTickers = new Set((feedItems ?? []).map((f: { ticker: string }) => f.ticker));

    // Get latest quotes
    const tickers = scores.map((s: { ticker: string }) => s.ticker);
    const { data: quotes } = await supabase
      .from('market_quotes')
      .select('ticker, last_price, daily_change, pct_change')
      .in('ticker', tickers)
      .order('date', { ascending: false })
      .limit(500);

    const quoteMap = new Map<string, { last_price: number; daily_change: number; pct_change: number }>();
    for (const q of quotes ?? []) {
      if (!quoteMap.has(q.ticker)) quoteMap.set(q.ticker, q);
    }

    // Get price history for sparklines
    const { data: priceData } = await supabase
      .from('price_history')
      .select('ticker, close')
      .in('ticker', tickers)
      .order('date', { ascending: false })
      .limit(tickers.length * 20);

    const priceMap = new Map<string, number[]>();
    for (const p of priceData ?? []) {
      const arr = priceMap.get(p.ticker) ?? [];
      if (arr.length < 20) arr.push(p.close);
      priceMap.set(p.ticker, arr);
    }

    // Enrich
    const enriched = scores.map((s: Record<string, unknown>) => {
      const quote = quoteMap.get(s.ticker as string);
      const prices = priceMap.get(s.ticker as string)?.reverse() ?? [];
      return {
        ...s,
        last_price: quote?.last_price ?? null,
        daily_change: quote?.daily_change ?? null,
        pct_change: quote?.pct_change ?? null,
        price_history: prices,
        in_feed: feedTickers.has(s.ticker as string),
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Market data error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
