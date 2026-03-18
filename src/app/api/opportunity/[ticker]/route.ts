import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import { getAgent } from '@/lib/agents';
import Anthropic from '@anthropic-ai/sdk';
import type { AgentName } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const admin = createAdminClient();
    const config = await loadConfig(admin);

    // Fetch from opportunity_feed
    const { data: opportunity, error: oppError } = await admin
      .schema('trader')
      .from('opportunity_feed')
      .select('*')
      .eq('ticker', ticker)
      .single();

    if (oppError || !opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // Fetch recent price_history (30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: priceHistory } = await admin
      .from('price_history')
      .select('*')
      .eq('ticker', ticker)
      .gte('date', sinceDate)
      .order('date', { ascending: false });

    // Fetch fundamental_data
    const { data: fundamentals } = await admin
      .from('fundamental_data')
      .select('*')
      .eq('ticker', ticker)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Fetch market_quotes
    const { data: quote } = await admin
      .from('market_quotes')
      .select('*')
      .eq('ticker', ticker)
      .single();

    // Generate agent commentary from Mark, Nia, Rex
    const temperature = getConfigValue<number>(config, 'model.temperature');
    const maxTokens = getConfigValue<number>(config, 'model.max_tokens');

    const agentNames: AgentName[] = ['Mark', 'Nia', 'Rex'];
    const anthropic = new Anthropic();

    const dataContext = `
Ticker: ${ticker}
Asset: ${opportunity.asset_name} (${opportunity.asset_type})
Sector: ${opportunity.sector ?? 'N/A'}
Opportunity Score: ${opportunity.opportunity_score}/100
Label: ${opportunity.opportunity_label}
Setup Type: ${opportunity.setup_type}
Risk: ${opportunity.risk_label}
Horizon: ${opportunity.horizon_days} days

Score Components:
- Momentum: ${opportunity.momentum_score}
- Breakout: ${opportunity.breakout_score}
- Mean Reversion: ${opportunity.mean_reversion_score}
- Catalyst: ${opportunity.catalyst_score}
- Sentiment: ${opportunity.sentiment_score}
- Volatility: ${opportunity.volatility_score}
- Regime Fit: ${opportunity.regime_fit_score}

Current Price: ${quote ? `$${quote.last_price} (${quote.pct_change >= 0 ? '+' : ''}${quote.pct_change.toFixed(2)}%)` : 'N/A'}

Fundamentals: ${fundamentals
  ? `P/E ${fundamentals.pe_ratio ?? 'N/A'}, P/S ${fundamentals.ps_ratio ?? 'N/A'}, Revenue Growth ${fundamentals.revenue_growth_yoy !== null ? (fundamentals.revenue_growth_yoy * 100).toFixed(1) + '%' : 'N/A'}, Margin ${fundamentals.profit_margin !== null ? (fundamentals.profit_margin * 100).toFixed(1) + '%' : 'N/A'}, ROE ${fundamentals.roe !== null ? (fundamentals.roe * 100).toFixed(1) + '%' : 'N/A'}`
  : 'No fundamental data available.'
}

Recent Price History (last 5 days): ${priceHistory && priceHistory.length > 0
  ? priceHistory.slice(0, 5).map((p: Record<string, unknown>) => `${p.date}: O ${p.open} H ${p.high} L ${p.low} C ${p.close} V ${p.volume}`).join(' | ')
  : 'N/A'
}
`.trim();

    const commentaryPromises = agentNames.map(async (name) => {
      const agent = getAgent(name);
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: Math.min(maxTokens, 512),
          temperature,
          system: `You are ${agent.name}, the ${agent.role} for aiMATA. ${agent.job} Your tone: ${agent.tone}. Provide a concise 2-3 sentence commentary on this opportunity from your perspective.`,
          messages: [{ role: 'user', content: `Analyze this opportunity:\n\n${dataContext}` }],
        });

        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        return { agent: name, commentary: text };
      } catch (err) {
        console.error(`Failed to get ${name} commentary:`, err);
        return { agent: name, commentary: `${name} commentary unavailable.` };
      }
    });

    const commentary = await Promise.all(commentaryPromises);

    return NextResponse.json({
      opportunity,
      price_history: priceHistory ?? [],
      fundamentals: fundamentals ?? null,
      quote: quote ?? null,
      commentary,
    });
  } catch (error) {
    console.error('Failed to fetch opportunity detail:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
