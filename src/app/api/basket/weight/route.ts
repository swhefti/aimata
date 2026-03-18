import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadConfig } from '@/lib/config/runtime';
import { autoWeight } from '@/lib/scoring/weighting';
import type { BasketPosition } from '@/types';

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ticker, manual_weight } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }

    if (manual_weight !== null && (typeof manual_weight !== 'number' || manual_weight < 0 || manual_weight > 100)) {
      return NextResponse.json({ error: 'manual_weight must be a number between 0 and 100, or null' }, { status: 400 });
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

    // Update the manual_weight for the specified position
    const { error: updateError } = await admin
      .schema('trader')
      .from('basket_positions')
      .update({ manual_weight })
      .eq('basket_id', basket.id)
      .eq('ticker', ticker);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update weight', details: updateError.message },
        { status: 500 }
      );
    }

    // Fetch all positions, re-weight respecting manual overrides
    const { data: positions } = await admin
      .schema('trader')
      .from('basket_positions')
      .select('*')
      .eq('basket_id', basket.id);

    if (!positions || positions.length === 0) {
      return NextResponse.json({ positions: [] });
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

    // Auto-weight with manual overrides
    const weighted = autoWeight(enrichedPositions, config);

    // Persist updated target weights
    for (const pos of weighted) {
      await admin
        .schema('trader')
        .from('basket_positions')
        .update({ target_weight: pos.target_weight })
        .eq('basket_id', basket.id)
        .eq('ticker', pos.ticker);
    }

    return NextResponse.json({ positions: weighted });
  } catch (error) {
    console.error('Failed to update weight:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
