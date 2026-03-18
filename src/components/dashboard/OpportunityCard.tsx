'use client';

import Badge from '@/components/ui/Badge';
import Sparkline from '@/components/ui/Sparkline';
import type { OpportunityScore } from '@/types';

type OpportunityWithPrice = OpportunityScore & {
  last_price?: number;
  daily_change?: number;
  pct_change?: number;
  price_history?: number[];
};

interface OpportunityCardProps {
  opportunity: OpportunityWithPrice;
  onAdd?: (ticker: string) => void;
  compact?: boolean;
}

export default function OpportunityCard({ opportunity: o, onAdd, compact }: OpportunityCardProps) {
  const changeColor = (o.pct_change ?? 0) >= 0 ? 'text-mata-green' : 'text-mata-red';
  const changeSign = (o.pct_change ?? 0) >= 0 ? '+' : '';

  return (
    <div className="group relative rounded-xl border border-mata-border bg-mata-card p-3 transition-all hover:card-glow hover:border-mata-orange/30 cursor-grab active:cursor-grabbing">
      {/* Top row: ticker + price + sparkline */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-mata-text tracking-tight">{o.ticker}</span>
              <Badge
                label={o.asset_type === 'crypto' ? '₿' : '◆'}
                variant={o.asset_type === 'crypto' ? 'hot' : 'default'}
              />
            </div>
            <span className="text-[10px] text-mata-text-muted truncate">{o.asset_name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {o.price_history && o.price_history.length > 1 && (
            <Sparkline data={o.price_history} width={56} height={20} strokeWidth={1.2} />
          )}
          <div className="text-right">
            {o.last_price != null && (
              <div className="text-xs font-bold text-mata-text">${o.last_price.toFixed(2)}</div>
            )}
            {o.pct_change != null && (
              <div className={`text-[10px] font-semibold ${changeColor}`}>
                {changeSign}{(o.pct_change * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score + labels row */}
      <div className="flex items-center gap-1.5 mt-2">
        {/* Score pill */}
        <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
          o.opportunity_score >= 70
            ? 'bg-mata-green/10 text-mata-green'
            : o.opportunity_score >= 50
            ? 'bg-mata-yellow/10 text-mata-yellow'
            : 'bg-mata-red/10 text-mata-red'
        }`}>
          {o.opportunity_score}
        </div>
        <Badge label={o.opportunity_label} variant={
          o.opportunity_label === 'Hot Now' ? 'hot' : o.opportunity_label === 'Run' ? 'run' : 'swing'
        } />
        <Badge label={o.risk_label} variant={o.risk_label.toLowerCase() as 'low' | 'medium' | 'high'} />
        <span className="text-[10px] text-mata-text-muted ml-auto">{o.setup_type}</span>
      </div>

      {/* Explanation */}
      {!compact && (
        <p className="mt-1.5 text-[10px] text-mata-text-secondary leading-relaxed line-clamp-1">
          {o.explanation}
        </p>
      )}

      {/* Add button - visible on hover */}
      {onAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(o.ticker); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-mata-orange px-2 py-1 text-[10px] font-bold text-white hover:bg-mata-orange-dark"
        >
          + Add
        </button>
      )}
    </div>
  );
}
