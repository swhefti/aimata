/**
 * Domain: Advisor Engine (Layer B) — INTERIM ADAPTER
 *
 * In the target architecture, this layer owns:
 * - user profiles and preferences
 * - portfolios and positions
 * - recommendation runs and items
 * - user decisions
 * - calibration and outcomes
 *
 * Current state: The `advisor` schema does not exist yet.
 * This module wraps the scoring engine and writes results to the `trader`
 * schema as an interim measure. When Phase 4+ is implemented:
 * - Create `advisor` schema with canonical recommendation tables
 * - Scoring writes to `public.agent_scores` (canonical)
 * - Opportunity feed becomes a projection from advisor output
 * - This adapter gets replaced with the real advisor engine
 *
 * Phase 4+ migration notes are marked with "FUTURE:" comments.
 */

import { getAdminClient } from '@/server/db';
import { getNonEtfAssets, getPriceHistory, getLatestQuotes, getFundamentals } from '@/server/domains/market';
import { computeOpportunityScores } from '@/lib/scoring/engine';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import type { OpportunityScore } from '@/types';

/**
 * Run the opportunity scanner: score all assets and update the feed.
 *
 * FUTURE: This should write to public.agent_scores (canonical specialist scores)
 * and advisor.recommendation_runs. The trader.opportunity_feed should be a
 * downstream projection refreshed after the canonical write.
 *
 * Current: Writes directly to trader.opportunity_scores and trader.opportunity_feed.
 */
export async function runScanner(): Promise<{
  runId: string;
  totalScored: number;
  surfaced: number;
}> {
  const db = getAdminClient();
  const config = await loadConfig(db);
  const maxFeedSize = getConfigValue<number>(config, 'scanner.max_feed_size');
  const minScoreThreshold = getConfigValue<number>(config, 'scanner.min_score_threshold');

  // Gather market data (Layer A reads)
  const assets = await getNonEtfAssets();
  const tickers = assets.map((a) => a.ticker);
  const [priceHistory, quotesMap, fundamentals] = await Promise.all([
    getPriceHistory(tickers, 60),
    getLatestQuotes(tickers),
    getFundamentals(tickers),
  ]);
  const quotes = Array.from(quotesMap.values());

  // Run deterministic scoring engine
  const scores: OpportunityScore[] = computeOpportunityScores(
    assets,
    priceHistory,
    quotes,
    fundamentals,
    config
  );

  // FUTURE: Write to public.agent_scores here instead of trader tables
  // FUTURE: Write to advisor.recommendation_runs and advisor.recommendation_items

  // Create opportunity run record (trader schema — interim)
  const { data: runData, error: runError } = await db
    .schema('trader')
    .from('opportunity_runs')
    .insert({ ran_at: new Date().toISOString(), total_scored: scores.length })
    .select('id')
    .single();

  if (runError || !runData) throw new Error(`Failed to create run: ${runError?.message}`);
  const runId = runData.id as string;

  // Store all scores (trader schema — interim)
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
    }));

    const { error: insertError } = await db
      .schema('trader')
      .from('opportunity_scores')
      .insert(scoreRows);

    if (insertError) throw new Error(`Failed to store scores: ${insertError.message}`);
  }

  // Build feed (trader schema — this IS correct per target architecture)
  const feedCandidates = scores
    .filter((s) => s.opportunity_score >= minScoreThreshold)
    .slice(0, maxFeedSize);

  if (feedCandidates.length > 0) {
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
    }));

    const { error: upsertError } = await db
      .schema('trader')
      .from('opportunity_feed')
      .upsert(feedRows, { onConflict: 'ticker' });

    if (upsertError) throw new Error(`Failed to upsert feed: ${upsertError.message}`);
  }

  return {
    runId,
    totalScored: scores.length,
    surfaced: feedCandidates.length,
  };
}
