/**
 * Domain: Advisor Engine (Layer B)
 *
 * This layer owns the deterministic decision-support logic:
 * - Opportunity scanning with provenance
 * - Feed projection from canonical scores
 * - Recommendation generation with durable lineage
 * - Position action computation and persistence
 *
 * Architecture notes:
 * - Canonical scores currently live in trader.opportunity_scores (interim).
 *   Target: public.agent_scores once the pipeline layer exists.
 * - Recommendations live in trader.recommendation_runs/items (interim).
 *   Target: advisor schema once it exists as a separate Postgres schema.
 * - The feed (trader.opportunity_feed) is explicitly a projection —
 *   it can be rebuilt from the canonical scores at any time.
 *
 * FUTURE (Phase 6+):
 * - Create advisor schema with its own recommendation/outcome tables
 * - Move canonical scores to public.agent_scores
 * - Add outcome tracking and calibration
 * - Add user decision persistence
 */

import { getAdminClient } from '@/server/db';
import { getNonEtfAssets, getPriceHistory, getLatestQuotes, getFundamentals } from '@/server/domains/market';
import { computeOpportunityScores } from '@/lib/scoring/engine';
import { computePositionActions, type PositionSignal } from '@/lib/scoring/actions';
import { computeBasketAnalytics } from '@/lib/analytics/basket';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import type { OpportunityScore, BasketPosition, PriceHistory } from '@/types';

// ─── Constants ───

const SCORING_VERSION = '1.0';

// ─── Scanner: Canonical Score Generation ───

export interface ScannerResult {
  runId: string;
  totalScored: number;
  surfaced: number;
  scoringVersion: string;
  dataFreshness: {
    priceHistoryTo: string;
    quotesCount: number;
    fundamentalsCount: number;
    assetsScanned: number;
  };
}

/**
 * Run the opportunity scanner with full provenance tracking.
 *
 * Flow:
 * 1. Gather canonical market data (Layer A reads)
 * 2. Run deterministic scoring engine (pure computation)
 * 3. Persist canonical scores with provenance (trader.opportunity_scores)
 * 4. Project top-N into feed read model (trader.opportunity_feed)
 *
 * The scoring engine is deterministic: same inputs → same outputs.
 * Provenance (config hash, data freshness, scoring version) makes
 * every run reproducible and inspectable.
 */
export async function runScanner(): Promise<ScannerResult> {
  const db = getAdminClient();
  const config = await loadConfig(db);
  const maxFeedSize = getConfigValue<number>(config, 'scanner.max_feed_size');
  const minScoreThreshold = getConfigValue<number>(config, 'scanner.min_score_threshold');

  // ── Step 1: Gather market data (Layer A) ──
  const assets = await getNonEtfAssets();
  const tickers = assets.map((a) => a.ticker);

  // Use allSettled so a single source failure doesn't crash the entire scan
  const [priceResult, quotesResult, fundResult] = await Promise.allSettled([
    getPriceHistory(tickers, 60),
    getLatestQuotes(tickers),
    getFundamentals(tickers),
  ]);

  const priceHistory = priceResult.status === 'fulfilled' ? priceResult.value : [];
  const quotesMap = quotesResult.status === 'fulfilled' ? quotesResult.value : new Map();
  const fundamentals = fundResult.status === 'fulfilled' ? fundResult.value : [];
  const quotes = Array.from(quotesMap.values());

  if (priceResult.status === 'rejected') {
    console.error('Scanner: price history fetch failed, scoring with empty history');
  }

  // Build provenance metadata
  const latestPriceDate = priceHistory.length > 0
    ? priceHistory.reduce((max, p) => p.date > max ? p.date : max, priceHistory[0].date)
    : null;

  const configHash = hashConfig(config);
  const dataFreshness = {
    priceHistoryTo: latestPriceDate ?? 'none',
    quotesCount: quotes.length,
    fundamentalsCount: fundamentals.length,
    assetsScanned: assets.length,
  };

  // ── Step 2: Run deterministic scoring engine ──
  const scores: OpportunityScore[] = computeOpportunityScores(
    assets, priceHistory, quotes, fundamentals, config
  );

  const now = new Date().toISOString();

  // ── Step 3: Persist canonical scores with provenance ──
  const { data: runData, error: runError } = await db
    .schema('trader')
    .from('opportunity_runs')
    .insert({
      ran_at: now,
      total_scored: scores.length,
      config_hash: configHash,
      scoring_version: SCORING_VERSION,
      data_freshness: dataFreshness,
      completed_at: now,
    })
    .select('id')
    .single();

  if (runError || !runData) throw new Error(`Failed to create run: ${runError?.message}`);
  const runId = runData.id as string;

  if (scores.length > 0) {
    const scoreRows = scores.map((s) => ({
      run_id: runId,
      ticker: s.ticker,
      asset_name: s.asset_name,
      asset_type: s.asset_type,
      sector: s.sector,
      opportunity_score: s.opportunity_score,
      momentum_score: s.momentum_score,
      breakout_score: s.breakout_score,
      mean_reversion_score: s.mean_reversion_score,
      catalyst_score: s.catalyst_score,
      sentiment_score: s.sentiment_score,
      volatility_score: s.volatility_score,
      regime_fit_score: s.regime_fit_score,
      opportunity_label: s.opportunity_label,
      risk_label: s.risk_label,
      setup_type: s.setup_type,
      explanation: s.explanation,
      agent_tag: s.agent_tag,
      scored_at: s.scored_at,
      horizon_days: s.horizon_days,
      scoring_version: SCORING_VERSION,
    }));

    const { error: insertError } = await db
      .schema('trader')
      .from('opportunity_scores')
      .insert(scoreRows);

    if (insertError) throw new Error(`Failed to store scores: ${insertError.message}`);
  }

  // ── Step 4: Project top-N into feed read model ──
  const surfaced = await refreshFeedProjection(runId, scores, maxFeedSize, minScoreThreshold);

  return {
    runId,
    totalScored: scores.length,
    surfaced,
    scoringVersion: SCORING_VERSION,
    dataFreshness,
  };
}

