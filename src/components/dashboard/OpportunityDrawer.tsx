'use client';

import { useState, useEffect } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import Sparkline from '@/components/ui/Sparkline';
import ScoreBar from '@/components/ui/ScoreBar';
import AskAgent from '@/components/agents/AskAgent';
import type { OpportunityScore } from '@/types';

interface OpportunityDrawerProps {
  ticker: string;
  onClose: () => void;
  onAdd: (ticker: string) => void;
}

interface DetailData {
  opportunity: OpportunityScore & { last_price?: number; pct_change?: number };
  price_history: { close: number }[];
  fundamentals: { pe_ratio?: number; revenue_growth_yoy?: number; profit_margin?: number; roe?: number } | null;
}

export default function OpportunityDrawer({ ticker, onClose, onAdd }: OpportunityDrawerProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/opportunity/${ticker}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  const o = data?.opportunity;
  const prices = data?.price_history?.map((p: { close: number }) => p.close) ?? [];
  const fund = data?.fundamentals;

  const scoreColor = (v: number) => v >= 70 ? 'text-mata-green' : v >= 50 ? 'text-mata-yellow' : 'text-mata-red';

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

      <div
        className="absolute right-0 top-0 h-full w-full max-w-md bg-mata-card border-l border-mata-border shadow-2xl overflow-y-auto animate-[slideInRight_0.25s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-6 animate-pulse space-y-4">
            <div className="h-6 w-24 rounded bg-mata-surface" />
            <div className="h-20 rounded bg-mata-surface" />
            <div className="h-4 w-full rounded bg-mata-surface" />
            <div className="h-4 w-3/4 rounded bg-mata-surface" />
          </div>
        ) : !o ? (
          <div className="p-6 text-center">
            <p className="text-sm text-mata-text-muted">Could not load data for {ticker}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-mata-card border-b border-mata-border px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-mata-text">{o.ticker}</h2>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                    o.opportunity_label === 'Hot Now' ? 'bg-red-100 text-red-600'
                    : o.opportunity_label === 'Run' ? 'bg-green-100 text-green-600'
                    : 'bg-blue-100 text-blue-600'
                  }`}>{o.opportunity_label}</span>
                </div>
                <p className="text-xs text-mata-text-muted">{o.asset_name}</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-mata-text-muted hover:text-mata-text hover:bg-mata-surface transition-all">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Price + Chart */}
              <div>
                {o.last_price != null && (
                  <div className="flex items-end gap-3 mb-2">
                    <span className="text-2xl font-black text-mata-text">${o.last_price.toFixed(2)}</span>
                    {o.pct_change != null && (
                      <span className={`text-sm font-bold ${o.pct_change >= 0 ? 'text-mata-green' : 'text-mata-red'}`}>
                        {o.pct_change >= 0 ? '+' : ''}{(o.pct_change * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
                {prices.length > 1 && (
                  <div className="bg-mata-surface/50 rounded-xl p-3">
                    <Sparkline data={prices} width={340} height={90} strokeWidth={2} fillOpacity={0.12} />
                  </div>
                )}
              </div>

              {/* Score */}
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-black ${scoreColor(o.opportunity_score)}`}>
                  {o.opportunity_score}
                </div>
                <div>
                  <div className="text-xs font-bold text-mata-text">{o.setup_type} setup</div>
                  <div className="text-[10px] text-mata-text-muted">{o.risk_label} risk · ~{o.horizon_days}d horizon</div>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black text-mata-text-muted uppercase tracking-wider">Score Breakdown</div>
                <ScoreBar label="Momentum" value={o.momentum_score} />
                <ScoreBar label="Breakout" value={o.breakout_score} />
                <ScoreBar label="Reversion" value={o.mean_reversion_score} />
                <ScoreBar label="Catalyst" value={o.catalyst_score} />
                <ScoreBar label="Sentiment" value={o.sentiment_score} />
                <ScoreBar label="Volatility" value={o.volatility_score} />
                <ScoreBar label="Regime Fit" value={o.regime_fit_score} />
              </div>

              {/* Explanation */}
              <div className="bg-mata-surface/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AgentAvatar agentName="Mark" size="xs" />
                  <span className="text-[10px] font-black text-mata-text">Mark&apos;s Take</span>
                </div>
                <p className="text-[11px] text-mata-text-secondary leading-relaxed">{o.explanation}</p>
              </div>

              {/* Fundamentals */}
              {fund && (
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {fund.pe_ratio != null && (
                    <div className="bg-mata-surface/30 rounded-lg px-3 py-2">
                      <span className="text-mata-text-muted">P/E</span>
                      <div className="font-bold text-mata-text">{fund.pe_ratio.toFixed(1)}</div>
                    </div>
                  )}
                  {fund.revenue_growth_yoy != null && (
                    <div className="bg-mata-surface/30 rounded-lg px-3 py-2">
                      <span className="text-mata-text-muted">Revenue Growth</span>
                      <div className="font-bold text-mata-text">{(fund.revenue_growth_yoy * 100).toFixed(1)}%</div>
                    </div>
                  )}
                  {fund.profit_margin != null && (
                    <div className="bg-mata-surface/30 rounded-lg px-3 py-2">
                      <span className="text-mata-text-muted">Margin</span>
                      <div className="font-bold text-mata-text">{(fund.profit_margin * 100).toFixed(1)}%</div>
                    </div>
                  )}
                  {fund.roe != null && (
                    <div className="bg-mata-surface/30 rounded-lg px-3 py-2">
                      <span className="text-mata-text-muted">ROE</span>
                      <div className="font-bold text-mata-text">{(fund.roe * 100).toFixed(1)}%</div>
                    </div>
                  )}
                </div>
              )}

              {/* Ask about this ticker */}
              <AskAgent
                subjectType="ticker"
                subjectId={ticker}
                placeholder={`Ask about ${ticker}...`}
                suggestions={[`Why is ${ticker} a ${o.opportunity_label}?`, `Is ${ticker} a good entry?`]}
              />

              {/* Add to basket */}
              <button
                onClick={() => { onAdd(ticker); onClose(); }}
                className="w-full rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark py-3 text-sm font-bold text-white hover:shadow-lg hover:shadow-mata-orange/20 transition-all active:scale-[0.98]"
              >
                + Add to Basket
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
