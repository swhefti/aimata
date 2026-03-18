'use client';

import ScoreRing from '@/components/ui/ScoreRing';
import Badge from '@/components/ui/Badge';
import type { BasketAnalytics } from '@/types';

interface AnalyticsPanelProps {
  analytics: BasketAnalytics | null;
  loading?: boolean;
}

export default function AnalyticsPanel({ analytics, loading }: AnalyticsPanelProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-mata-border bg-mata-card p-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-mata-surface mb-4" />
        <div className="flex justify-center mb-4">
          <div className="h-20 w-20 rounded-full bg-mata-surface" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-mata-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-xl border border-mata-border bg-mata-card p-4 text-center">
        <p className="text-xs text-mata-text-muted">Add positions to see analytics</p>
      </div>
    );
  }

  const a = analytics;

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-xs font-black text-mata-text tracking-tight uppercase">Basket Intelligence</h3>
      </div>

      {/* Probability Score */}
      <div className="flex flex-col items-center py-3 border-b border-mata-border">
        <ScoreRing score={a.probability_score} size={72} label="3m Prob" />
        <Badge label={a.basket_quality} variant={
          a.basket_quality === 'Strong' ? 'run' : a.basket_quality === 'Good' ? 'swing' : a.basket_quality === 'Fair' ? 'medium' : 'high'
        } />
        <p className="text-[9px] text-mata-text-muted mt-1 text-center px-4">
          Probability of favorable 3-month outcome
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-px bg-mata-border">
        <MetricCell
          label="Expected Upside"
          value={`${a.expected_upside_min.toFixed(1)}% \u2013 ${a.expected_upside_max.toFixed(1)}%`}
          color="text-mata-green"
        />
        <MetricCell
          label="Downside Risk"
          value={`-${a.downside_risk.toFixed(1)}%`}
          color="text-mata-red"
        />
        <MetricCell
          label="Concentration"
          value={a.concentration_risk}
          color={a.concentration_risk === 'Low' ? 'text-mata-green' : a.concentration_risk === 'Medium' ? 'text-mata-yellow' : 'text-mata-red'}
        />
        <MetricCell
          label="Correlation"
          value={a.correlation_risk}
          color={a.correlation_risk === 'Low' ? 'text-mata-green' : a.correlation_risk === 'Medium' ? 'text-mata-yellow' : 'text-mata-red'}
        />
        <MetricCell
          label="Crypto Alloc"
          value={`${a.crypto_allocation.toFixed(1)}%`}
          color={a.crypto_allocation > 30 ? 'text-mata-red' : 'text-mata-text'}
          bar={a.crypto_allocation}
        />
        <MetricCell
          label="Largest Pos"
          value={`${a.largest_position_ticker} ${a.largest_position_pct.toFixed(1)}%`}
          color={a.largest_position_pct > 25 ? 'text-mata-red' : 'text-mata-text'}
        />
      </div>

      {/* Horizon mix */}
      <div className="px-4 py-3 border-t border-mata-border">
        <div className="text-[10px] font-bold text-mata-text-muted mb-2 uppercase">Horizon Mix</div>
        <div className="flex gap-1">
          {[
            { label: 'Hot Now', count: a.horizon_mix.hot_now, color: 'bg-mata-red' },
            { label: 'Swing', count: a.horizon_mix.swing, color: 'bg-mata-blue' },
            { label: 'Run', count: a.horizon_mix.run, color: 'bg-mata-green' },
          ].map((h) => {
            const total = a.horizon_mix.hot_now + a.horizon_mix.swing + a.horizon_mix.run;
            const pct = total > 0 ? (h.count / total) * 100 : 0;
            return (
              <div key={h.label} className="flex-1">
                <div className="h-2 rounded-full bg-mata-surface overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${h.color}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[9px] text-mata-text-muted text-center">{h.label} ({h.count})</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {a.warnings.length > 0 && (
        <div className="px-4 py-3 border-t border-mata-border bg-mata-red/5">
          <div className="text-[10px] font-bold text-mata-red mb-1.5 uppercase">Warnings</div>
          <ul className="space-y-1">
            {a.warnings.slice(0, 3).map((w, i) => (
              <li key={i} className="text-[10px] text-mata-text-secondary flex gap-1.5">
                <span className="text-mata-red flex-shrink-0">!</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {a.suggested_actions.length > 0 && (
        <div className="px-4 py-3 border-t border-mata-border">
          <div className="text-[10px] font-bold text-mata-text-muted mb-1.5 uppercase">Suggested Actions</div>
          <ul className="space-y-1">
            {a.suggested_actions.slice(0, 3).map((action, i) => (
              <li key={i} className="text-[10px] text-mata-text-secondary flex gap-1.5">
                <span className="text-mata-orange flex-shrink-0">&rarr;</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricCell({
  label,
  value,
  color,
  bar,
}: {
  label: string;
  value: string;
  color: string;
  bar?: number;
}) {
  return (
    <div className="bg-mata-card px-3 py-2.5">
      <div className="text-[9px] font-semibold text-mata-text-muted uppercase">{label}</div>
      <div className={`text-xs font-black ${color} mt-0.5`}>{value}</div>
      {bar != null && (
        <div className="h-1 rounded-full bg-mata-surface overflow-hidden mt-1">
          <div
            className="h-full rounded-full bg-mata-orange transition-all"
            style={{ width: `${Math.min(bar, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
