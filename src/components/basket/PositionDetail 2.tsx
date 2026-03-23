'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import ScoreBar from '@/components/ui/ScoreBar';
import Sparkline from '@/components/ui/Sparkline';
import AskAgent from '@/components/agents/AskAgent';
import type { BasketPosition } from '@/types';
import type { PositionSignal } from '@/lib/scoring/actions';
import { getActionStyle } from '@/lib/scoring/actions';

interface PositionDetailProps {
  position: BasketPosition;
  signal: PositionSignal | null;
  priceHistory?: number[];
  onClose: () => void;
  onRemove: (ticker: string) => void;
  onTrim?: (ticker: string) => void;
}

export default function PositionDetail({
  position: p,
  signal,
  priceHistory,
  onClose,
  onRemove,
  onTrim,
}: PositionDetailProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const pnlColor = p.pnl >= 0 ? 'text-mata-green' : 'text-mata-red';
  const actionStyle = signal ? getActionStyle(signal.action) : null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

      <div
        className="absolute right-0 top-0 h-full w-full max-w-md bg-mata-card border-l border-mata-border shadow-2xl overflow-y-auto animate-[slideInRight_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-mata-card border-b border-mata-border px-5 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-mata-text">{p.ticker}</h2>
              {actionStyle && signal && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${actionStyle.bg} ${actionStyle.color}`}>
                  {actionStyle.icon} {signal.action}
                </span>
              )}
            </div>
            <p className="text-xs text-mata-text-muted">{p.asset_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-mata-text-muted hover:text-mata-text hover:bg-mata-surface transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Price & P&L */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-black text-mata-text">${p.current_price.toFixed(2)}</div>
              <div className={`text-sm font-bold ${pnlColor}`}>
                {p.pnl >= 0 ? '+' : ''}{p.pnl_pct.toFixed(2)}% ({p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)})
              </div>
            </div>
            <div className="text-right text-[10px] text-mata-text-muted">
              <div>Entry: ${p.entry_price.toFixed(2)}</div>
              <div>Qty: {p.quantity}</div>
              <div>Weight: {(p.manual_weight ?? p.target_weight).toFixed(1)}%</div>
            </div>
          </div>

          {/* Chart */}
          {priceHistory && priceHistory.length > 1 && (
            <div className="bg-mata-surface/50 rounded-xl p-3">
              <Sparkline data={priceHistory} width={340} height={80} strokeWidth={2} fillOpacity={0.12} />
            </div>
          )}

          {/* Score Breakdown */}
          <div>
            <h3 className="text-[10px] font-black text-mata-text-muted uppercase tracking-wider mb-2">Opportunity Score: {p.opportunity_score}/100</h3>
            <div className="text-[9px] text-mata-text-muted mb-2">
              {p.setup_type} setup · {p.risk_label} risk
            </div>
          </div>

          {/* Rex Recommendation */}
          {signal && (
            <div className={`rounded-xl border px-4 py-3 ${
              signal.urgency === 'high' ? 'border-mata-red/30 bg-mata-red/5' : 'border-mata-border bg-mata-surface/30'
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <AgentAvatar agentName="Rex" size="xs" />
                <span className="text-[10px] font-black text-mata-text">Rex&apos;s Recommendation</span>
                {signal.urgency === 'high' && (
                  <span className="text-[8px] font-bold text-mata-red bg-mata-red/10 px-1.5 py-0.5 rounded">URGENT</span>
                )}
              </div>
              <p className="text-[11px] text-mata-text-secondary leading-relaxed">{signal.reason}</p>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                {(signal.action === 'Trim' || signal.action === 'Take Profit') && onTrim && (
                  <button
                    onClick={() => { onTrim(p.ticker); onClose(); }}
                    className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[10px] font-bold text-white hover:shadow-md transition-all"
                  >
                    ✂️ Trim 50%
                  </button>
                )}
                {!confirmRemove ? (
                  <button
                    onClick={() => setConfirmRemove(true)}
                    className="rounded-lg border border-mata-red/30 px-3 py-1.5 text-[10px] font-bold text-mata-red hover:bg-mata-red/5 transition-all"
                  >
                    Remove Position
                  </button>
                ) : (
                  <button
                    onClick={() => { onRemove(p.ticker); onClose(); }}
                    className="rounded-lg bg-mata-red px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-600 transition-all"
                  >
                    Confirm Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Ask about this position */}
          <div>
            <AskAgent
              subjectType="recommendation"
              subjectId={p.ticker}
              placeholder={`Ask about ${p.ticker}...`}
              suggestions={[
                `Should I hold ${p.ticker}?`,
                `Why is ${p.ticker} ${p.pnl_pct >= 0 ? 'up' : 'down'}?`,
                `What's the outlook for ${p.ticker}?`,
              ]}
            />
          </div>

          {/* View full detail link */}
          <a
            href={`/opportunity/${p.ticker}`}
            className="block text-center text-[10px] font-bold text-mata-orange hover:text-mata-orange-dark transition-colors"
          >
            View full opportunity detail →
          </a>
        </div>
      </div>
    </div>
  );
}
