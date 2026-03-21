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
import type { BasketPosition } from '@/types';

/**
 * Build the deterministic context for a committee synthesis.
 * Reads from existing basket state, analytics, feed, and actions.
 */
export async function buildCommitteeContext(
  userId: string,
  subjectType: string,
): Promise<string> {
  const sections: string[] = [];

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
