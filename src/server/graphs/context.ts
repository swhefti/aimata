/**
 * Context Builder for Committee Graph
 *
 * Assembles a structured context summary from existing deterministic data.
 * The graph receives this as input — it does NOT query data directly.
 * This enforces the "agents explain canon" principle.
 */

import * as trader from '@/server/domains/trader';
import * as market from '@/server/domains/market';
import { computePositionActions } from '@/lib/scoring/actions';
import type { BasketPosition, OpportunityScore } from '@/types';

/**
 * Build the deterministic context for a committee synthesis.
 * Reads from existing basket state, analytics, feed, and actions.
 */
export async function buildCommitteeContext(
  userId: string,
  subjectType: string,
  subjectId?: string | null,
): Promise<string> {
  const sections: string[] = [];

  // If a specific ticker is the subject, include its detail first
  if (subjectType === 'ticker' && subjectId) {
    const tickerCtx = await buildTickerContext(subjectId);
    sections.push(tickerCtx);
  }

  // ─── Market / Opportunity Feed ───
  const feed = await trader.getOpportunityFeed();
  const hotNow = feed.filter(o => o.opportunity_label === 'Hot Now');
  const swings = feed.filter(o => o.opportunity_label === 'Swing');
  const runs = feed.filter(o => o.opportunity_label === 'Run');

  sections.push(`## Market Overview
${feed.length} opportunities in feed: ${hotNow.length} Hot Now, ${swings.length} Swing, ${runs.length} Run
Top 5 by score:
${feed.slice(0, 5).map(o =>
    `  ${o.ticker} (${o.asset_name}): ${o.opportunity_score}/100, ${o.opportunity_label}, ${o.setup_type}, ${o.risk_label} risk`
  ).join('\n')}`);

  // ─── Basket State ───
  const { basket, positions } = await trader.getUserBasket(userId);

  if (!basket || positions.length === 0) {
    sections.push(`## Basket
Empty — no positions held.`);
    return sections.join('\n\n');
  }

  const totalValue = positions.reduce((s: number, p: BasketPosition) => s + p.current_price * p.quantity, 0);
  const totalCost = positions.reduce((s: number, p: BasketPosition) => s + p.entry_price * p.quantity, 0);
  const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const winners = positions.filter((p: BasketPosition) => p.pnl_pct > 0).length;
  const losers = positions.filter((p: BasketPosition) => p.pnl_pct < 0).length;

  sections.push(`## Basket
${positions.length} positions (${winners}W / ${losers}L) | Value: $${totalValue.toFixed(0)} | Invested: $${totalCost.toFixed(0)} | Return: ${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%
Positions:
${positions.map((p: BasketPosition) =>
    `  ${p.ticker}: ${(p.manual_weight ?? p.target_weight).toFixed(1)}% weight, ${p.pnl_pct >= 0 ? '+' : ''}${p.pnl_pct.toFixed(1)}% P&L, score ${p.opportunity_score}, ${p.risk_label} risk, ${p.setup_type}`
  ).join('\n')}`);

  // ─── Analytics ───
  const analytics = await trader.computeAndSnapshotAnalytics(userId);
  if (analytics) {
    sections.push(`## Basket Analytics
Probability Score: ${analytics.probability_score}/100 (${analytics.basket_quality})
Concentration: ${analytics.concentration_risk} (largest: ${analytics.largest_position_ticker} at ${analytics.largest_position_pct.toFixed(0)}%)
Correlation: ${analytics.correlation_risk}
Crypto Allocation: ${analytics.crypto_allocation.toFixed(0)}%
Expected Upside: ${analytics.expected_upside_min.toFixed(1)}% – ${analytics.expected_upside_max.toFixed(1)}%
Downside Risk: -${analytics.downside_risk.toFixed(1)}%
Warnings: ${analytics.warnings.length > 0 ? analytics.warnings.join('; ') : 'None'}`);
  }

  // ─── Actions ───
  const actions = computePositionActions(positions);
  const nonHoldActions = actions.filter(a => a.action !== 'Hold');

  if (nonHoldActions.length > 0) {
    sections.push(`## Recommended Actions
${nonHoldActions.map(a =>
    `  ${a.action.toUpperCase()} ${a.ticker} (${a.urgency}): ${a.reason}`
  ).join('\n')}`);
  } else {
    sections.push(`## Recommended Actions
All positions in hold territory. No urgent actions.`);
  }

  return sections.join('\n\n');
}

/**
 * Build context for a general market question.
 * Uses opportunity feed + basket overview if available.
 */
export async function buildMarketContext(userId: string): Promise<string> {
  const feed = await trader.getOpportunityFeed();
  const hotNow = feed.filter(o => o.opportunity_label === 'Hot Now');
  const swings = feed.filter(o => o.opportunity_label === 'Swing');
  const runs = feed.filter(o => o.opportunity_label === 'Run');

  const sections: string[] = [];

  sections.push(`## Market Overview
${feed.length} opportunities scored: ${hotNow.length} Hot Now, ${swings.length} Swing, ${runs.length} Run
Top 5 by score:
${feed.slice(0, 5).map(o =>
    `  ${o.ticker} (${o.asset_name}): ${o.opportunity_score}/100, ${o.opportunity_label}, ${o.setup_type}, ${o.risk_label} risk`
  ).join('\n')}`);

  // Include basket if user has one
  const { positions } = await trader.getUserBasket(userId);
  if (positions.length > 0) {
    const totalValue = positions.reduce((s: number, p: BasketPosition) => s + p.current_price * p.quantity, 0);
    const totalCost = positions.reduce((s: number, p: BasketPosition) => s + p.entry_price * p.quantity, 0);
    const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

    sections.push(`## Your Basket
${positions.length} positions | Value: $${totalValue.toFixed(0)} | Return: ${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%`);
  }

  return sections.join('\n\n');
}

