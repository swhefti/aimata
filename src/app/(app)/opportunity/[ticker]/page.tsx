'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import type { OpportunityScore, AgentName } from '@/types';
import AgentCommentary from '@/components/agents/AgentCommentary';
import AskAgent from '@/components/agents/AskAgent';

interface OpportunityDetail extends OpportunityScore {
  last_price?: number;
  daily_change?: number;
  pct_change?: number;
}

interface OpportunityDetailResponse {
  opportunity: OpportunityScore;
  price_history: Record<string, unknown>[];
  fundamentals: Record<string, unknown> | null;
  quote: { last_price: number; daily_change: number; pct_change: number } | null;
  commentary: { agent: string; commentary: string }[];
}

const SCORE_FIELDS = [
  { key: 'momentum_score', label: 'Momentum', color: 'bg-mata-orange' },
  { key: 'breakout_score', label: 'Breakout', color: 'bg-mata-yellow' },
  { key: 'mean_reversion_score', label: 'Mean Reversion', color: 'bg-mata-purple' },
  { key: 'catalyst_score', label: 'Catalyst', color: 'bg-mata-green' },
  { key: 'sentiment_score', label: 'Sentiment', color: 'bg-mata-blue' },
  { key: 'volatility_score', label: 'Volatility', color: 'bg-mata-red' },
  { key: 'regime_fit_score', label: 'Regime Fit', color: 'bg-mata-text-secondary' },
] as const;

function labelColor(label: string): string {
  switch (label) {
    case 'Hot Now':
      return 'bg-mata-red/10 text-mata-red border-mata-red/20';
    case 'Swing':
      return 'bg-mata-blue/10 text-mata-blue border-mata-blue/20';
    case 'Run':
      return 'bg-mata-green/10 text-mata-green border-mata-green/20';
    default:
      return 'bg-mata-surface text-mata-text-secondary border-mata-border';
  }
}

