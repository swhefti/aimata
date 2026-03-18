'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import Sparkline from '@/components/ui/Sparkline';
import type { BasketPosition } from '@/types';
import { type PositionSignal, getActionStyle } from '@/lib/scoring/actions';

interface BasketPanelProps {
  positions: BasketPosition[];
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, weight: number) => void;
  isOver?: boolean;
  priceHistories?: Record<string, number[]>;
  signals?: PositionSignal[];
}

export default function BasketPanel({
  positions,
  onRemove,
  onWeightChange,
  isOver,
  priceHistories,
  signals,
}: BasketPanelProps) {
  const totalWeight = positions.reduce(
    (sum, p) => sum + (p.manual_weight ?? p.target_weight),
    0
  );
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.current_price * p.quantity, 0);

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
            <div>
              <h2 className="text-sm font-black text-mata-text tracking-tight">Your Basket</h2>
              <p className="text-[10px] text-mata-text-muted">
                {positions.length} position{positions.length !== 1 ? 's' : ''}
                {totalValue > 0 && (
                  <span className="ml-2">
                    · ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
              </p>
            </div>
          </div>
          {positions.length > 0 && (
            <div className={`text-sm font-black ${totalPnl >= 0 ? 'text-mata-green' : 'text-mata-red'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Positions */}
      <div className="px-3 pb-3">
        {positions.length === 0 ? (
          <div className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${
            isOver ? 'border-mata-orange bg-mata-orange/5' : 'border-mata-border'
          }`}>
            <div className="text-2xl mb-2">{isOver ? '\u2B07\uFE0F' : '\uD83C\uDFAF'}</div>
            <p className="text-xs font-semibold text-mata-text-secondary">
              {isOver ? 'Drop to add!' : 'Drag opportunities here'}
            </p>
            <p className="text-[10px] text-mata-text-muted mt-1">
              Build your basket by dragging cards from the scanner
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {positions.map((pos) => {
              const signal = signals?.find(s => s.ticker === pos.ticker);
              return (
                <BasketPositionRow
                  key={pos.ticker}
                  position={pos}
                  onRemove={onRemove}
                  onWeightChange={onWeightChange}
                  sparkData={priceHistories?.[pos.ticker]}
                  signal={signal}
                />
              );
            })}

            {/* Drop zone hint when dragging */}
            {isOver && (
              <div className="rounded-lg border-2 border-dashed border-mata-orange bg-mata-orange/5 py-3 text-center">
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
                  className={`h-full rounded-full transition-all duration-300 ${
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

function BasketPositionRow({
  position: p,
  onRemove,
  onWeightChange,
  sparkData,
  signal,
}: {
  position: BasketPosition;
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, weight: number) => void;
  sparkData?: number[];
  signal?: PositionSignal;
}) {
  const [editing, setEditing] = useState(false);
  const [weightVal, setWeightVal] = useState(
    String(p.manual_weight ?? p.target_weight)
  );
  const pnlColor = p.pnl >= 0 ? 'text-mata-green' : 'text-mata-red';
  const effectiveWeight = p.manual_weight ?? p.target_weight;

  function handleWeightSubmit() {
    const parsed = parseFloat(weightVal);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onWeightChange(p.ticker, parsed);
    }
    setEditing(false);
  }

  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-mata-surface/80 transition-colors">
      {/* Ticker + name */}
      <div className="min-w-0 flex-shrink-0 w-16">
        <div className="text-xs font-black text-mata-text">{p.ticker}</div>
        <div className="text-[9px] text-mata-text-muted truncate">{p.asset_name}</div>
      </div>

      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <Sparkline data={sparkData} width={44} height={18} strokeWidth={1} />
      )}

      {/* Weight */}
      <div className="flex-shrink-0 w-14">
        {editing ? (
          <input
            type="number"
            value={weightVal}
            onChange={(e) => setWeightVal(e.target.value)}
            onBlur={handleWeightSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleWeightSubmit()}
            autoFocus
            className="w-full rounded border border-mata-orange bg-white px-1 py-0.5 text-[10px] font-bold text-mata-text text-center focus:outline-none"
            min={0}
            max={100}
            step={0.1}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full rounded bg-mata-surface px-1.5 py-0.5 text-[10px] font-bold text-mata-text-secondary hover:bg-mata-border transition-colors text-center"
            title="Click to edit weight"
          >
            {effectiveWeight.toFixed(1)}%
          </button>
        )}
      </div>

      {/* Rex's action signal */}
      {signal && (() => {
        const actionStyle = getActionStyle(signal.action);
        return (
          <div
            className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black ${actionStyle.bg} ${actionStyle.color}`}
            title={signal.reason}
          >
            {actionStyle.icon} {signal.action}
          </div>
        );
      })()}

      {/* Price + P&L */}
      <div className="flex-1 text-right min-w-0">
        <div className="text-[10px] font-semibold text-mata-text">
          ${p.current_price.toFixed(2)}
        </div>
        <div className={`text-[9px] font-bold ${pnlColor}`}>
          {p.pnl >= 0 ? '+' : ''}{p.pnl_pct.toFixed(1)}%
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(p.ticker)}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 rounded p-0.5 text-mata-text-muted hover:text-mata-red hover:bg-mata-red/10 transition-all"
        title="Remove from basket"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
