'use client';

import ScoreRing from '@/components/ui/ScoreRing';
import Badge from '@/components/ui/Badge';
import type { BasketAnalytics } from '@/types';

interface AnalyticsPanelProps {
  analytics: BasketAnalytics | null;
  loading?: boolean;
}

function probabilityLabel(score: number): { text: string; color: string } {
  if (score >= 75) return { text: 'Strong outlook', color: 'text-mata-green' };
  if (score >= 60) return { text: 'Favorable outlook', color: 'text-mata-green' };
  if (score >= 45) return { text: 'Mixed outlook', color: 'text-mata-yellow' };
  if (score >= 30) return { text: 'Weak outlook', color: 'text-mata-red' };
  return { text: 'Poor outlook', color: 'text-mata-red' };
}

function scoreWordLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Decent';
  if (score >= 40) return 'Below avg';
  return 'Weak';
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
  const probLabel = probabilityLabel(a.probability_score);

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-xs font-black text-mata-text tracking-tight uppercase">Basket Intelligence</h3>
      </div>

      {/* Probability Score — with clear explanation */}
      <div className="flex flex-col items-center py-3 border-b border-mata-border">
        <ScoreRing score={a.probability_score} size={72} label={scoreWordLabel(a.probability_score)} />
        <div className="flex items-center gap-1.5 mt-1">
          <Badge label={a.basket_quality} variant={
            a.basket_quality === 'Strong' ? 'run' : a.basket_quality === 'Good' ? 'swing' : a.basket_quality === 'Fair' ? 'medium' : 'high'
          } />
          <span className={`text-[10px] font-bold ${probLabel.color}`}>{probLabel.text}</span>
        </div>
        <p className="text-[9px] text-mata-text-muted mt-1.5 text-center px-4 leading-snug">
          How well-positioned this basket is for the next 3 months, based on setup quality, diversification, and risk balance.
        </p>
      </div>

      {/* Metrics grid — with timeframes and context */}
      <div className="grid grid-cols-2 gap-px bg-mata-border">
        <MetricCell
          label="Expected Upside"
          sublabel="over 3 months"
          value={`${a.expected_upside_min.toFixed(1)}% – ${a.expected_upside_max.toFixed(1)}%`}
          color="text-mata-green"
        />
        <MetricCell
          label="Downside Risk"
          sublabel="worst case, 3 months"
          value={`-${a.downside_risk.toFixed(1)}%`}
          color="text-mata-red"
        />
        <MetricCell
          label="Concentration"
          sublabel={a.concentration_risk === 'Low' ? 'well spread' : a.concentration_risk === 'Medium' ? 'slightly uneven' : 'too heavy on few names'}
          value={a.concentration_risk}
          color={a.concentration_risk === 'Low' ? 'text-mata-green' : a.concentration_risk === 'Medium' ? 'text-mata-yellow' : 'text-mata-red'}
        />
        <MetricCell
          label="Correlation"
          sublabel={a.correlation_risk === 'Low' ? 'positions move independently' : a.correlation_risk === 'Medium' ? 'some overlap' : 'positions move together'}
          value={a.correlation_risk}
          color={a.correlation_risk === 'Low' ? 'text-mata-green' : a.correlation_risk === 'Medium' ? 'text-mata-yellow' : 'text-mata-red'}
        />
        <MetricCell
          label="Crypto Allocation"
          sublabel={a.crypto_allocation > 30 ? 'above 30% guardrail' : 'within limits'}
          value={`${a.crypto_allocation.toFixed(1)}%`}
          color={a.crypto_allocation > 30 ? 'text-mata-red' : 'text-mata-text'}
          bar={a.crypto_allocation}
          barMax={50}
        />
        <MetricCell
          label="Largest Position"
          sublabel={a.largest_position_pct > 25 ? 'above 25% cap' : 'within cap'}
          value={`${a.largest_position_ticker} ${a.largest_position_pct.toFixed(1)}%`}
          color={a.largest_position_pct > 25 ? 'text-mata-red' : 'text-mata-text'}
        />
      </div>

      {/* Horizon mix */}
      <div className="px-4 py-3 border-t border-mata-border">
        <div className="text-[10px] font-bold text-mata-text-muted mb-2 uppercase">Horizon Mix</div>
        <div className="flex gap-1">
          {[
            { label: 'Hot Now', sublabel: '1-5 days', count: a.horizon_mix.hot_now, color: 'bg-mata-red' },
            { label: 'Swing', sublabel: '1-4 weeks', count: a.horizon_mix.swing, color: 'bg-mata-blue' },
            { label: 'Run', sublabel: '1-3 months', count: a.horizon_mix.run, color: 'bg-mata-green' },
          ].map((h) => {
            const total = a.horizon_mix.hot_now + a.horizon_mix.swing + a.horizon_mix.run;
            const pct = total > 0 ? (h.count / total) * 100 : 0;
            return (
              <div key={h.label} className="flex-1">
                <div className="h-2 rounded-full bg-mata-surface overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${h.color}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[9px] text-mata-text-muted text-center">{h.label} ({h.count})</div>
                <div className="text-[7px] text-mata-text-muted/60 text-center">{h.sublabel}</div>
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
                <span className="text-mata-orange flex-shrink-0">→</span>
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
  sublabel,
  value,
  color,
  bar,
  barMax,
}: {
  label: string;
  sublabel?: string;
  value: string;
  color: string;
  bar?: number;
  barMax?: number;
}) {
  return (
    <div className="bg-mata-card px-3 py-2.5">
      <div className="text-[9px] font-semibold text-mata-text-muted uppercase">{label}</div>
      <div className={`text-xs font-black ${color} mt-0.5`}>{value}</div>
      {sublabel && (
        <div className="text-[7px] text-mata-text-muted/70 mt-0.5">{sublabel}</div>
      )}
      {bar != null && (
        <div className="h-1 rounded-full bg-mata-surface overflow-hidden mt-1">
          <div
            className="h-full rounded-full bg-mata-orange transition-all"
            style={{ width: `${Math.min((bar / (barMax ?? 100)) * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
