/**
 * Domain: Trader UX / Read Models (Layer C)
 *
 * Owns the trader schema: baskets, basket_positions, opportunity_feed,
 * opportunity_scores, opportunity_runs, basket_risk_snapshots, agent_briefs,
 * position_actions, user_events.
 *
 * These are product-facing objects and UX projections.
 * They can be rebuilt from canonical sources.
 *
 * Target owner: App + read-model refresh jobs
 * Current: This is also where scoring results land (interim — should flow
 *          through advisor layer in Phase 4+)
 */

import { getAdminClient } from '@/server/db';
import { getLatestQuotes } from '@/server/domains/market';
import { autoWeight } from '@/lib/scoring/weighting';
import { computeBasketAnalytics } from '@/lib/analytics/basket';
import { loadConfig } from '@/lib/config/runtime';
import type { BasketPosition, BasketAnalytics, PriceHistory, OpportunityScore } from '@/types';

// ─── Basket Resolution ───

interface BasketRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
}

/**
 * Get the user's active basket. Returns null if none exists.
 */
export async function getActiveBasket(userId: string): Promise<BasketRow | null> {
  const db = getAdminClient();
  const { data, error } = await db
    .schema('trader')
    .from('baskets')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;
  return data as BasketRow;
}

/**
 * Get or create the user's active basket.
 */
export async function getOrCreateActiveBasket(userId: string): Promise<BasketRow> {
  const existing = await getActiveBasket(userId);
  if (existing) return existing;

  const db = getAdminClient();
  const { data, error } = await db
    .schema('trader')
    .from('baskets')
    .insert({ user_id: userId, status: 'active', created_at: new Date().toISOString() })
    .select('*')
    .single();

  if (error || !data) throw new Error(`Failed to create basket: ${error?.message}`);
  return data as BasketRow;
}

// ─── Position Management ───

/**
 * Get raw positions for a basket (without P&L enrichment).
 */
async function getRawPositions(basketId: string) {
  const db = getAdminClient();
  const { data, error } = await db
    .schema('trader')
    .from('basket_positions')
    .select('*')
    .eq('basket_id', basketId);

  if (error) throw new Error(`Failed to fetch positions: ${error.message}`);
  return data ?? [];
}

/**
 * Enrich raw positions with current prices and P&L.
 * This is the canonical way to get basket positions for display.
 */
