import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadConfig } from '@/lib/config/runtime';
import { computeBasketAnalytics } from '@/lib/analytics/basket';
import type { BasketPosition, PriceHistory } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const config = await loadConfig(admin);

    // Find active basket
    const { data: basket } = await admin
      .schema('trader')
      .from('baskets')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!basket) {
      return NextResponse.json({ error: 'No active basket found' }, { status: 404 });
    }

    // Fetch positions
    const { data: positions } = await admin
      .schema('trader')
      .from('basket_positions')
      .select('*')
      .eq('basket_id', basket.id);

    if (!positions || positions.length === 0) {
      const emptyAnalytics = computeBasketAnalytics([], [], config);
      return NextResponse.json(emptyAnalytics);
    }

    // Get current quotes for P&L
    const tickers = positions.map((p: { ticker: string }) => p.ticker);
    const { data: quotes } = await admin
      .from('market_quotes')
      .select('*')
      .in('ticker', tickers);

    const quoteMap = new Map(
      (quotes ?? []).map((q: { ticker: string; last_price: number }) => [q.ticker, q])
    );

    const enrichedPositions: BasketPosition[] = positions.map((p: Record<string, unknown>) => {
      const quote = quoteMap.get(p.ticker as string) as { last_price: number } | undefined;
      const currentPrice = quote?.last_price ?? (p.entry_price as number);
      const entryPrice = p.entry_price as number;
      const quantity = p.quantity as number;
      const pnl = (currentPrice - entryPrice) * quantity;
      const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

      return {
        ticker: p.ticker as string,
        asset_name: p.asset_name as string,
        asset_type: p.asset_type as 'stock' | 'crypto',
        target_weight: p.target_weight as number,
        manual_weight: p.manual_weight as number | null,
        entry_price: entryPrice,
        quantity,
        current_price: currentPrice,
        pnl: Number(pnl.toFixed(2)),
        pnl_pct: Number(pnlPct.toFixed(2)),
        opportunity_score: p.opportunity_score as number,
        risk_label: p.risk_label as BasketPosition['risk_label'],
        setup_type: p.setup_type as string,
        added_at: p.added_at as string,
      };
    });

    // Fetch price_history for held tickers
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: priceHistory } = await admin
      .from('price_history')
      .select('*')
      .in('ticker', tickers)
      .gte('date', sinceDate);

    // Compute analytics
    const analytics = computeBasketAnalytics(
      enrichedPositions,
      (priceHistory ?? []) as PriceHistory[],
      config
    );

    // Store snapshot in trader.basket_risk_snapshots
    await admin
      .schema('trader')
      .from('basket_risk_snapshots')
      .insert({
        basket_id: basket.id,
        user_id: user.id,
        snapshot: analytics,
        created_at: new Date().toISOString(),
      });

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Failed to compute basket analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
