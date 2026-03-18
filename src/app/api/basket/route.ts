import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadConfig } from '@/lib/config/runtime';
import { autoWeight } from '@/lib/scoring/weighting';
import type { BasketPosition } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Find active basket
    const { data: basket, error: basketError } = await admin
      .schema('trader')
      .from('baskets')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (basketError || !basket) {
      return NextResponse.json({ basket: null, positions: [] });
    }

    // Fetch positions
    const { data: positions, error: posError } = await admin
      .schema('trader')
      .from('basket_positions')
      .select('*')
      .eq('basket_id', basket.id);

    if (posError) {
      return NextResponse.json(
        { error: 'Failed to fetch positions', details: posError.message },
        { status: 500 }
      );
    }

    if (!positions || positions.length === 0) {
      return NextResponse.json({ basket, positions: [] });
    }

    // Join with latest market_quotes for current prices and compute P&L
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

    return NextResponse.json({ basket, positions: enrichedPositions });
  } catch (error) {
    console.error('Failed to fetch basket:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ticker } = body;

    if (!ticker) {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const config = await loadConfig(admin);

    // Get or create active basket
    let { data: basket } = await admin
      .schema('trader')
      .from('baskets')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!basket) {
      const { data: newBasket, error: createError } = await admin
        .schema('trader')
        .from('baskets')
        .insert({ user_id: user.id, status: 'active', created_at: new Date().toISOString() })
        .select('*')
        .single();

      if (createError || !newBasket) {
        return NextResponse.json(
          { error: 'Failed to create basket', details: createError?.message },
          { status: 500 }
        );
      }
      basket = newBasket;
    }

    // Look up asset and opportunity info
    const { data: asset } = await admin
      .from('assets')
      .select('*')
      .eq('ticker', ticker)
      .single();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const { data: opportunity } = await admin
      .schema('trader')
      .from('opportunity_feed')
      .select('*')
      .eq('ticker', ticker)
      .single();

    // Get current quote for entry price
    const { data: quote } = await admin
      .from('market_quotes')
      .select('*')
      .eq('ticker', ticker)
      .single();

    const entryPrice = body.entry_price ?? quote?.last_price ?? 0;

    // Upsert position
    const { error: upsertError } = await admin
      .schema('trader')
      .from('basket_positions')
      .upsert(
        {
          basket_id: basket.id,
          ticker,
          asset_name: asset.name,
          asset_type: asset.asset_type,
          entry_price: entryPrice,
          quantity: body.quantity ?? 1,
          target_weight: 0,
          manual_weight: null,
          opportunity_score: opportunity?.opportunity_score ?? 0,
          risk_label: opportunity?.risk_label ?? 'Medium',
          setup_type: opportunity?.setup_type ?? 'Unknown',
          added_at: new Date().toISOString(),
        },
        { onConflict: 'basket_id,ticker' }
      );

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to add position', details: upsertError.message },
        { status: 500 }
      );
    }

    // Fetch all positions, auto-weight, and update
    const updatedPositions = await fetchAndReweight(admin, basket.id, config);

    return NextResponse.json({ positions: updatedPositions });
  } catch (error) {
    console.error('Failed to add to basket:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json({ error: 'ticker query param is required' }, { status: 400 });
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

    // Remove position
    const { error: deleteError } = await admin
      .schema('trader')
      .from('basket_positions')
      .delete()
      .eq('basket_id', basket.id)
      .eq('ticker', ticker);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to remove position', details: deleteError.message },
        { status: 500 }
      );
    }

    // Re-weight remaining positions
    const updatedPositions = await fetchAndReweight(admin, basket.id, config);

    return NextResponse.json({ positions: updatedPositions });
  } catch (error) {
    console.error('Failed to remove from basket:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: fetch all positions for a basket, run auto-weight, and persist updated weights.
 */
async function fetchAndReweight(
  admin: ReturnType<typeof createAdminClient>,
  basketId: string,
  config: Record<string, string | number | boolean>
): Promise<BasketPosition[]> {
  const { data: positions } = await admin
    .schema('trader')
    .from('basket_positions')
    .select('*')
    .eq('basket_id', basketId);

  if (!positions || positions.length === 0) return [];

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

  // Auto-weight
  const weighted = autoWeight(enrichedPositions, config);

  // Persist updated weights
  for (const pos of weighted) {
    await admin
      .schema('trader')
      .from('basket_positions')
      .update({ target_weight: pos.target_weight })
      .eq('basket_id', basketId)
      .eq('ticker', pos.ticker);
  }

  return weighted;
}
