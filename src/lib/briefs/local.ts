/**
 * Local daily brief generator.
 * Produces a structured multi-agent brief from basket, analytics, opportunities, and signals.
 * No Claude API needed — always works.
 */

import type { BasketPosition, BasketAnalytics, OpportunityScore } from '@/types';
import type { PositionSignal } from '@/lib/scoring/actions';

export interface BriefSection {
  agent: 'Mark' | 'Paul' | 'Nia' | 'Rex';
  title: string;
  lines: string[];
}

export interface LocalBrief {
  generated_at: string;
  summary: string;
  sections: BriefSection[];
}

export function generateLocalBrief(
  positions: BasketPosition[],
  analytics: BasketAnalytics | null,
  opportunities: OpportunityScore[],
  signals: PositionSignal[]
): LocalBrief {
  const sections: BriefSection[] = [];

  // ─── Mark: Market scan summary ───
  sections.push(buildMarkSection(opportunities));

  // ─── Rex: Basket health + Action items (absorbed Paul's role) ───
  sections.push(buildRexSection(positions, signals, analytics));

  // ─── Nia: News & catalysts ───
  sections.push(buildNiaSection(opportunities, positions));

  // Build summary
  const summary = buildSummary(positions, analytics, opportunities, signals);

  return {
    generated_at: new Date().toISOString(),
    summary,
    sections,
  };
}

// ─── Mark ───

function buildMarkSection(opportunities: OpportunityScore[]): BriefSection {
  const lines: string[] = [];

  const hotNow = opportunities.filter((o) => o.opportunity_label === 'Hot Now');
  const runs = opportunities.filter((o) => o.opportunity_label === 'Run');
  const swings = opportunities.filter((o) => o.opportunity_label === 'Swing');

  if (opportunities.length === 0) {
    lines.push('No scored opportunities yet. Run the scanner to discover setups.');
    return { agent: 'Mark', title: 'Scanner Report', lines };
  }

  lines.push(`Scanned the universe — **${opportunities.length} assets scored**, ${hotNow.length} Hot Now, ${swings.length} Swing, ${runs.length} Run.`);

  // Top picks
  const top3 = opportunities.slice(0, 3);
  if (top3.length > 0) {
    lines.push(`Top picks: **${top3.map((o) => `${o.ticker} (${o.opportunity_score})`).join(', ')}**.`);
  }

  // Hot Now highlights
  if (hotNow.length > 0) {
    const best = hotNow[0];
    lines.push(`🔥 **${best.ticker}** is the strongest Hot Now — ${best.setup_type} setup at ${best.opportunity_score}/100. ${best.risk_label} risk.`);
  }

  // Strongest breakout
  const bestBreakout = [...opportunities].sort((a, b) => b.breakout_score - a.breakout_score)[0];
  if (bestBreakout && bestBreakout.breakout_score >= 80) {
    lines.push(`Breakout alert: **${bestBreakout.ticker}** is trading near its 20-day high (breakout score: ${bestBreakout.breakout_score}).`);
  }

  // Crypto vs stock split
  const cryptoCount = opportunities.filter((o) => o.asset_type === 'crypto').length;
  const stockCount = opportunities.filter((o) => o.asset_type === 'stock').length;
  if (cryptoCount > 0 && stockCount > 0) {
    lines.push(`Mix: ${stockCount} stocks, ${cryptoCount} crypto in the scored universe.`);
  }

  return { agent: 'Mark', title: 'Scanner Report', lines };
}

// ─── Nia ───

function buildNiaSection(opportunities: OpportunityScore[], positions: BasketPosition[]): BriefSection {
  const lines: string[] = [];

  // Sentiment highlights
  const highSentiment = opportunities.filter((o) => o.sentiment_score >= 65);
  const highCatalyst = opportunities.filter((o) => o.catalyst_score >= 70);

  if (highCatalyst.length > 0) {
    const names = highCatalyst.slice(0, 3).map((o) => o.ticker);
    lines.push(`Strong fundamental backing on **${names.join(', ')}**. Revenue growth and margins are supporting these names — this isn't just momentum.`);
  }

  if (highSentiment.length > 0) {
    const names = highSentiment.slice(0, 3).map((o) => o.ticker);
    lines.push(`Volume is elevated on **${names.join(', ')}**. The market is paying attention. Whether that's accumulation or distribution matters — watch the price action.`);
  }

  // Mean reversion opportunities
  const reversionPlays = opportunities.filter((o) => o.mean_reversion_score >= 70);
  if (reversionPlays.length > 0) {
    lines.push(`**${reversionPlays.map((o) => o.ticker).slice(0, 2).join(', ')}** ${reversionPlays.length === 1 ? 'is' : 'are'} trading well below the 20-day average. Possible reversion play if sentiment supports it.`);
  }

  // Basket positions with weakening scores
  const weakening = positions.filter((p) => p.opportunity_score < 45);
  if (weakening.length > 0) {
    lines.push(`Heads up: **${weakening.map((p) => p.ticker).join(', ')}** in your basket ${weakening.length === 1 ? 'has a' : 'have'} weakening score${weakening.length === 1 ? '' : 's'}. The narrative may be fading.`);
  }

  if (lines.length === 0) {
    lines.push('No standout sentiment signals today. Market is in a neutral narrative zone — price action is leading, not news.');
  }

  return { agent: 'Nia', title: 'Sentiment & Catalysts', lines };
}

