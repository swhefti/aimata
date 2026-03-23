'use client';

import AnimatedNumber from '@/components/ui/AnimatedNumber';
import type { BasketPosition, BasketAnalytics, OpportunityScore } from '@/types';
import type { PositionSignal } from '@/lib/scoring/actions';

interface DashboardSummaryProps {
  positions: BasketPosition[];
  analytics: BasketAnalytics | null;
  opportunities: OpportunityScore[];
  signals: PositionSignal[];
}

export default function DashboardSummary({
  positions,
  analytics,
  opportunities,
  signals,
}: DashboardSummaryProps) {
  const totalValue = positions.reduce((s, p) => s + p.current_price * p.quantity, 0);
  const totalCost = positions.reduce((s, p) => s + p.entry_price * p.quantity, 0);
  const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  const urgentActions = signals.filter(s => s.urgency === 'high');
  const nonHoldActions = signals.filter(s => s.action !== 'Hold');

  // Find strongest new opportunity not in basket
  const basketTickers = new Set(positions.map(p => p.ticker));
  const topNew = opportunities.find(o => !basketTickers.has(o.ticker));

  // Biggest risk
  const biggestRisk = analytics
    ? analytics.concentration_risk === 'Critical' || analytics.concentration_risk === 'High'
      ? `Concentration: ${analytics.largest_position_ticker} at ${analytics.largest_position_pct.toFixed(0)}%`
      : analytics.correlation_risk === 'High'
      ? 'High correlation between positions'
      : analytics.crypto_allocation > 30
      ? `Crypto: ${analytics.crypto_allocation.toFixed(0)}% (above limit)`
      : null
    : null;

  if (positions.length === 0 && opportunities.length === 0) return null;

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card px-4 py-3 mb-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Basket P&L */}
        {positions.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-mata-text-muted uppercase">Basket</span>
            <span className="text-sm font-black text-mata-text">
              $<AnimatedNumber value={totalValue} decimals={0} />
            </span>
            <span className="text-xs font-bold">
              <AnimatedNumber value={totalPnlPct} suffix="%" decimals={1} colorize />
            </span>
          </div>
        ) : (
          <div className="text-[10px] text-mata-text-muted">No positions yet</div>
        )}

        {/* Quality */}
        {analytics && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-mata-text-muted uppercase">Quality</span>
            <span className={`text-xs font-black ${
              analytics.basket_quality === 'Strong' ? 'text-mata-green'
              : analytics.basket_quality === 'Good' ? 'text-mata-blue'
              : analytics.basket_quality === 'Fair' ? 'text-mata-yellow'
              : 'text-mata-red'
            }`}>
              {analytics.basket_quality} ({analytics.probability_score})
            </span>
          </div>
        )}

        {/* Biggest risk */}
        {biggestRisk && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-mata-red uppercase">Risk</span>
            <span className="text-[10px] font-bold text-mata-red">{biggestRisk}</span>
          </div>
        )}

        {/* Most important action */}
        {urgentActions.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-mata-orange uppercase">Action</span>
            <span className="text-[10px] font-bold text-mata-orange">
              {urgentActions[0].action} {urgentActions[0].ticker}
              {urgentActions.length > 1 && ` +${urgentActions.length - 1} more`}
            </span>
          </div>
        ) : nonHoldActions.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-mata-text-muted uppercase">Action</span>
            <span className="text-[10px] font-bold text-mata-text-secondary">
              {nonHoldActions[0].action} {nonHoldActions[0].ticker}
            </span>
          </div>
        ) : null}

        {/* Top new opportunity */}
        {topNew && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] font-semibold text-mata-text-muted uppercase">Top pick</span>
            <span className="text-[10px] font-black text-mata-orange">
              {topNew.ticker} ({topNew.opportunity_score})
            </span>
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
              topNew.opportunity_label === 'Hot Now' ? 'bg-red-100 text-red-600'
              : topNew.opportunity_label === 'Run' ? 'bg-green-100 text-green-600'
              : 'bg-blue-100 text-blue-600'
            }`}>{topNew.opportunity_label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
