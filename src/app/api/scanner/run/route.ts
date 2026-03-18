import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import { computeOpportunityScores } from '@/lib/scoring/engine';
import type { Asset, PriceHistory, MarketQuote, FundamentalData } from '@/types';

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Load runtime config
    const config = await loadConfig(supabase);
    const maxFeedSize = getConfigValue<number>(config, 'scanner.max_feed_size');
    const minScoreThreshold = getConfigValue<number>(config, 'scanner.min_score_threshold');

    // Fetch all non-ETF active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('*')
      .in('asset_type', ['stock', 'crypto'])
      .eq('active', true);

    if (assetsError) {
      return NextResponse.json({ error: 'Failed to fetch assets', details: assetsError.message }, { status: 500 });
    }

    // Fetch price_history (last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sinceDate = sixtyDaysAgo.toISOString().split('T')[0];

    const { data: priceHistory, error: priceError } = await supabase
      .from('price_history')
      .select('*')
      .gte('date', sinceDate)
      .limit(10000);

    if (priceError) {
      return NextResponse.json({ error: 'Failed to fetch price history', details: priceError.message }, { status: 500 });
    }

    // Fetch latest market_quotes
    const { data: quotes, error: quotesError } = await supabase
      .from('market_quotes')
      .select('*')
      .order('date', { ascending: false })
      .limit(500);

    if (quotesError) {
      return NextResponse.json({ error: 'Failed to fetch market quotes', details: quotesError.message }, { status: 500 });
    }

    // Fetch fundamental_data
    const { data: fundamentals, error: fundError } = await supabase
      .from('fundamental_data')
      .select('*');

    if (fundError) {
      return NextResponse.json({ error: 'Failed to fetch fundamentals', details: fundError.message }, { status: 500 });
    }

    // Run scoring engine
    const scores = computeOpportunityScores(
      (assets ?? []) as Asset[],
      (priceHistory ?? []) as PriceHistory[],
      (quotes ?? []) as MarketQuote[],
      (fundamentals ?? []) as FundamentalData[],
      config
    );

    // Create a new opportunity_run
    const { data: runData, error: runError } = await supabase
      .schema('trader')
      .from('opportunity_runs')
      .insert({ ran_at: new Date().toISOString(), total_scored: scores.length })
      .select('id')
      .single();

    if (runError) {
      return NextResponse.json({ error: 'Failed to create opportunity run', details: runError.message }, { status: 500 });
    }

    const runId = runData.id;

    // Store all scores in trader.opportunity_scores
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

      const { error: insertError } = await supabase
        .schema('trader')
        .from('opportunity_scores')
        .insert(scoreRows);

      if (insertError) {
        return NextResponse.json({ error: 'Failed to store scores', details: insertError.message }, { status: 500 });
      }
    }

    // Filter by minimum threshold and take top N for the feed
    const feedCandidates = scores
      .filter((s) => s.opportunity_score >= minScoreThreshold)
      .slice(0, maxFeedSize);

    // Upsert into trader.opportunity_feed
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

      const { error: upsertError } = await supabase
        .schema('trader')
        .from('opportunity_feed')
        .upsert(feedRows, { onConflict: 'ticker' });

      if (upsertError) {
        return NextResponse.json({ error: 'Failed to upsert feed', details: upsertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      run_id: runId,
      total_scored: scores.length,
      opportunities_surfaced: feedCandidates.length,
    });
  } catch (error) {
    console.error('Scanner run failed:', error);
    return NextResponse.json(
      { error: 'Scanner run failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