// ─── Rex ───

function buildRexSection(positions: BasketPosition[], signals: PositionSignal[], analytics: BasketAnalytics | null): BriefSection {
  const lines: string[] = [];

  if (positions.length === 0) {
    lines.push('No positions to manage. Once you build the basket, I\'ll tell you exactly what needs attention.');
    return { agent: 'Rex', title: 'Basket & Actions', lines };
  }

  // Basket health (absorbed from Paul)
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalCost = positions.reduce((s, p) => s + p.entry_price * p.quantity, 0);
  const totalPnlPct = totalCost > 0 ? ((positions.reduce((s, p) => s + p.current_price * p.quantity, 0) - totalCost) / totalCost) * 100 : 0;

  if (totalPnl >= 0) {
    lines.push(`Basket is **up ${totalPnlPct.toFixed(1)}%**. ${totalPnlPct > 10 ? 'Strong run — don\'t get complacent.' : 'Stay disciplined.'}`);
  } else {
    lines.push(`Basket is **down ${Math.abs(totalPnlPct).toFixed(1)}%**. ${totalPnlPct < -10 ? 'This needs attention — review each position.' : 'Minor drawdown. Hold if setups are intact.'}`);
  }

  if (analytics) {
    if (analytics.concentration_risk === 'Critical' || analytics.concentration_risk === 'High') {
      lines.push(`⚠️ Concentration is **${analytics.concentration_risk.toLowerCase()}** — ${analytics.largest_position_ticker} at ${analytics.largest_position_pct.toFixed(0)}%.`);
    }
    if (analytics.correlation_risk === 'High') {
      lines.push(`⚠️ High correlation — positions move together. Sector pullback hits the whole basket.`);
    }
    if (analytics.crypto_allocation > 30) {
      lines.push(`Crypto at ${analytics.crypto_allocation.toFixed(0)}% — above the 30% guardrail.`);
    }
  }

  // Action items
  const exits = signals.filter((s) => s.action === 'Exit');
  const profits = signals.filter((s) => s.action === 'Take Profit');
  const trims = signals.filter((s) => s.action === 'Trim');
  const watches = signals.filter((s) => s.action === 'Watch');
  const holds = signals.filter((s) => s.action === 'Hold');
  const adds = signals.filter((s) => s.action === 'Add' || s.action === 'Strong Buy');

  if (exits.length > 0) {
    for (const e of exits) lines.push(`🚪 **EXIT ${e.ticker}** — ${e.reason}`);
  }
  if (profits.length > 0) {
    for (const p of profits) lines.push(`💰 **TAKE PROFIT on ${p.ticker}** — ${p.reason}`);
  }
  if (trims.length > 0) {
    for (const t of trims) lines.push(`✂️ **TRIM ${t.ticker}** — ${t.reason}`);
  }
  if (watches.length > 0) {
    lines.push(`👀 Watching: **${watches.map((w) => w.ticker).join(', ')}** — weakening but not broken.`);
  }
  if (adds.length > 0) {
    lines.push(`➕ Could add to: **${adds.map((a) => a.ticker).join(', ')}** — scores are strong.`);
  }
  if (holds.length > 0 && exits.length === 0 && profits.length === 0 && trims.length === 0) {
    lines.push(`All ${holds.length} positions in hold territory. Stay disciplined.`);
  }

  const actionCount = exits.length + profits.length + trims.length;
  if (actionCount > 0) {
    lines.push(`**${actionCount} action${actionCount > 1 ? 's' : ''} needed.** Don't ignore these.`);
  }

  return { agent: 'Rex', title: 'Basket & Actions', lines };
}

// ─── Summary ───

function buildSummary(
  positions: BasketPosition[],
  analytics: BasketAnalytics | null,
  opportunities: OpportunityScore[],
  signals: PositionSignal[]
): string {
  const parts: string[] = [];

  // Market overview
  const hotCount = opportunities.filter((o) => o.opportunity_label === 'Hot Now').length;
  if (hotCount > 0) {
    parts.push(`${hotCount} Hot Now setup${hotCount > 1 ? 's' : ''} active`);
  } else {
    parts.push(`${opportunities.length} opportunities scored`);
  }

  // Basket status
  if (positions.length === 0) {
    parts.push('basket empty');
  } else {
    const totalCost = positions.reduce((s, p) => s + p.entry_price * p.quantity, 0);
    const totalValue = positions.reduce((s, p) => s + p.current_price * p.quantity, 0);
    const pnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
    parts.push(`basket ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`);

    if (analytics) {
      parts.push(`quality: ${analytics.basket_quality}`);
    }
  }

  // Urgent actions
  const urgentCount = signals.filter((s) => s.urgency === 'high').length;
  if (urgentCount > 0) {
    parts.push(`${urgentCount} urgent action${urgentCount > 1 ? 's' : ''}`);
  }

  return parts.join(' · ');
}