/**
 * Build context for a specific ticker question.
 */
export async function buildTickerContext(ticker: string): Promise<string> {
  const opp = await trader.getOpportunityByTicker(ticker);
  if (!opp) return `No data available for ${ticker}.`;

  const [quotes, fundamentals] = await Promise.all([
    market.getLatestQuotes([ticker]),
    market.getFundamentals([ticker]),
  ]);
  const quote = quotes.get(ticker);
  const fund = fundamentals[0];

  return `## Ticker: ${opp.ticker} (${opp.asset_name})
Type: ${opp.asset_type}${opp.sector ? `, ${opp.sector}` : ''}
Price: $${quote?.last_price?.toFixed(2) ?? 'N/A'} (${quote?.pct_change != null ? (quote.pct_change >= 0 ? '+' : '') + (quote.pct_change * 100).toFixed(1) + '%' : 'N/A'})

## Opportunity Score: ${opp.opportunity_score}/100
Label: ${opp.opportunity_label} | Risk: ${opp.risk_label} | Setup: ${opp.setup_type} | Horizon: ~${opp.horizon_days}d
Components: Momentum ${opp.momentum_score}, Breakout ${opp.breakout_score}, Reversion ${opp.mean_reversion_score}, Catalyst ${opp.catalyst_score}, Sentiment ${opp.sentiment_score}, Volatility ${opp.volatility_score}, Regime ${opp.regime_fit_score}

${fund ? `## Fundamentals
PE: ${fund.pe_ratio ?? 'N/A'} | Revenue Growth: ${fund.revenue_growth_yoy != null ? (fund.revenue_growth_yoy * 100).toFixed(1) + '%' : 'N/A'} | Margin: ${fund.profit_margin != null ? (fund.profit_margin * 100).toFixed(1) + '%' : 'N/A'} | ROE: ${fund.roe != null ? (fund.roe * 100).toFixed(1) + '%' : 'N/A'}` : ''}

## Explanation
${opp.explanation}`;
}

/**
 * Build context for a basket question (lighter than full committee context).
 */
export async function buildBasketContext(userId: string): Promise<string> {
  const { positions } = await trader.getUserBasket(userId);
  if (positions.length === 0) return 'Basket is empty.';

  const totalValue = positions.reduce((s: number, p: BasketPosition) => s + p.current_price * p.quantity, 0);
  const totalCost = positions.reduce((s: number, p: BasketPosition) => s + p.entry_price * p.quantity, 0);
  const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  const actions = computePositionActions(positions);
  const nonHold = actions.filter(a => a.action !== 'Hold');

  return `## Basket: ${positions.length} positions
Value: $${totalValue.toFixed(0)} | Invested: $${totalCost.toFixed(0)} | Return: ${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%
${positions.map((p: BasketPosition) =>
    `  ${p.ticker}: ${(p.manual_weight ?? p.target_weight).toFixed(1)}% weight, ${p.pnl_pct >= 0 ? '+' : ''}${p.pnl_pct.toFixed(1)}% P&L, score ${p.opportunity_score}, ${p.risk_label} risk`
  ).join('\n')}

## Actions
${nonHold.length > 0
    ? nonHold.map(a => `  ${a.action.toUpperCase()} ${a.ticker}: ${a.reason}`).join('\n')
    : 'All positions in hold territory.'}`;
}

/**
 * Build context for an action/recommendation question about a specific position.
 */
export async function buildActionContext(userId: string, ticker: string): Promise<string> {
  const { basket, positions } = await trader.getUserBasket(userId);
  if (!basket) return 'No active basket.';

  const pos = positions.find((p: BasketPosition) => p.ticker === ticker);
  if (!pos) return `${ticker} is not in the basket.`;

  const actions = computePositionActions(positions);
  const action = actions.find(a => a.ticker === ticker);

  return `## Position: ${pos.ticker} (${pos.asset_name})
Weight: ${(pos.manual_weight ?? pos.target_weight).toFixed(1)}% | Entry: $${pos.entry_price.toFixed(2)} | Current: $${pos.current_price.toFixed(2)} | P&L: ${pos.pnl_pct >= 0 ? '+' : ''}${pos.pnl_pct.toFixed(1)}%
Score: ${pos.opportunity_score}/100 | Risk: ${pos.risk_label} | Setup: ${pos.setup_type}

## System Action: ${action?.action ?? 'Hold'}
Urgency: ${action?.urgency ?? 'low'}
Reason: ${action?.reason ?? 'Position within normal range.'}

## Basket context
${positions.length} total positions, ${positions.filter((p: BasketPosition) => p.pnl_pct > 0).length}W / ${positions.filter((p: BasketPosition) => p.pnl_pct < 0).length}L`;
}
