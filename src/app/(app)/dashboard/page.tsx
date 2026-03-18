'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { OpportunityScore, BasketPosition, BasketAnalytics } from '@/types';
import OpportunityFeed from '@/components/dashboard/OpportunityFeed';
import BasketPanel from '@/components/basket/BasketPanel';
import AnalyticsPanel from '@/components/basket/AnalyticsPanel';
import DailyBrief from '@/components/dashboard/DailyBrief';

type OpportunityWithPrice = OpportunityScore & {
  last_price?: number;
  daily_change?: number;
  pct_change?: number;
};

function DroppableBasketWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'basket-droppable' });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 rounded-2xl ${
        isOver ? 'ring-2 ring-mata-orange ring-offset-2 ring-offset-mata-bg' : ''
      }`}
    >
      {children}
    </div>
  );
}

function DraggableOpportunityWrapper({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`transition-opacity ${isDragging ? 'opacity-40' : ''}`}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
}

// Loading skeleton for the feed
function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-mata-border bg-mata-card p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-mata-surface" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-20 rounded bg-mata-surface" />
              <div className="h-3 w-32 rounded bg-mata-surface" />
            </div>
          </div>
          <div className="h-3 w-full rounded bg-mata-surface" />
          <div className="h-3 w-3/4 rounded bg-mata-surface mt-2" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<OpportunityWithPrice[]>([]);
  const [positions, setPositions] = useState<BasketPosition[]>([]);
  const [analytics, setAnalytics] = useState<BasketAnalytics | null>(null);
  const [brief, setBrief] = useState<{
    content: string;
    agent_name: string;
    created_at: string;
  } | null>(null);

  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingBasket, setLoadingBasket] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingBrief, setLoadingBrief] = useState(true);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Fetchers
  const fetchOpportunities = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const res = await fetch('/api/opportunities');
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  const fetchBasket = useCallback(async () => {
    setLoadingBasket(true);
    try {
      const res = await fetch('/api/basket');
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingBasket(false);
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

  const fetchBrief = useCallback(async () => {
    setLoadingBrief(true);
    try {
      const res = await fetch('/api/brief');
      if (res.ok) {
        const data = await res.json();
        setBrief(data.brief ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoadingBrief(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOpportunities();
    fetchBasket();
    fetchAnalytics();
    fetchBrief();
  }, [fetchOpportunities, fetchBasket, fetchAnalytics, fetchBrief]);

  // Actions
  const handleAddToBasket = useCallback(
    async (ticker: string) => {
      const opp = opportunities.find((o) => o.ticker === ticker);
      if (!opp) return;

      try {
        const res = await fetch('/api/basket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: opp.ticker,
            asset_name: opp.asset_name,
            asset_type: opp.asset_type,
            opportunity_score: opp.opportunity_score,
            risk_label: opp.risk_label,
            setup_type: opp.setup_type,
          }),
        });

        if (res.ok) {
          await Promise.all([fetchBasket(), fetchAnalytics()]);
        }
      } catch {
        // silent
      }
    },
    [opportunities, fetchBasket, fetchAnalytics]
  );

  const handleRemoveFromBasket = useCallback(
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

  const handleRunScanner = async () => {
    setScannerRunning(true);
    try {
      const res = await fetch('/api/scanner/run', { method: 'POST' });
      if (res.ok) {
        await fetchOpportunities();
      }
    } catch {
      // silent
    } finally {
      setScannerRunning(false);
    }
  };

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;

    if (over && over.id === 'basket-droppable') {
      handleAddToBasket(active.id as string);
    }
  }

  const draggedOpp = activeDragId
    ? opportunities.find((o) => o.ticker === activeDragId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-mata-text tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-mata-text-muted mt-0.5">
            Your trading command center
          </p>
        </div>
        <button
          onClick={handleRunScanner}
          disabled={scannerRunning}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-5 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.97] disabled:opacity-50"
        >
          {scannerRunning ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  fill="currentColor"
                  className="opacity-75"
                />
              </svg>
              Scanning...
            </>
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Run Scanner
            </>
          )}
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - Opportunity Feed */}
        <div className="lg:col-span-2">
          {loadingFeed ? (
            <FeedSkeleton />
          ) : (
            <OpportunityFeed
              opportunities={opportunities}
              onAddToBasket={handleAddToBasket}
            />
          )}
        </div>

        {/* Right column - Basket + Analytics + Brief */}
        <div className="space-y-5">
          <DroppableBasketWrapper>
            {loadingBasket ? (
              <div className="animate-pulse rounded-2xl border border-mata-border bg-mata-card p-8">
                <div className="h-5 w-24 rounded bg-mata-surface mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-full rounded bg-mata-surface" />
                  <div className="h-4 w-3/4 rounded bg-mata-surface" />
                  <div className="h-4 w-1/2 rounded bg-mata-surface" />
                </div>
              </div>
            ) : (
              <BasketPanel
                positions={positions}
                onRemove={handleRemoveFromBasket}
                onWeightChange={handleWeightChange}
              />
            )}
          </DroppableBasketWrapper>

          <AnalyticsPanel analytics={analytics} loading={loadingAnalytics} />

          <DailyBrief
            brief={brief}
            onRefresh={fetchBrief}
            loading={loadingBrief}
          />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedOpp ? (
          <div className="rounded-xl border border-mata-orange bg-mata-card px-4 py-3 shadow-xl shadow-mata-orange/10">
            <span className="text-sm font-black text-mata-text">
              {draggedOpp.ticker}
            </span>
            <span className="ml-2 text-xs text-mata-text-muted">
              {draggedOpp.asset_name}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