export async function getEnrichedPositions(basketId: string): Promise<BasketPosition[]> {
  const rawPositions = await getRawPositions(basketId);
  if (rawPositions.length === 0) return [];

  const tickers = rawPositions.map((p: { ticker: string }) => p.ticker);
  const quotes = await getLatestQuotes(tickers);

  return rawPositions.map((p: Record<string, unknown>) => {
    const quote = quotes.get(p.ticker as string);
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
}

/**
 * Get a user's full basket state: basket + enriched positions.
 */
export async function getUserBasket(userId: string): Promise<{
  basket: BasketRow | null;
  positions: BasketPosition[];
}> {
  const basket = await getActiveBasket(userId);
  if (!basket) return { basket: null, positions: [] };

  const positions = await getEnrichedPositions(basket.id);
  return { basket, positions };
}

/**
 * Add a position to a user's basket and auto-reweight.
 */
export async function addPositionToBasket(
  userId: string,
  params: {
    ticker: string;
    asset_name?: string;
    asset_type?: string;
    opportunity_score?: number;
    risk_label?: string;
    setup_type?: string;
    entry_price?: number;
    quantity?: number;
  }
): Promise<BasketPosition[]> {
  const db = getAdminClient();
  const basket = await getOrCreateActiveBasket(userId);

  // Look up asset info if not provided
  let assetName = params.asset_name;
  let assetType = params.asset_type;
  if (!assetName || !assetType) {
    const { data: asset } = await db.from('assets').select('*').eq('ticker', params.ticker).single();
    if (asset) {
      assetName = assetName ?? asset.name;
      assetType = assetType ?? asset.asset_type;
    }
  }

  // Look up opportunity info if not provided
  let oppScore = params.opportunity_score ?? 0;
  let riskLabel = params.risk_label ?? 'Medium';
  let setupType = params.setup_type ?? 'Unknown';
  if (!params.opportunity_score) {
    const { data: opp } = await db.schema('trader').from('opportunity_feed').select('*').eq('ticker', params.ticker).single();
    if (opp) {
      oppScore = opp.opportunity_score as number;
      riskLabel = opp.risk_label as string;
      setupType = opp.setup_type as string;
    }
  }

  // Get entry price from quote if not provided
  let entryPrice = params.entry_price ?? 0;
  if (!entryPrice) {
    const { data: quote } = await db.from('market_quotes').select('last_price').eq('ticker', params.ticker).order('date', { ascending: false }).limit(1).single();
    entryPrice = (quote?.last_price as number) ?? 0;
  }

  // Upsert position
  const { error: upsertError } = await db
    .schema('trader')
    .from('basket_positions')
    .upsert({
      basket_id: basket.id,
      ticker: params.ticker,
      asset_name: assetName ?? params.ticker,
      asset_type: assetType ?? 'stock',
      entry_price: entryPrice,
      quantity: params.quantity ?? 1,
      target_weight: 0,
      manual_weight: null,
      opportunity_score: oppScore,
      risk_label: riskLabel,
      setup_type: setupType,
      added_at: new Date().toISOString(),
    }, { onConflict: 'basket_id,ticker' });

  if (upsertError) throw new Error(`Failed to add position: ${upsertError.message}`);

  return reweightAndReturn(basket.id);
}

/**
 * Remove a position from the basket and reweight remaining.
 */
export async function removePositionFromBasket(userId: string, ticker: string): Promise<BasketPosition[]> {
  const db = getAdminClient();
  const basket = await getActiveBasket(userId);
  if (!basket) throw new Error('No active basket found');

  const { error } = await db
    .schema('trader')
    .from('basket_positions')
    .delete()
    .eq('basket_id', basket.id)
    .eq('ticker', ticker);

  if (error) throw new Error(`Failed to remove position: ${error.message}`);

  return reweightAndReturn(basket.id);
}

/**
 * Update the manual weight for a position and reweight.
 */
export async function updatePositionWeight(userId: string, ticker: string, manualWeight: number | null): Promise<BasketPosition[]> {
  const db = getAdminClient();
  const basket = await getActiveBasket(userId);
  if (!basket) throw new Error('No active basket found');

  const { error } = await db
    .schema('trader')
    .from('basket_positions')
    .update({ manual_weight: manualWeight })
    .eq('basket_id', basket.id)
    .eq('ticker', ticker);

  if (error) throw new Error(`Failed to update weight: ${error.message}`);

  return reweightAndReturn(basket.id);
}

/**
 * Internal: reweight all positions in a basket and persist updated weights.
 */
async function reweightAndReturn(basketId: string): Promise<BasketPosition[]> {
  const db = getAdminClient();
  const config = await loadConfig(db);
  const positions = await getEnrichedPositions(basketId);

  if (positions.length === 0) return [];

  const weighted = autoWeight(positions, config);

  // Persist updated weights
  for (const pos of weighted) {
    await db
      .schema('trader')
      .from('basket_positions')
      .update({ target_weight: pos.target_weight })
      .eq('basket_id', basketId)
      .eq('ticker', pos.ticker);
  }

  return weighted;
}

// ─── Basket Analytics ───

/**
 * Compute basket analytics and store a snapshot.
 */
export async function computeAndSnapshotAnalytics(userId: string): Promise<BasketAnalytics | null> {
  const db = getAdminClient();
  const { basket, positions } = await getUserBasket(userId);
  if (!basket || positions.length === 0) return null;

  const config = await loadConfig(db);

  // Fetch price history for held tickers
  const tickers = positions.map((p) => p.ticker);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

  const { data: priceData } = await db
    .from('price_history')
    .select('*')
    .in('ticker', tickers)
    .gte('date', sinceDate);

  const analytics = computeBasketAnalytics(
    positions,
    (priceData ?? []) as PriceHistory[],
    config
  );

  // Store snapshot
  await db.schema('trader').from('basket_risk_snapshots').insert({
    basket_id: basket.id,
    user_id: userId,
    snapshot: analytics,
    created_at: new Date().toISOString(),
  });

  return analytics;
}

// ─── Opportunity Feed ───

/**
 * Get the curated opportunity feed (top-N from latest scan).
 */
export async function getOpportunityFeed(): Promise<OpportunityScore[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .schema('trader')
    .from('opportunity_feed')
    .select('*')
    .order('opportunity_score', { ascending: false });

  if (error) throw new Error(`Failed to fetch opportunity feed: ${error.message}`);
  return (data ?? []) as OpportunityScore[];
}

/**
 * Get a single opportunity from the feed by ticker.
 */
export async function getOpportunityByTicker(ticker: string): Promise<OpportunityScore | null> {
  const db = getAdminClient();
  const { data, error } = await db
    .schema('trader')
    .from('opportunity_feed')
    .select('*')
    .eq('ticker', ticker)
    .single();

  if (error || !data) return null;
  return data as OpportunityScore;
}

/**
 * Get the feed tickers set (for filtering).
 */
export async function getFeedTickers(): Promise<Set<string>> {
  const db = getAdminClient();
  const { data } = await db.schema('trader').from('opportunity_feed').select('ticker');
  return new Set((data ?? []).map((f: { ticker: string }) => f.ticker));
}

/**
 * Get all scores from the latest scanner run.
 */
export async function getLatestRunScores(): Promise<{ runId: string | null; scores: OpportunityScore[] }> {
  const db = getAdminClient();

  const { data: latestRun } = await db
    .schema('trader')
    .from('opportunity_runs')
    .select('id')
    .order('ran_at', { ascending: false })
    .limit(1)
    .single();

  if (!latestRun) return { runId: null, scores: [] };

  const { data: scores } = await db
    .schema('trader')
    .from('opportunity_scores')
    .select('*')
    .eq('run_id', latestRun.id)
    .order('opportunity_score', { ascending: false });

  return { runId: latestRun.id, scores: (scores ?? []) as OpportunityScore[] };
}

// ─── Scanner Run Metadata ───

/**
 * Get the latest scanner run metadata (for provenance display).
 */
export async function getLatestRunMetadata(): Promise<{
  id: string;
  ran_at: string;
  total_scored: number;
  scoring_version?: string;
  data_freshness?: Record<string, unknown>;
} | null> {
  const db = getAdminClient();
  const { data } = await db
    .schema('trader')
    .from('opportunity_runs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(1)
    .single();

  return data as typeof data & { scoring_version?: string; data_freshness?: Record<string, unknown> } | null;
}

/**
 * Get persisted position actions for a basket (from last recommendation run).
 */
export async function getPersistedActions(basketId: string) {
  const db = getAdminClient();
  const { data } = await db
    .schema('trader')
    .from('position_actions')
    .select('*')
    .eq('basket_id', basketId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

// ─── Briefs ───

/**
 * Get the latest daily brief for a user.
 */
export async function getLatestBrief(userId: string) {
  const db = getAdminClient();
  const { data, error } = await db
    .schema('trader')
    .from('agent_briefs')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_name', 'Paul')
    .eq('brief_type', 'daily')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Store a generated brief.
 */
export async function storeBrief(userId: string, content: string, agentName: string = 'Paul') {
  const db = getAdminClient();
  const { data, error } = await db
    .schema('trader')
    .from('agent_briefs')
    .insert({
      user_id: userId,
      agent_name: agentName,
      content,
      brief_type: 'daily',
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to store brief: ${error.message}`);
  return data;
}
