import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import { computeBasketAnalytics } from '@/lib/analytics/basket';
import { getAgent } from '@/lib/agents';
import Anthropic from '@anthropic-ai/sdk';
import type { BasketPosition, PriceHistory } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get latest daily brief for user
    const { data: brief, error: briefError } = await admin
      .schema('trader')
      .from('agent_briefs')
      .select('*')
      .eq('user_id', user.id)
      .eq('agent_name', 'Paul')
      .eq('brief_type', 'daily')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (briefError || !brief) {
      return NextResponse.json({ brief: null });
    }

    return NextResponse.json({ brief });
  } catch (error) {
    console.error('Failed to fetch brief:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const config = await loadConfig(admin);
    const paul = getAgent('Paul');

    // Gather basket positions
    const { data: basket } = await admin
      .schema('trader')
      .from('baskets')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    let positions: BasketPosition[] = [];
    let analytics = null;

    if (basket) {
      const { data: rawPositions } = await admin
        .schema('trader')
        .from('basket_positions')
        .select('*')
        .eq('basket_id', basket.id);

      if (rawPositions && rawPositions.length > 0) {
        const tickers = rawPositions.map((p: { ticker: string }) => p.ticker);

        const { data: quotes } = await admin
          .from('market_quotes')
          .select('*')
          .in('ticker', tickers);

        const quoteMap = new Map(
          (quotes ?? []).map((q: { ticker: string; last_price: number }) => [q.ticker, q])
        );

        positions = rawPositions.map((p: Record<string, unknown>) => {
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

        // Fetch price history for analytics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

        const { data: priceHistory } = await admin
          .from('price_history')
          .select('*')
          .in('ticker', tickers)
          .gte('date', sinceDate);

        analytics = computeBasketAnalytics(
          positions,
          (priceHistory ?? []) as PriceHistory[],
          config
        );
      }
    }

    // Gather recent opportunity feed
    const { data: feed } = await admin
      .schema('trader')
      .from('opportunity_feed')
      .select('*')
      .order('opportunity_score', { ascending: false })
      .limit(10);

    // Build prompt
    const promptTemplate = getConfigValue<string>(config, 'prompts.daily_brief');
    const temperature = getConfigValue<number>(config, 'model.temperature');
    const maxTokens = getConfigValue<number>(config, 'model.max_tokens');

    const userMessage = `
Here is the current portfolio data for your daily brief:

## Current Basket Positions
${positions.length > 0
  ? positions.map((p) =>
      `- ${p.ticker} (${p.asset_name}): weight ${p.target_weight.toFixed(1)}%, entry $${p.entry_price.toFixed(2)}, current $${p.current_price.toFixed(2)}, P&L ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnl_pct >= 0 ? '+' : ''}${p.pnl_pct.toFixed(1)}%), score ${p.opportunity_score}, risk ${p.risk_label}, setup ${p.setup_type}`
    ).join('\n')
  : 'No positions in basket.'
}

## Basket Analytics
${analytics
  ? `- Probability Score: ${analytics.probability_score}
- Expected Upside: ${analytics.expected_upside_min.toFixed(1)}% to ${analytics.expected_upside_max.toFixed(1)}%
- Downside Risk: ${analytics.downside_risk.toFixed(1)}%
- Concentration Risk: ${analytics.concentration_risk}
- Correlation Risk: ${analytics.correlation_risk}
- Crypto Allocation: ${analytics.crypto_allocation.toFixed(1)}%
- Basket Quality: ${analytics.basket_quality}
- Warnings: ${analytics.warnings.length > 0 ? analytics.warnings.join('; ') : 'None'}
- Suggested Actions: ${analytics.suggested_actions.join('; ')}`
  : 'No analytics available (basket is empty).'
}

## Top Opportunities in Feed
${feed && feed.length > 0
  ? feed.map((o: Record<string, unknown>) =>
      `- ${o.ticker}: score ${o.opportunity_score}, ${o.opportunity_label}, ${o.setup_type}, risk ${o.risk_label}`
    ).join('\n')
  : 'No opportunities in feed.'
}

Please provide today's daily brief.
`.trim();

    // Call Claude API
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature,
      system: `${promptTemplate}\n\nYou are ${paul.name}, the ${paul.role}. ${paul.job} Your tone: ${paul.tone}`,
      messages: [{ role: 'user', content: userMessage }],
    });

    const briefContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Store in trader.agent_briefs
    const { data: savedBrief, error: saveError } = await admin
      .schema('trader')
      .from('agent_briefs')
      .insert({
        user_id: user.id,
        agent_name: 'Paul',
        content: briefContent,
        brief_type: 'daily',
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (saveError) {
      console.error('Failed to save brief:', saveError.message);
      // Still return the content even if save fails
      return NextResponse.json({ brief: { content: briefContent, agent_name: 'Paul', brief_type: 'daily' } });
    }

    return NextResponse.json({ brief: savedBrief });
  } catch (error) {
    console.error('Failed to generate brief:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
