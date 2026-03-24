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
    lines.push('I haven\'t scanned yet. Hit that scanner button and I\'ll find you the best setups.');
    return { agent: 'Mark', title: 'Scanner Report', lines };
  }

  lines.push(`I just scanned **${opportunities.length} assets** — found ${hotNow.length} Hot Now, ${swings.length} Swing, and ${runs.length} Run setups.`);

  const top3 = opportunities.slice(0, 3);
  if (top3.length > 0) {
    lines.push(`My top picks right now: **${top3.map((o) => `${o.ticker} (${o.opportunity_score})`).join(', ')}**.`);
  }

  if (hotNow.length > 0) {
    const best = hotNow[0];
    lines.push(`🔥 I'm watching **${best.ticker}** closely — strongest Hot Now with a ${best.setup_type} setup at ${best.opportunity_score}/100.`);
  }

  const bestBreakout = [...opportunities].sort((a, b) => b.breakout_score - a.breakout_score)[0];
  if (bestBreakout && bestBreakout.breakout_score >= 80) {
    lines.push(`**${bestBreakout.ticker}** is near its 20-day high. I see breakout potential here.`);
  }

  return { agent: 'Mark', title: 'Scanner Report', lines };
}

// ─── Nia ───

function buildNiaSection(opportunities: OpportunityScore[], positions: BasketPosition[]): BriefSection {
  const lines: string[] = [];

  const highSentiment = opportunities.filter((o) => o.sentiment_score >= 65);
  const highCatalyst = opportunities.filter((o) => o.catalyst_score >= 70);

  if (highCatalyst.length > 0) {
    const names = highCatalyst.slice(0, 3).map((o) => o.ticker);
    lines.push(`I'm seeing real fundamental support behind **${names.join(', ')}** — revenue growth and margins back up the move. This isn't just hype.`);
  }

  if (highSentiment.length > 0) {
    const names = highSentiment.slice(0, 3).map((o) => o.ticker);
    lines.push(`Volume is spiking on **${names.join(', ')}**. The market is paying attention here — I'd watch whether this is accumulation or just noise.`);
  }

  const reversionPlays = opportunities.filter((o) => o.mean_reversion_score >= 70);
  if (reversionPlays.length > 0) {
    lines.push(`Interesting — **${reversionPlays.map((o) => o.ticker).slice(0, 2).join(', ')}** ${reversionPlays.length === 1 ? 'is' : 'are'} well below the 20-day average. Could be a reversion opportunity if the story supports it.`);
  }

  const weakening = positions.filter((p) => p.opportunity_score < 45);
  if (weakening.length > 0) {
    lines.push(`Heads up — the narrative around **${weakening.map((p) => p.ticker).join(', ')}** feels like it's fading. I'd keep an eye on that.`);
  }

  if (lines.length === 0) {
    lines.push('I don\'t see any standout catalysts right now. The market is in a quiet narrative phase — price action is driving, not news.');
  }

  return { agent: 'Nia', title: 'News & Catalysts', lines };
}

// ─── Rex ───

function buildRexSection(positions: BasketPosition[], signals: PositionSignal[], analytics: BasketAnalytics | null): BriefSection {
  const lines: string[] = [];

  if (positions.length === 0) {
    lines.push('Your basket is empty. Drag some setups in and I\'ll keep you on track.');
    return { agent: 'Rex', title: 'Basket & Actions', lines };
  }

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalCost = positions.reduce((s, p) => s + p.entry_price * p.quantity, 0);
  const totalPnlPct = totalCost > 0 ? ((positions.reduce((s, p) => s + p.current_price * p.quantity, 0) - totalCost) / totalCost) * 100 : 0;

  if (totalPnl >= 0) {
    lines.push(`Your basket is **up ${totalPnlPct.toFixed(1)}%**. ${totalPnlPct > 10 ? 'Nice run — but don\'t get greedy on me.' : 'Looking good. I\'ll keep watching.'}`);
  } else {
    lines.push(`Your basket is **down ${Math.abs(totalPnlPct).toFixed(1)}%**. ${totalPnlPct < -10 ? 'We need to talk about some positions.' : 'Small dip. I\'m not worried yet if the setups hold.'}`);
  }

  if (analytics) {
    if (analytics.concentration_risk === 'Critical' || analytics.concentration_risk === 'High') {
      lines.push(`⚠️ I don't love the concentration here — **${analytics.largest_position_ticker}** is ${analytics.largest_position_pct.toFixed(0)}% of your basket.`);
    }
    if (analytics.correlation_risk === 'High') {
      lines.push(`⚠️ Your positions are too correlated. If one sector drops, they all drop together.`);
    }
    if (analytics.crypto_allocation > 30) {
      lines.push(`You're at ${analytics.crypto_allocation.toFixed(0)}% crypto — that's above my comfort zone.`);
    }
  }

  const exits = signals.filter((s) => s.action === 'Exit');
  const profits = signals.filter((s) => s.action === 'Take Profit');
  const trims = signals.filter((s) => s.action === 'Trim');
  const watches = signals.filter((s) => s.action === 'Watch');
  const holds = signals.filter((s) => s.action === 'Hold');
  const adds = signals.filter((s) => s.action === 'Add' || s.action === 'Strong Buy');

  if (exits.length > 0) {
    for (const e of exits) lines.push(`🚪 I'd **exit ${e.ticker}** — ${e.reason.toLowerCase()}`);
  }
  if (profits.length > 0) {
    for (const p of profits) lines.push(`💰 Time to **take profit on ${p.ticker}** — ${p.reason.toLowerCase()}`);
  }
  if (trims.length > 0) {
    for (const t of trims) lines.push(`✂️ I'd **trim ${t.ticker}** — ${t.reason.toLowerCase()}`);
  }
  if (watches.length > 0) {
    lines.push(`👀 I'm watching **${watches.map((w) => w.ticker).join(', ')}** — not broken, but weakening.`);
  }
  if (adds.length > 0) {
    lines.push(`➕ I'd consider adding to **${adds.map((a) => a.ticker).join(', ')}** — the scores look strong.`);
  }
  if (holds.length > 0 && exits.length === 0 && profits.length === 0 && trims.length === 0) {
    lines.push(`All ${holds.length} positions look fine to hold. Nothing urgent — just stay the course.`);
  }

  const actionCount = exits.length + profits.length + trims.length;
  if (actionCount > 0) {
    lines.push(`**${actionCount} action${actionCount > 1 ? 's' : ''} I'd take today.** Let's not sit on these.`);
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
