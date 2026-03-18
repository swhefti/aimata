'use client';

import { useState } from 'react';
import type { BasketPosition } from '@/types';
import AgentAvatar from '@/components/ui/AgentAvatar';

interface BasketPanelProps {
  positions: BasketPosition[];
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, weight: number) => void;
}

export default function BasketPanel({
  positions,
  onRemove,
  onWeightChange,
}: BasketPanelProps) {
  const [dragOver, setDragOver] = useState(false);

  const totalWeight = positions.reduce(
    (sum, p) => sum + (p.manual_weight ?? p.target_weight),
    0
  );

  const weightOverflow = totalWeight > 100;

  return (
    <section
      className={`rounded-2xl border bg-mata-card transition-all ${
        dragOver ? 'drag-over' : 'border-mata-border'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => setDragOver(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mata-border px-5 py-4">
        <div className="flex items-center gap-3">
          <AgentAvatar agentName="Paul" size="md" />
          <div>
            <h2 className="text-lg font-black text-mata-text tracking-tight">
              Your Basket
            </h2>
            <p className="text-xs text-mata-text-muted">
              {positions.length} position{positions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Total weight badge */}
        <div
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            weightOverflow
              ? 'bg-mata-red/10 text-mata-red'
              : 'bg-mata-green/10 text-mata-green'
          }`}
        >
          {totalWeight.toFixed(1)}% allocated
        </div>
      </div>

      {/* Table */}
      {positions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mata-border text-left text-[11px] font-semibold uppercase tracking-wider text-mata-text-muted">
                <th className="px-5 py-3">Ticker</th>
                <th className="px-3 py-3">Weight %</th>
                <th className="px-3 py-3 text-right">Entry</th>
                <th className="px-3 py-3 text-right">Current</th>
                <th className="px-3 py-3 text-right">P&L</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const weight = pos.manual_weight ?? pos.target_weight;
                const pnlPositive = pos.pnl >= 0;

                return (
                  <tr
                    key={pos.ticker}
                    className="border-b border-mata-border/50 transition-colors hover:bg-mata-surface/50"
                  >
                    {/* Ticker + name */}
                    <td className="px-5 py-3">
                      <div>
                        <span className="font-bold text-mata-text">
                          {pos.ticker}
                        </span>
                        <p className="truncate text-[11px] text-mata-text-muted max-w-[120px]">
                          {pos.asset_name}
                        </p>
                      </div>
                    </td>

                    {/* Weight input */}
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={weight}
                        onChange={(e) =>
                          onWeightChange(pos.ticker, parseFloat(e.target.value) || 0)
                        }
                        className="w-16 rounded-lg border border-mata-border bg-mata-surface px-2 py-1 text-xs font-bold text-mata-text text-center focus:border-mata-orange focus:outline-none focus:ring-1 focus:ring-mata-orange/30"
                      />
                    </td>

                    {/* Entry price */}
                    <td className="px-3 py-3 text-right font-mono text-xs text-mata-text-secondary">
                      ${pos.entry_price.toFixed(2)}
                    </td>

                    {/* Current price */}
                    <td className="px-3 py-3 text-right font-mono text-xs font-bold text-mata-text">
                      ${pos.current_price.toFixed(2)}
                    </td>

                    {/* P&L */}
                    <td className="px-3 py-3 text-right">
                      <div
                        className={`text-xs font-bold ${
                          pnlPositive ? 'text-mata-green' : 'text-mata-red'
                        }`}
                      >
                        {pnlPositive ? '+' : ''}
                        {pos.pnl_pct.toFixed(2)}%
                      </div>
                      <div
                        className={`text-[10px] ${
                          pnlPositive ? 'text-mata-green/70' : 'text-mata-red/70'
                        }`}
                      >
                        {pnlPositive ? '+' : ''}${pos.pnl.toFixed(2)}
                      </div>
                    </td>

                    {/* Remove button */}
                    <td className="px-3 py-3">
                      <button
                        onClick={() => onRemove(pos.ticker)}
                        className="rounded-lg p-1.5 text-mata-text-muted transition-colors hover:bg-mata-red/10 hover:text-mata-red"
                        title="Remove from basket"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-8">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mata-surface text-xl">
            📦
          </div>
          <p className="text-sm font-semibold text-mata-text-secondary">
            Basket is empty
          </p>
          <p className="mt-1 text-xs text-mata-text-muted text-center">
            Add opportunities from Mark&apos;s scanner to build your basket
          </p>
        </div>
      )}
    </section>
  );
}
