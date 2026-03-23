/**
 * Domain: Agent Layer (Layer D) — INTERIM ADAPTER
 *
 * In the target architecture, this layer owns:
 * - LangGraph threads, messages, graph runs
 * - Committee sessions and votes
 * - Agent artifacts (briefs, explanations)
 * - Tool calls and stream events
 *
 * Current state: The `agent` schema does not exist yet.
 * This module wraps current Claude API calls as a transitional adapter.
 * When Phase 5 (LangGraph) is implemented:
 * - Create `agent` schema with thread/message/graph tables
 * - Replace direct Claude calls with LangGraph graph invocations
 * - Each agent gets a proper graph node with structured output
 * - Committee mode becomes a parallel graph
 *
 * Phase 5 migration notes are marked with "FUTURE:" comments.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/server/db';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import { getAgent } from '@/lib/agents';
import * as trader from '@/server/domains/trader';
import type { BasketPosition, PriceHistory } from '@/types';
import { computeBasketAnalytics } from '@/lib/analytics/basket';

// ─── Ticker Commentary ───

/**
 * Generate agent commentary for a specific ticker.
 *
 * FUTURE: This should invoke a LangGraph specialist chat graph (Graph A)
 * that reads from canonical data via tools. The current implementation
 * calls Claude directly with inline data.
 */
export async function getTickerCommentary(
  ticker: string,
  context: {
    scores: Record<string, unknown>;
    priceHistory: unknown[];
    fundamentals: unknown;
    quote: unknown;
  }
): Promise<{ agent: string; commentary: string }[]> {
  const db = getAdminClient();
  const config = await loadConfig(db);
  const temperature = getConfigValue<number>(config, 'model.temperature');
  const maxTokens = getConfigValue<number>(config, 'model.max_tokens');

  const agents = ['Mark', 'Nia', 'Rex'] as const;
  const contextStr = JSON.stringify(context, null, 2);

  try {
    const anthropic = new Anthropic();

    const commentaries = await Promise.all(
      agents.map(async (agentName) => {
        const agent = getAgent(agentName);
        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: maxTokens,
            temperature,
            system: `You are ${agent.name}, the ${agent.role} at aiMATA. ${agent.job} Your tone: ${agent.tone}. Give a 2-3 sentence assessment of ${ticker}.`,
            messages: [{ role: 'user', content: `Analyze ${ticker} based on this data:\n${contextStr}` }],
          });

          const text = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n');

          return { agent: agentName, commentary: text };
        } catch {
          return { agent: agentName, commentary: `${agent.name} is unavailable right now.` };
        }
      })
    );

    return commentaries;
  } catch {
    return agents.map((name) => ({
      agent: name,
      commentary: `${name} is unavailable right now.`,
    }));
  }
}

// ─── Daily Brief Generation (Claude) ───

/**
 * Generate and store a Claude-powered daily brief.
 *
 * FUTURE: This should invoke LangGraph Graph C (daily brief generation)
 * which runs Mark/Nia/Paul/Rex nodes in sequence, producing structured
 * outputs that are then composed into a final brief artifact.
 */
export async function generateDailyBrief(userId: string): Promise<{
  content: string;
  agent_name: string;
  brief_type: string;
}> {
  const db = getAdminClient();
  const config = await loadConfig(db);
  const paul = getAgent('Paul');

  // Gather basket state
  const { basket, positions } = await trader.getUserBasket(userId);
  let analytics = null;

  if (basket && positions.length > 0) {
    const tickers = positions.map((p: BasketPosition) => p.ticker);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: priceHistory } = await db
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

  // Gather feed
  const feed = await trader.getOpportunityFeed();
  const topFeed = feed.slice(0, 10);

  // Build prompt
  const promptTemplate = getConfigValue<string>(config, 'prompts.daily_brief');
  const temperature = getConfigValue<number>(config, 'model.temperature');
  const maxTokens = getConfigValue<number>(config, 'model.max_tokens');

  const userMessage = `
Here is the current portfolio data for your daily brief:

## Current Basket Positions
${positions.length > 0
    ? positions.map((p: BasketPosition) =>
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
- Warnings: ${analytics.warnings.length > 0 ? analytics.warnings.join('; ') : 'None'}`
    : 'No analytics available (basket is empty).'
  }

## Top Opportunities
${topFeed.length > 0
    ? topFeed.map((o) =>
        `- ${o.ticker}: score ${o.opportunity_score}, ${o.opportunity_label}, ${o.setup_type}, risk ${o.risk_label}`
      ).join('\n')
    : 'No opportunities in feed.'
  }

Please provide today's daily brief.
`.trim();

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
  const saved = await trader.storeBrief(userId, briefContent, 'Paul');

  return saved ?? { content: briefContent, agent_name: 'Paul', brief_type: 'daily' };
}