function riskColor(label: string): string {
  switch (label) {
    case 'Low':
      return 'text-mata-green';
    case 'Medium':
      return 'text-mata-yellow';
    case 'High':
      return 'text-mata-red';
    default:
      return 'text-mata-text-secondary';
  }
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-mata-surface" />
        <div className="h-6 w-40 rounded bg-mata-surface" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-mata-border bg-mata-card p-6 space-y-4">
          <div className="h-8 w-24 rounded bg-mata-surface" />
          <div className="h-5 w-48 rounded bg-mata-surface" />
          <div className="h-32 w-full rounded-xl bg-mata-surface" />
        </div>
        <div className="rounded-2xl border border-mata-border bg-mata-card p-6 space-y-4">
          <div className="h-8 w-32 rounded bg-mata-surface" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-mata-surface" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-mata-border bg-mata-card"
          />
        ))}
      </div>
    </div>
  );
}

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = use(params);
  const router = useRouter();
  const [data, setData] = useState<OpportunityDetail | null>(null);
  const [commentaryData, setCommentaryData] = useState<{ agent: string; commentary: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/opportunity/${ticker}`);
        if (!res.ok) throw new Error('Failed to fetch opportunity');
        const json: OpportunityDetailResponse = await res.json();
        // Merge opportunity data with quote info
        const merged: OpportunityDetail = {
          ...json.opportunity,
          last_price: json.quote?.last_price,
          daily_change: json.quote?.daily_change,
          pct_change: json.quote?.pct_change,
        };
        setData(merged);
        setCommentaryData(json.commentary ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [ticker]);

  async function handleAddToBasket() {
    if (!data) return;
    setAdding(true);
    try {
      const res = await fetch('/api/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: data.ticker,
          asset_name: data.asset_name,
          asset_type: data.asset_type,
          opportunity_score: data.opportunity_score,
          risk_label: data.risk_label,
          setup_type: data.setup_type,
        }),
      });

      if (res.ok) {
        setAdded(true);
      }
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mata-red/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-mata-red"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-lg font-black text-mata-text">
          Could not load opportunity
        </h2>
        <p className="mt-1 text-sm text-mata-text-muted">
          {error || `No data found for ${ticker}`}
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-5 rounded-xl bg-mata-surface px-5 py-2 text-sm font-semibold text-mata-text-secondary hover:bg-mata-border transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-mata-surface border border-mata-border text-mata-text-secondary hover:bg-mata-border hover:text-mata-text transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-black text-mata-text tracking-tight">
            {data.ticker}
          </h1>
          <p className="text-sm text-mata-text-muted">{data.asset_name}</p>
        </div>
      </div>

      {/* Top row: Price + Setup */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Price snapshot */}
        <div className="rounded-2xl border border-mata-border bg-mata-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-4">
            Price Snapshot
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-mata-text">
              ${data.last_price?.toFixed(2) ?? '--'}
            </span>
            {data.pct_change !== undefined && (
              <span
                className={`text-sm font-bold ${
                  data.pct_change >= 0 ? 'text-mata-green' : 'text-mata-red'
                }`}
              >
                {data.pct_change >= 0 ? '+' : ''}
                {data.pct_change.toFixed(2)}%
              </span>
            )}
          </div>
          {data.daily_change !== undefined && (
            <p className="mt-1 text-xs text-mata-text-muted">
              {data.daily_change >= 0 ? '+' : ''}${data.daily_change.toFixed(2)}{' '}
              today
            </p>
          )}
          {/* Chart placeholder */}
          <div className="mt-5 flex h-32 items-center justify-center rounded-xl border border-dashed border-mata-border bg-mata-surface/50">
            <span className="text-xs font-medium text-mata-text-muted">
              Chart coming soon
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[11px] font-medium text-mata-text-muted">
              Sector:
            </span>
            <span className="text-xs font-bold text-mata-text">
              {data.sector ?? 'N/A'}
            </span>
            <span className="mx-1 text-mata-border">|</span>
            <span className="text-[11px] font-medium text-mata-text-muted">
              Type:
            </span>
            <span className="text-xs font-bold text-mata-text capitalize">
              {data.asset_type}
            </span>
          </div>
        </div>

        {/* Setup summary */}
        <div className="rounded-2xl border border-mata-border bg-mata-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-4">
            Setup Summary
          </h3>

          {/* Score ring */}
          <div className="flex items-center gap-5 mb-5">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-mata-surface"
                />
                <path
                  d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${data.opportunity_score}, 100`}
                  strokeLinecap="round"
                  className="text-mata-orange"
                />
              </svg>
              <span className="absolute text-xl font-black text-mata-text">
                {data.opportunity_score}
              </span>
            </div>
            <div>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${labelColor(
                  data.opportunity_label
                )}`}
              >
                {data.opportunity_label}
              </span>
              <p className="mt-2 text-sm font-semibold text-mata-text">
                {data.setup_type}
              </p>
              <p className={`text-xs font-bold ${riskColor(data.risk_label)}`}>
                {data.risk_label} Risk
              </p>
            </div>
          </div>

          {/* Hold horizon */}
          <div className="rounded-xl bg-mata-surface/50 border border-mata-border/50 px-4 py-3">
            <span className="text-xs font-medium text-mata-text-muted">
              Suggested Hold Horizon
            </span>
            <p className="text-sm font-bold text-mata-text mt-0.5">
              {data.horizon_days} day{data.horizon_days !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Explanation */}
          {data.explanation && (
            <p className="mt-4 text-sm leading-relaxed text-mata-text-secondary">
              {data.explanation}
            </p>
          )}
        </div>
      </div>

      {/* Signal breakdown */}
      <div className="rounded-2xl border border-mata-border bg-mata-card p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-5">
          Signal Breakdown
        </h3>
        <div className="space-y-3">
          {SCORE_FIELDS.map(({ key, label, color }) => {
            const value = data[key] as number;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-semibold text-mata-text-secondary">
                  {label}
                </span>
                <div className="flex-1 h-3 rounded-full bg-mata-surface overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-700`}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-bold text-mata-text">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent commentary */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-4">
          Agent Commentary
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {commentaryData.length > 0 ? (
            commentaryData.map((c) => (
              <AgentCommentary
                key={c.agent}
                agentName={c.agent as AgentName}
                commentary={c.commentary}
              />
            ))
          ) : (
            <>
              <AgentCommentary
                agentName="Mark"
                commentary={`Opportunity score ${data.opportunity_score}/100. Setup type: ${data.setup_type}. ${data.explanation || ''}`}
              />
              <AgentCommentary
                agentName="Nia"
                commentary={`Sentiment score at ${data.sentiment_score}/100. Volume and market mood ${
                  data.sentiment_score >= 60
                    ? 'are supportive of this move'
                    : 'suggest caution on timing'
                }. Catalyst score: ${data.catalyst_score}/100.`}
              />
              <AgentCommentary
                agentName="Rex"
                commentary={`${
                  data.opportunity_score >= 70
                    ? 'Strong setup — consider adding to basket.'
                    : data.opportunity_score >= 50
                    ? 'Decent setup but watch for confirmation.'
                    : 'Weak setup — patience recommended.'
                } Risk is ${data.risk_label.toLowerCase()}. Suggested hold: ${data.horizon_days} days.`}
              />
            </>
          )}
        </div>
      </div>

      {/* Ask the team about this ticker */}
      <div className="px-6 pb-2">
        <AskAgent
          subjectType="ticker"
          subjectId={ticker}
          placeholder={`Ask about ${ticker}...`}
          suggestions={[
            'Why is this setup strong?',
            'Is this supported by fundamentals?',
            'Should I add this to my basket?',
          ]}
        />
      </div>

      {/* Add to Basket CTA */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={handleAddToBasket}
          disabled={adding || added}
          className={`flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold transition-all active:scale-[0.97] ${
            added
              ? 'bg-mata-green/10 text-mata-green border border-mata-green/20 cursor-default'
              : 'bg-gradient-to-r from-mata-orange to-mata-orange-dark text-white hover:shadow-lg hover:shadow-mata-orange/20 disabled:opacity-50'
          }`}
        >
          {added ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Added to Basket
            </>
          ) : adding ? (
            'Adding...'
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add to Basket
            </>
          )}
        </button>
      </div>
    </div>
  );
}
