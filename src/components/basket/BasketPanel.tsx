'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import Sparkline from '@/components/ui/Sparkline';
import DonutChart from '@/components/ui/DonutChart';
import ExplainDrawer from '@/components/agents/ExplainDrawer';
import type { BasketPosition, BasketAnalytics } from '@/types';
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
  analytics?: BasketAnalytics | null;
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
  analytics,
}: BasketPanelProps) {
  const [showIntel, setShowIntel] = useState(false);
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

      {/* ─── Portfolio overview: Donut with value + Probability + Invested ─── */}
      {positions.length > 0 && (
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-start justify-between gap-3">
            {/* Donut with current value inside */}
            <DonutChart
              segments={positions.map((p, i) => ({
                label: p.ticker,
                value: p.manual_weight ?? p.target_weight,
                color: ['#ff6b2b', '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'][i % 8],
              }))}
              size={110}
              strokeWidth={14}
            >
              <div className="text-center">
                <div className="text-xs font-black text-mata-text leading-tight">
                  ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[8px] font-bold leading-tight">
                  <AnimatedNumber value={totalPnlPct} suffix="%" decimals={1} colorize />
                </div>
              </div>
            </DonutChart>

            {/* 3-month probability gauge */}
            {analytics && (() => {
              const score = analytics.probability_score;
              const color = score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
              const pct = score / 100;
              const gaugeSize = 56;
              const gaugeStroke = 5;
              const gaugeR = (gaugeSize - gaugeStroke) / 2;
              const gaugeC = Math.PI * gaugeR; // semicircle
              return (
                <div className="flex flex-col items-center">
                  <svg width={gaugeSize} height={gaugeSize / 2 + 4} viewBox={`0 0 ${gaugeSize} ${gaugeSize / 2 + 4}`}>
                    {/* Background arc */}
                    <path
                      d={`M ${gaugeStroke / 2} ${gaugeSize / 2} A ${gaugeR} ${gaugeR} 0 0 1 ${gaugeSize - gaugeStroke / 2} ${gaugeSize / 2}`}
                      fill="none" stroke="#e8e6e1" strokeWidth={gaugeStroke} strokeLinecap="round"
                    />
                    {/* Filled arc */}
                    <path
                      d={`M ${gaugeStroke / 2} ${gaugeSize / 2} A ${gaugeR} ${gaugeR} 0 0 1 ${gaugeSize - gaugeStroke / 2} ${gaugeSize / 2}`}
                      fill="none" stroke={color} strokeWidth={gaugeStroke} strokeLinecap="round"
                      strokeDasharray={`${pct * gaugeC} ${gaugeC}`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="text-base font-black leading-none -mt-1" style={{ color }}>{score}</div>
                  <div className="text-[7px] font-semibold text-mata-text-muted">3m outlook</div>
                  <div className="text-[8px] text-mata-text-muted mt-1">
                    Invested: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[7px] text-mata-text-muted">{winners}W / {losers}L</div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {positions.length === 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <AgentAvatar agentName="Rex" size="sm" />
            <h2 className="text-sm font-black text-mata-text tracking-tight">Your Basket</h2>
          </div>
        </div>
      )}

      {/* ─── Collapsible Intelligence ─── */}
      {positions.length > 0 && (
        <div className="mx-3 mb-2">

          {/* Collapsible basket intelligence */}
          <button
            onClick={() => setShowIntel(!showIntel)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-[9px] font-bold text-mata-text-muted hover:text-mata-text transition-colors"
          >
            <span className="uppercase tracking-wider">
              Basket Intelligence
              {analytics && <span className="ml-1 text-mata-text-secondary">({analytics.basket_quality} · {analytics.probability_score}/100)</span>}
            </span>
            <span>{showIntel ? '▾' : '▸'}</span>
          </button>

          {showIntel && analytics && (
            <div className="rounded-lg bg-mata-surface/50 border border-mata-border/50 px-3 py-2 mb-2 animate-[slideInUp_0.15s_ease-out]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[9px]">
                <div>
                  <span className="text-mata-text-muted">Upside:</span>{' '}
                  <span className="font-bold text-mata-green">{analytics.expected_upside_min.toFixed(1)}% – {analytics.expected_upside_max.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-mata-text-muted">Downside:</span>{' '}
                  <span className="font-bold text-mata-red">-{analytics.downside_risk.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-mata-text-muted">Concentration:</span>{' '}
                  <span className={`font-bold ${analytics.concentration_risk === 'Low' ? 'text-mata-green' : analytics.concentration_risk === 'High' || analytics.concentration_risk === 'Critical' ? 'text-mata-red' : 'text-mata-yellow'}`}>{analytics.concentration_risk}</span>
                </div>
                <div>
                  <span className="text-mata-text-muted">Correlation:</span>{' '}
                  <span className={`font-bold ${analytics.correlation_risk === 'Low' ? 'text-mata-green' : analytics.correlation_risk === 'High' ? 'text-mata-red' : 'text-mata-yellow'}`}>{analytics.correlation_risk}</span>
                </div>
                <div>
                  <span className="text-mata-text-muted">Crypto:</span>{' '}
                  <span className={`font-bold ${analytics.crypto_allocation > 30 ? 'text-mata-red' : 'text-mata-text'}`}>{analytics.crypto_allocation.toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-mata-text-muted">Largest:</span>{' '}
                  <span className="font-bold text-mata-text">{analytics.largest_position_ticker} {analytics.largest_position_pct.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
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
