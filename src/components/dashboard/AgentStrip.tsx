'use client';

import AgentAvatar from '@/components/ui/AgentAvatar';
import type { OpportunityScore, BasketPosition, BasketAnalytics } from '@/types';
import type { PositionSignal } from '@/lib/scoring/actions';

interface AgentStripProps {
  opportunities: OpportunityScore[];
  positions: BasketPosition[];
  analytics: BasketAnalytics | null;
  signals: PositionSignal[];
}

function getMarkLine(opportunities: OpportunityScore[]): string {
  const hotNow = opportunities.filter(o => o.opportunity_label === 'Hot Now');
  if (hotNow.length > 0) return `${hotNow.length} Hot Now setup${hotNow.length > 1 ? 's' : ''} — ${hotNow.map(h => h.ticker).slice(0, 3).join(', ')} leading.`;
  const top = opportunities[0];
  if (top) return `Top pick: ${top.ticker} at ${top.opportunity_score}/100 (${top.setup_type}).`;
  return 'Scanning for setups...';
}

function getPaulLine(positions: BasketPosition[], analytics: BasketAnalytics | null): string {
  if (positions.length === 0) return 'Basket is empty. Drag some setups in.';
  if (!analytics) return `${positions.length} positions in basket.`;
  if (analytics.concentration_risk === 'Critical') return `Dangerous concentration. Your basket is basically ${positions.length <= 2 ? 'one trade' : 'a few overlapping bets'}.`;
  if (analytics.concentration_risk === 'High') return `Basket is too concentrated. Spread your risk.`;
  if (analytics.crypto_allocation > 30) return `${analytics.crypto_allocation.toFixed(0)}% crypto — that's heavy. Watch the volatility.`;
  if (analytics.basket_quality === 'Strong') return `Basket looks solid. ${positions.length} positions, well-diversified.`;
  if (analytics.basket_quality === 'Good') return `Decent basket. Some room to optimize.`;
  return `${positions.length} positions. Quality: ${analytics.basket_quality}. Keep an eye on balance.`;
}

function getNiaLine(opportunities: OpportunityScore[]): string {
  const highCatalyst = opportunities.filter(o => o.catalyst_score >= 70);
  if (highCatalyst.length > 0) return `Strong fundamentals backing ${highCatalyst.map(h => h.ticker).slice(0, 2).join(' & ')}. Real support, not just noise.`;
  const highSentiment = opportunities.filter(o => o.sentiment_score >= 65);
  if (highSentiment.length > 0) return `Volume spike on ${highSentiment.map(h => h.ticker).slice(0, 2).join(', ')}. Market is paying attention.`;
  return 'Narrative is mixed. No strong catalyst cluster right now.';
}

function getRexLine(signals: PositionSignal[]): string {
  const urgent = signals.filter(s => s.urgency === 'high');
  if (urgent.length > 0) {
    const exits = urgent.filter(s => s.action === 'Exit');
    const profits = urgent.filter(s => s.action === 'Take Profit');
    if (exits.length > 0) return `Cut ${exits.map(e => e.ticker).join(', ')} now. Stop the bleeding.`;
    if (profits.length > 0) return `Take profit on ${profits.map(e => e.ticker).join(', ')}. Don't give it back.`;
    return urgent[0].reason;
  }
  const trims = signals.filter(s => s.action === 'Trim');
  if (trims.length > 0) return `Consider trimming ${trims.map(t => t.ticker).join(', ')}. Lock partial gains.`;
  if (signals.length === 0) return 'No positions to manage yet.';
  return 'Positions look stable. Stay disciplined.';
}

export default function AgentStrip({ opportunities, positions, analytics, signals }: AgentStripProps) {
  const lines = [
    { agent: 'Mark' as const, line: getMarkLine(opportunities) },
    { agent: 'Paul' as const, line: getPaulLine(positions, analytics) },
    { agent: 'Nia' as const, line: getNiaLine(opportunities) },
    { agent: 'Rex' as const, line: getRexLine(signals) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
      {lines.map(({ agent, line }, i) => (
        <div
          key={agent}
          className="flex items-start gap-2 rounded-xl border border-mata-border bg-mata-card px-3 py-2 animate-[slideInUp_0.3s_ease-out_both]"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="flex-shrink-0 mt-0.5">
            <AgentAvatar agentName={agent} size="xs" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-black text-mata-text-muted uppercase tracking-wider">{agent}</div>
            <p className="text-[10px] text-mata-text-secondary leading-snug mt-0.5">{line}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
