'use client';

import type { OpportunityScore, AgentName } from '@/types';
import ScoreRing from '@/components/ui/ScoreRing';
import Badge from '@/components/ui/Badge';
import AgentAvatar from '@/components/ui/AgentAvatar';

interface OpportunityCardProps {
  opportunity: OpportunityScore & {
    last_price?: number;
    daily_change?: number;
    pct_change?: number;
  };
  onAdd?: (ticker: string) => void;
}

function labelVariant(label: string): 'hot' | 'swing' | 'run' | 'default' {
  const lower = label.toLowerCase();
  if (lower.includes('hot')) return 'hot';
  if (lower.includes('swing')) return 'swing';
  if (lower.includes('run')) return 'run';
  return 'default';
}

function riskVariant(label: string): 'low' | 'medium' | 'high' | 'default' {
  const lower = label.toLowerCase();
  if (lower === 'low') return 'low';
  if (lower === 'medium') return 'medium';
  if (lower === 'high') return 'high';
  return 'default';
}

export default function OpportunityCard({ opportunity, onAdd }: OpportunityCardProps) {
  const {
    ticker,
    asset_name,
    asset_type,
    opportunity_score,
    opportunity_label,
    risk_label,
    setup_type,
    explanation,
    agent_tag,
    last_price,
    pct_change,
  } = opportunity;

  const changePositive = (pct_change ?? 0) >= 0;

  return (
    <div
      className="group relative rounded-2xl border border-mata-border bg-mata-card p-4 transition-all duration-200 hover:card-glow-active hover:-translate-y-0.5 cursor-pointer"
      data-draggable-ticker={ticker}
    >
      {/* Top row: ticker + score */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black tracking-tight text-mata-text">
              {ticker}
            </h3>
            <Badge
              label={asset_type}
              variant={asset_type === 'crypto' ? 'swing' : 'default'}
            />
          </div>
          <p className="mt-0.5 truncate text-xs text-mata-text-muted">{asset_name}</p>
        </div>
        <ScoreRing score={opportunity_score} size={52} />
      </div>

      {/* Badges row */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge label={opportunity_label} variant={labelVariant(opportunity_label)} />
        <Badge label={`Risk: ${risk_label}`} variant={riskVariant(risk_label)} />
        <Badge label={setup_type} />
      </div>

      {/* Explanation */}
      <p className="mt-3 text-xs leading-relaxed text-mata-text-secondary line-clamp-2">
        {explanation}
      </p>

      {/* Bottom row: agent + price + action */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <AgentAvatar agentName={agent_tag as AgentName} size="sm" />

        <div className="flex items-center gap-3">
          {last_price != null && (
            <div className="text-right">
              <div className="text-sm font-bold text-mata-text">
                ${last_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {pct_change != null && (
                <div
                  className={`text-[11px] font-semibold ${
                    changePositive ? 'text-mata-green' : 'text-mata-red'
                  }`}
                >
                  {changePositive ? '+' : ''}
                  {pct_change.toFixed(2)}%
                </div>
              )}
            </div>
          )}

          {onAdd && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd(ticker);
              }}
              className="rounded-lg bg-mata-orange px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-mata-orange-dark active:scale-95"
            >
              + Basket
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
