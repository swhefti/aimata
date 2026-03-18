'use client';

import type { BasketAnalytics } from '@/types';
import ScoreRing from '@/components/ui/ScoreRing';
import Badge from '@/components/ui/Badge';

interface AnalyticsPanelProps {
  analytics: BasketAnalytics | null;
  loading?: boolean;
}

function riskColor(level: string): string {
  switch (level) {
    case 'Low':
      return 'text-mata-green';
    case 'Medium':
      return 'text-mata-yellow';
    case 'High':
      return 'text-mata-red';
    case 'Critical':
      return 'text-mata-red';
    default:
      return 'text-mata-text-secondary';
  }
}

function qualityColor(quality: string): string {
  switch (quality) {
    case 'Strong':
      return 'bg-mata-green/10 text-mata-green border-mata-green/20';
    case 'Good':
      return 'bg-mata-blue/10 text-mata-blue border-mata-blue/20';
    case 'Fair':
      return 'bg-mata-yellow/10 text-mata-yellow border-mata-yellow/20';
    case 'Weak':
      return 'bg-mata-red/10 text-mata-red border-mata-red/20';
    default:
      return 'bg-mata-surface text-mata-text-secondary border-mata-border';
  }
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="mx-auto h-20 w-20 rounded-full bg-mata-surface" />
      <div className="h-4 w-3/4 rounded bg-mata-surface" />
      <div className="h-4 w-1/2 rounded bg-mata-surface" />
      <div className="h-4 w-2/3 rounded bg-mata-surface" />
      <div className="h-4 w-3/4 rounded bg-mata-surface" />
      <div className="h-4 w-1/2 rounded bg-mata-surface" />
    </div>
  );
}

function StatRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-medium text-mata-text-muted">{label}</span>
      <span className="text-sm font-bold text-mata-text">{children}</span>
    </div>
  );
}

export default function AnalyticsPanel({ analytics, loading }: AnalyticsPanelProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-mata-border bg-mata-card">
        <div className="border-b border-mata-border px-5 py-4">
          <h2 className="text-lg font-black text-mata-text tracking-tight">
            Basket Analytics
          </h2>
        </div>
        <Skeleton />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-2xl border border-mata-border bg-mata-card">
        <div className="border-b border-mata-border px-5 py-4">
          <h2 className="text-lg font-black text-mata-text tracking-tight">
            Basket Analytics
          </h2>
        </div>
        <div className="flex flex-col items-center py-12 px-6 text-center">
          <span className="text-2xl mb-2">📊</span>
          <p className="text-sm text-mata-text-muted">
            Add positions to your basket to see analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-mata-border bg-mata-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mata-border px-5 py-4">
        <h2 className="text-lg font-black text-mata-text tracking-tight">
          Basket Analytics
        </h2>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${qualityColor(
            analytics.basket_quality
          )}`}
        >
          {analytics.basket_quality}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Probability score - prominent */}
        <div className="flex flex-col items-center py-2">
          <ScoreRing
            score={analytics.probability_score}
            size={88}
            label="Probability"
          />
        </div>

        {/* Key metrics */}
        <div className="divide-y divide-mata-border/50">
          <StatRow label="Expected Upside">
            <span className="text-mata-green">
              +{analytics.expected_upside_min.toFixed(1)}% to +
              {analytics.expected_upside_max.toFixed(1)}%
            </span>
          </StatRow>

          <StatRow label="Downside Risk">
            <span className="text-mata-red">
              -{analytics.downside_risk.toFixed(1)}%
            </span>
          </StatRow>

          <StatRow label="Concentration Risk">
            <span className={`font-bold ${riskColor(analytics.concentration_risk)}`}>
              {analytics.concentration_risk}
            </span>
          </StatRow>

          <StatRow label="Correlation Risk">
            <span className={`font-bold ${riskColor(analytics.correlation_risk)}`}>
              {analytics.correlation_risk}
            </span>
          </StatRow>

          <StatRow label="Largest Position">
            <span>
              {analytics.largest_position_ticker}{' '}
              <span className="text-mata-text-muted font-medium">
                ({analytics.largest_position_pct.toFixed(1)}%)
              </span>
            </span>
          </StatRow>

          {/* Crypto allocation bar */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-mata-text-muted">
                Crypto Allocation
              </span>
              <span className="text-xs font-bold text-mata-text">
                {analytics.crypto_allocation.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-mata-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-mata-purple transition-all duration-500"
                style={{ width: `${Math.min(analytics.crypto_allocation, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Horizon mix */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mata-text-muted mb-2">
            Horizon Mix
          </h3>
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl bg-mata-red/5 border border-mata-red/10 p-2.5 text-center">
              <div className="text-lg font-black text-mata-red">
                {analytics.horizon_mix.hot_now}%
              </div>
              <div className="text-[10px] font-semibold text-mata-text-muted">
                Hot Now
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-mata-blue/5 border border-mata-blue/10 p-2.5 text-center">
              <div className="text-lg font-black text-mata-blue">
                {analytics.horizon_mix.swing}%
              </div>
              <div className="text-[10px] font-semibold text-mata-text-muted">
                Swing
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-mata-green/5 border border-mata-green/10 p-2.5 text-center">
              <div className="text-lg font-black text-mata-green">
                {analytics.horizon_mix.run}%
              </div>
              <div className="text-[10px] font-semibold text-mata-text-muted">
                Run
              </div>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {analytics.warnings.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mata-red mb-2">
              Warnings
            </h3>
            <ul className="space-y-1.5">
              {analytics.warnings.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-mata-red/5 border border-mata-red/10 px-3 py-2 text-xs text-mata-red"
                >
                  <span className="mt-0.5 shrink-0">&#9888;</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested actions */}
        {analytics.suggested_actions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mata-orange mb-2">
              Suggested Actions
            </h3>
            <ul className="space-y-1.5">
              {analytics.suggested_actions.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-mata-orange/5 border border-mata-orange/10 px-3 py-2 text-xs text-mata-text-secondary"
                >
                  <span className="mt-0.5 shrink-0 text-mata-orange">&#10148;</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
