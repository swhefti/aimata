'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BasketPosition, BasketAnalytics } from '@/types';
import BasketPanel from '@/components/basket/BasketPanel';
import AnalyticsPanel from '@/components/basket/AnalyticsPanel';

export default function BasketPage() {
  const [positions, setPositions] = useState<BasketPosition[]>([]);
  const [analytics, setAnalytics] = useState<BasketAnalytics | null>(null);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const fetchBasket = useCallback(async () => {
    setLoadingPositions(true);
    try {
      const res = await fetch('/api/basket');
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingPositions(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/basket/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    fetchBasket();
    fetchAnalytics();
  }, [fetchBasket, fetchAnalytics]);

  const handleRemove = useCallback(
    async (ticker: string) => {
      try {
        const res = await fetch(`/api/basket?ticker=${ticker}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          await Promise.all([fetchBasket(), fetchAnalytics()]);
        }
      } catch {
        // silent
      }
    },
    [fetchBasket, fetchAnalytics]
  );

  const handleWeightChange = useCallback(
    async (ticker: string, weight: number) => {
      try {
        const res = await fetch('/api/basket/weight', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker, manual_weight: weight }),
        });
        if (res.ok) {
          await Promise.all([fetchBasket(), fetchAnalytics()]);
        }
      } catch {
        // silent
      }
    },
    [fetchBasket, fetchAnalytics]
  );

  // Calculate total P&L
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalEntryValue = positions.reduce(
    (sum, p) => sum + p.entry_price * p.quantity,
    0
  );
  const totalPnlPct = totalEntryValue > 0 ? (totalPnl / totalEntryValue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-mata-text tracking-tight">
          Basket
        </h1>
        <p className="text-sm text-mata-text-muted mt-0.5">
          Manage your positions and monitor basket health
        </p>
      </div>

      {/* Summary stats */}
      {!loadingPositions && positions.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-mata-border bg-mata-card p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mata-text-muted">
              Positions
            </span>
            <p className="mt-1 text-2xl font-black text-mata-text">
              {positions.length}
            </p>
          </div>
          <div className="rounded-2xl border border-mata-border bg-mata-card p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mata-text-muted">
              Total P&L
            </span>
            <p
              className={`mt-1 text-2xl font-black ${
                totalPnl >= 0 ? 'text-mata-green' : 'text-mata-red'
              }`}
            >
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-mata-border bg-mata-card p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mata-text-muted">
              P&L %
            </span>
            <p
              className={`mt-1 text-2xl font-black ${
                totalPnlPct >= 0 ? 'text-mata-green' : 'text-mata-red'
              }`}
            >
              {totalPnlPct >= 0 ? '+' : ''}
              {totalPnlPct.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-2xl border border-mata-border bg-mata-card p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mata-text-muted">
              Quality
            </span>
            <p className="mt-1 text-2xl font-black text-mata-text">
              {analytics?.basket_quality ?? '--'}
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loadingPositions ? (
            <div className="animate-pulse rounded-2xl border border-mata-border bg-mata-card p-8">
              <div className="h-5 w-24 rounded bg-mata-surface mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 w-full rounded bg-mata-surface" />
                ))}
              </div>
            </div>
          ) : (
            <BasketPanel
              positions={positions}
              onRemove={handleRemove}
              onWeightChange={handleWeightChange}
            />
          )}
        </div>

        <div>
          <AnalyticsPanel analytics={analytics} loading={loadingAnalytics} />
        </div>
      </div>
    </div>
  );
}