/**
 * Refresh the opportunity feed as a projection from canonical scores.
 * This is explicitly a read-model refresh — it can be called independently
 * of the scanner to rebuild the feed from existing scores.
 */
async function refreshFeedProjection(
  runId: string,
  scores: OpportunityScore[],
  maxFeedSize: number,
  minScoreThreshold: number
): Promise<number> {
  const db = getAdminClient();

  const feedCandidates = scores
    .filter((s) => s.opportunity_score >= minScoreThreshold)
    .slice(0, maxFeedSize);

  if (feedCandidates.length === 0) return 0;

  const now = new Date().toISOString();
  const feedRows = feedCandidates.map((s) => ({
    ticker: s.ticker,
    asset_name: s.asset_name,
    asset_type: s.asset_type,
    sector: s.sector,
    opportunity_score: s.opportunity_score,
    momentum_score: s.momentum_score,
    breakout_score: s.breakout_score,
    mean_reversion_score: s.mean_reversion_score,
    catalyst_score: s.catalyst_score,
    sentiment_score: s.sentiment_score,
    volatility_score: s.volatility_score,
    regime_fit_score: s.regime_fit_score,
    opportunity_label: s.opportunity_label,
    risk_label: s.risk_label,
    setup_type: s.setup_type,
    explanation: s.explanation,
    agent_tag: s.agent_tag,
    scored_at: s.scored_at,
    horizon_days: s.horizon_days,
    run_id: runId,
    last_run_at: now,
    scoring_version: SCORING_VERSION,
  }));

  const { error } = await db
    .schema('trader')
    .from('opportunity_feed')
    .upsert(feedRows, { onConflict: 'ticker' });

  if (error) throw new Error(`Failed to upsert feed: ${error.message}`);

  return feedCandidates.length;
}

// ─── Recommendation Engine ───

export interface RecommendationResult {
  runId: string;
  basketQuality: string;
  probabilityScore: number;
  actions: PositionSignal[];
  totalActions: number;
  urgentActions: number;
}

/**
 * Generate recommendations for a user's basket.
 *
 * This is the deterministic recommendation layer — no LLM needed.
 * It reads the user's basket state, computes risk analytics, derives
 * position actions, and persists everything with full lineage.
 *
 * Flow:
 * 1. Load basket positions (enriched with current prices)
 * 2. Compute basket analytics (risk, concentration, quality)
 * 3. Compute position actions (Rex's signals)
 * 4. Persist recommendation run + items with lineage
 * 5. Persist position actions for UI consumption
 * 6. Store analytics snapshot
 *
 * Later, the agent layer can explain these recommendations
 * without needing to recompute them.
 */
