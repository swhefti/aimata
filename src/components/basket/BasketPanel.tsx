'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import Sparkline from '@/components/ui/Sparkline';
import ExplainDrawer from '@/components/agents/ExplainDrawer';
import type { BasketPosition } from '@/types';
import { type PositionSignal, getActionStyle } from '@/lib/scoring/actions';

interface BasketPanelProps {
  positions: BasketPosition[];
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, weight: number) => void;
  onTrim?: (ticker: string) => void;
  isOver?: boolean;
  priceHistories?: Record<string, number[]>;
  signals?: PositionSignal[];
  onPositionClick?: (ticker: string) => void;
}

export default function BasketPanel({
  positions,
  onRemove,
  onWeightChange,
  onTrim,
  isOver,
  priceHistories,
  signals,
  onPositionClick,
}: BasketPanelProps) {
  const totalWeight = positions.reduce(
    (sum, p) => sum + (p.manual_weight ?? p.target_weight),
    0
  );
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.current_price * p.quantity, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.entry_price * p.quantity, 0);
  const totalPnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const winners = positions.filter((p) => p.pnl_pct > 0).length;
  const losers = positions.filter((p) => p.pnl_pct < 0).length;

  return (
    <div
      className={`rounded-2xl border-2 transition-all duration-200 ${
        isOver
          ? 'border-mata-orange bg-mata-orange/5 shadow-lg shadow-mata-orange/10'
          : 'border-mata-orange/20 bg-mata-card'
      }`}
    >
      {/* Orange accent top bar */}
      <div className="h-1 rounded-t-2xl bg-gradient-to-r from-mata-orange to-mata-orange-light" />

      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AgentAvatar agentName="Paul" size="sm" />
            <h2 className="text-sm font-black text-mata-text tracking-tight">Your Basket</h2>
          </div>
          {positions.length > 0 && (
            <div className="text-[10px] text-mata-text-muted">
              {positions.length} position{positions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ─── Performance Summary Card ─── */}
      {positions.length > 0 && (
        <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-mata-surface to-mata-bg border border-mata-border p-3">
          <div className="flex items-center justify-between gap-2">
            {/* Invested → Value */}
            <div className="flex-1">
              <div className="text-[9px] font-semibold text-mata-text-muted uppercase tracking-wider">Current Value</div>
              <div className="text-lg font-black text-mata-text leading-tight">
                <AnimatedNumber value={totalValue} prefix="$" decimals={0} />
              </div>
              <div className="text-[9px] text-mata-text-muted mt-0.5">
                Invested: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>

            {/* P&L */}
            <div className="text-right">
              <div className="text-[9px] font-semibold text-mata-text-muted uppercase tracking-wider">Return</div>
              <div className="text-lg font-black leading-tight">
                <AnimatedNumber value={totalPnlPct} suffix="%" decimals={2} colorize />
              </div>
              <div className="text-[10px] font-bold">
                <AnimatedNumber value={totalPnl} prefix="$" decimals={2} colorize />
              </div>
            </div>

            {/* Win/Loss */}
            <div className="text-center">
              <div className="text-[9px] font-semibold text-mata-text-muted uppercase tracking-wider">W / L</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-sm font-black text-mata-green">{winners}</span>
                <span className="text-[10px] text-mata-text-muted">/</span>
                <span className="text-sm font-black text-mata-red">{losers}</span>
              </div>
            </div>
          </div>

          {/* Paul's one-liner based on state */}
          <div className="mt-2 pt-2 border-t border-mata-border/50">
            <p className="text-[10px] text-mata-text-secondary italic leading-snug">
              <span className="not-italic font-black text-blue-500">P:</span>{' '}
              {totalPnlPct > 5
                ? 'Basket is performing. Don\'t get greedy — check Rex\'s signals.'
                : totalPnlPct < -5
                ? 'Basket is hurting. Review each position — cut what isn\'t working.'
                : positions.length === 1
                ? 'Single position = single point of failure. Add more to diversify.'
                : 'Basket is steady. Keep monitoring and follow the plan.'
              }
            </p>
          </div>
        </div>
      )}

      {/* ─── Positions ─── */}
      <div className="px-3 pb-3">
        {positions.length === 0 ? (
          <div className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${
            isOver ? 'border-mata-orange bg-mata-orange/5' : 'border-mata-border'
          }`}>
            <div className="text-2xl mb-2">{isOver ? '⬇️' : '🎯'}</div>
            <p className="text-xs font-semibold text-mata-text-secondary">
              {isOver ? 'Drop to add!' : 'Drag opportunities here'}
            </p>
            <p className="text-[10px] text-mata-text-muted mt-1">
              Build your basket by dragging cards from the scanner
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {positions.map((pos) => {
              const signal = signals?.find((s) => s.ticker === pos.ticker);
              return (
                <BasketPositionRow
                  key={pos.ticker}
                  position={pos}
                  onRemove={onRemove}
                  onWeightChange={onWeightChange}
                  onTrim={onTrim}
                  sparkData={priceHistories?.[pos.ticker]}
                  signal={signal}
                  onClick={onPositionClick}
                />
              );
            })}

            {/* Drop zone hint when dragging */}
            {isOver && (
              <div className="rounded-lg border-2 border-dashed border-mata-orange bg-mata-orange/5 py-3 text-center animate-[slideInUp_0.2s_ease-out]">
                <span className="text-[10px] font-bold text-mata-orange">Drop to add to basket</span>
              </div>
            )}

            {/* Total weight bar */}
            <div className="mt-3 pt-3 border-t border-mata-border">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-semibold text-mata-text-secondary">Total Weight</span>
                <span className={`font-black ${
                  Math.abs(totalWeight - 100) < 1 ? 'text-mata-green' : 'text-mata-yellow'
                }`}>
                  {totalWeight.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-mata-surface overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    Math.abs(totalWeight - 100) < 1 ? 'bg-mata-green' : totalWeight > 100 ? 'bg-mata-red' : 'bg-mata-orange'
                  }`}
                  style={{ width: `${Math.min(totalWeight, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Position Row with Rex Actions ───

function BasketPositionRow({
  position: p,
  onRemove,
  onWeightChange,
  onTrim,
  sparkData,
  signal,
  onClick,
}: {
  position: BasketPosition;
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, weight: number) => void;
  onTrim?: (ticker: string) => void;
  sparkData?: number[];
  signal?: PositionSignal;
  onClick?: (ticker: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [weightVal, setWeightVal] = useState(
    String(p.manual_weight ?? p.target_weight)
  );
  const [showActions, setShowActions] = useState(false);
  const pnlColor = p.pnl >= 0 ? 'text-mata-green' : 'text-mata-red';
  const effectiveWeight = p.manual_weight ?? p.target_weight;
  const isUrgent = signal?.urgency === 'high';

  function handleWeightSubmit() {
    const parsed = parseFloat(weightVal);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onWeightChange(p.ticker, parsed);
    }
    setEditing(false);
  }

  return (
    <div className={`rounded-lg transition-all ${isUrgent ? 'animate-[pulseUrgent_2s_ease-in-out_infinite]' : ''}`}>
      {/* Main row */}
      <div className="group flex items-center gap-1.5 px-2 py-1.5 hover:bg-mata-surface/80 transition-colors rounded-lg">
        {/* Ticker + name — clickable for detail */}
        <button
          className="min-w-0 flex-shrink-0 w-14 text-left hover:text-mata-orange transition-colors"
          onClick={() => onClick?.(p.ticker)}
          title="View position detail"
        >
          <div className="text-xs font-black">{p.ticker}</div>
          <div className="text-[8px] text-mata-text-muted truncate">{p.asset_name}</div>
        </button>

        {/* Sparkline */}
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} width={36} height={16} strokeWidth={1} />
        )}

        {/* Weight */}
        <div className="flex-shrink-0 w-12">
          {editing ? (
            <input
              type="number"
              value={weightVal}
              onChange={(e) => setWeightVal(e.target.value)}
              onBlur={handleWeightSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleWeightSubmit()}
              autoFocus
              className="w-full rounded border border-mata-orange bg-white px-1 py-0.5 text-[9px] font-bold text-mata-text text-center focus:outline-none"
              min={0}
              max={100}
              step={0.1}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-full rounded bg-mata-surface px-1 py-0.5 text-[9px] font-bold text-mata-text-secondary hover:bg-mata-border transition-colors text-center"
              title="Click to edit weight"
            >
              {effectiveWeight.toFixed(1)}%
            </button>
          )}
        </div>

        {/* Rex's action signal — clickable to reveal actions */}
        {signal && (() => {
          const actionStyle = getActionStyle(signal.action);
          return (
            <button
              onClick={() => setShowActions(!showActions)}
              className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[7px] font-black transition-all hover:scale-105 ${actionStyle.bg} ${actionStyle.color} ${
                isUrgent ? 'ring-1 ring-current/30' : ''
              }`}
              title={signal.reason}
            >
              {actionStyle.icon} {signal.action}
            </button>
          );
        })()}

        {/* Price + P&L */}
        <div className="flex-1 text-right min-w-0">
          <div className="text-[9px] font-semibold text-mata-text">
            ${p.current_price.toFixed(2)}
          </div>
          <div className={`text-[8px] font-bold ${pnlColor}`}>
            {p.pnl >= 0 ? '+' : ''}{p.pnl_pct.toFixed(1)}%
          </div>
        </div>

        {/* Remove */}
        <button
          onClick={() => onRemove(p.ticker)}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 rounded p-0.5 text-mata-text-muted hover:text-mata-red hover:bg-mata-red/10 transition-all"
          title="Remove from basket"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ─── Expanded action row (Rex's recommendation) ─── */}
      {showActions && signal && (
        <div className="px-2 pb-2 animate-[slideInUp_0.15s_ease-out]">
          <div className="rounded-lg bg-mata-surface/60 border border-mata-border/50 px-3 py-2">
            {/* Rex's reasoning */}
            <div className="flex items-start gap-1.5 mb-2">
              <AgentAvatar agentName="Rex" size="xs" />
              <p className="text-[9px] text-mata-text-secondary leading-snug flex-1">
                {signal.reason}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5">
              {(signal.action === 'Trim' || signal.action === 'Take Profit') && (
                <button
                  onClick={() => { onTrim?.(p.ticker); setShowActions(false); }}
                  className="flex-1 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-1.5 text-[9px] font-bold text-white hover:shadow-md transition-all active:scale-[0.97]"
                >
                  ✂️ Trim 50%
                </button>
              )}
              {(signal.action === 'Exit' || signal.action === 'Take Profit') && (
                <button
                  onClick={() => { onRemove(p.ticker); setShowActions(false); }}
                  className="flex-1 rounded-md bg-gradient-to-r from-red-500 to-rose-600 px-2 py-1.5 text-[9px] font-bold text-white hover:shadow-md transition-all active:scale-[0.97]"
                >
                  🚪 Close Position
                </button>
              )}
              {(signal.action === 'Add' || signal.action === 'Strong Buy') && (
                <button
                  onClick={() => setShowActions(false)}
                  className="flex-1 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 px-2 py-1.5 text-[9px] font-bold text-white hover:shadow-md transition-all active:scale-[0.97]"
                >
                  ➕ Add More
                </button>
              )}
              {signal.action === 'Watch' && (
                <div className="flex-1 text-center text-[9px] text-amber-600 font-semibold py-1.5">
                  👀 Monitoring — no action needed yet
                </div>
              )}
              {signal.action === 'Hold' && (
                <div className="flex-1 text-center text-[9px] text-blue-600 font-semibold py-1.5">
                  ✊ Stay the course
                </div>
              )}
              <button
                onClick={() => setShowActions(false)}
                className="rounded-md px-2 py-1.5 text-[9px] font-bold text-mata-text-muted bg-mata-surface hover:bg-mata-border transition-all"
              >
                ✕
              </button>
            </div>

            {/* Rex: deeper explanation */}
            <div className="mt-2 pt-2 border-t border-mata-border/30">
              <ExplainDrawer
                type="action"
                ticker={p.ticker}
                agent="Rex"
                label="Ask Rex why"
                deterministicData={[
                  { label: 'Score', value: `${p.opportunity_score}/100` },
                  { label: 'P&L', value: `${p.pnl_pct >= 0 ? '+' : ''}${p.pnl_pct.toFixed(1)}%`, color: p.pnl_pct >= 0 ? 'text-mata-green' : 'text-mata-red' },
                  { label: 'Risk', value: p.risk_label },
                  { label: 'Action', value: signal.action },
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