export async function generateRecommendations(userId: string): Promise<RecommendationResult | null> {
  const db = getAdminClient();

  // Load basket state
  const { data: basket } = await db
    .schema('trader')
    .from('baskets')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!basket) return null;

  // Load enriched positions (with current prices and P&L)
  const { data: rawPositions } = await db
    .schema('trader')
    .from('basket_positions')
    .select('*')
    .eq('basket_id', basket.id);

  if (!rawPositions || rawPositions.length === 0) return null;

  // Get latest quotes for P&L
  const tickers = rawPositions.map((p: { ticker: string }) => p.ticker);
  const quotesMap = await getLatestQuotes(tickers);

  const positions: BasketPosition[] = rawPositions.map((p: Record<string, unknown>) => {
    const quote = quotesMap.get(p.ticker as string);
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

  // Compute basket analytics
  const config = await loadConfig(db);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: priceData } = await db
    .from('price_history')
    .select('*')
    .in('ticker', tickers)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

  const analytics = computeBasketAnalytics(
    positions,
    (priceData ?? []) as PriceHistory[],
    config
  );

  // Compute position actions (Rex's deterministic signals)
  const actions = computePositionActions(positions);

  // Get latest scanner run for lineage
  const { data: latestRun } = await db
    .schema('trader')
    .from('opportunity_runs')
    .select('id')
    .order('ran_at', { ascending: false })
    .limit(1)
    .single();

  // ── Persist recommendation run ──
  const { data: recRun, error: recRunError } = await db
    .schema('trader')
    .from('recommendation_runs')
    .insert({
      user_id: userId,
      basket_id: basket.id,
      source_run_id: latestRun?.id ?? null,
      total_positions: positions.length,
      total_actions: actions.filter((a) => a.action !== 'Hold').length,
      basket_quality: analytics.basket_quality,
      probability_score: analytics.probability_score,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (recRunError) {
    // Table may not exist yet — degrade gracefully
    console.error('Recommendation run insert failed (table may not exist):', recRunError.message);
  }

  const recRunId = recRun?.id as string | undefined;

  // ── Persist recommendation items ──
  if (recRunId && actions.length > 0) {
    const itemRows = actions.map((a) => {
      const pos = positions.find((p) => p.ticker === a.ticker);
      return {
        run_id: recRunId,
        basket_id: basket.id,
        ticker: a.ticker,
        action: a.action,
        urgency: a.urgency,
        reason: a.reason,
        opportunity_score: pos?.opportunity_score ?? 0,
        pnl_pct: pos?.pnl_pct ?? 0,
        position_weight: pos?.manual_weight ?? pos?.target_weight ?? 0,
        risk_label: pos?.risk_label ?? 'Medium',
      };
    });

    const { error: itemsError } = await db
      .schema('trader')
      .from('recommendation_items')
      .insert(itemRows);

    if (itemsError) {
      console.error('Recommendation items insert failed (table may not exist):', itemsError.message);
    }
  }

  // ── Persist position actions for UI ──
  if (actions.length > 0) {
    // Clear old actions for this basket
    await db.schema('trader').from('position_actions')
      .delete().eq('basket_id', basket.id);

    const actionRows = actions.map((a) => {
      const pos = positions.find((p) => p.ticker === a.ticker);
      return {
        basket_id: basket.id,
        ticker: a.ticker,
        action_type: a.action.toLowerCase().replace(' ', '_'),
        reason: a.reason,
        agent_name: 'Rex',
        recommendation_run_id: recRunId ?? null,
        opportunity_score: pos?.opportunity_score ?? 0,
        pnl_pct: pos?.pnl_pct ?? 0,
        urgency: a.urgency,
        created_at: new Date().toISOString(),
      };
    });

    const { error: actionsError } = await db
      .schema('trader')
      .from('position_actions')
      .insert(actionRows);

    if (actionsError) {
      console.error('Position actions insert failed:', actionsError.message);
    }
  }

  // ── Store analytics snapshot with lineage ──
  await db.schema('trader').from('basket_risk_snapshots').insert({
    basket_id: basket.id,
    user_id: userId,
    snapshot: {
      ...analytics,
      recommendation_run_id: recRunId ?? null,
      source_run_id: latestRun?.id ?? null,
    },
    created_at: new Date().toISOString(),
  });

  return {
    runId: recRunId ?? 'none',
    basketQuality: analytics.basket_quality,
    probabilityScore: analytics.probability_score,
    actions,
    totalActions: actions.filter((a) => a.action !== 'Hold').length,
    urgentActions: actions.filter((a) => a.urgency === 'high').length,
  };
}

// ─── Helpers ───

function hashConfig(config: Record<string, unknown>): string {
  // Simple hash of scoring-relevant config for provenance
  const scoringKeys = [
    'scoring.momentum_weight', 'scoring.breakout_weight',
    'scoring.mean_reversion_weight', 'scoring.catalyst_weight',
    'scoring.sentiment_weight', 'scoring.volatility_weight',
    'scoring.regime_fit_weight', 'scanner.min_score_threshold',
    'scanner.max_feed_size',
  ];
  const relevant = scoringKeys.map((k) => `${k}=${config[k] ?? 'default'}`).join('|');
  // Simple string hash
  let hash = 0;
  for (let i = 0; i < relevant.length; i++) {
    const char = relevant.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `v${SCORING_VERSION}_${Math.abs(hash).toString(36)}`;
}
