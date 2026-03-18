'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  price_history?: number[];
};

// ─── Quantity Modal ───
function QuantityModal({
  ticker,
  assetName,
  price,
  onConfirm,
  onCancel,
}: {
  ticker: string;
  assetName: string;
  price: number;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState('1');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const parsedQty = parseFloat(qty) || 0;
  const totalValue = parsedQty * price;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedQty > 0) onConfirm(parsedQty);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-2xl border border-mata-border bg-mata-card p-5 shadow-2xl"
      >
        <div className="text-center mb-4">
          <div className="text-lg font-black text-mata-text">{ticker}</div>
          <div className="text-xs text-mata-text-muted">{assetName}</div>
          <div className="text-sm font-bold text-mata-text-secondary mt-1">
            ${price.toFixed(2)} per unit
          </div>
        </div>

        <label className="block text-[10px] font-bold uppercase tracking-wider text-mata-text-muted mb-1">
          Quantity
        </label>
        <input
          ref={inputRef}
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          min="0.001"
          step="any"
          className="w-full rounded-xl border border-mata-border bg-mata-surface px-4 py-2.5 text-center text-lg font-black text-mata-text focus:border-mata-orange focus:outline-none focus:ring-2 focus:ring-mata-orange/20"
        />

        {parsedQty > 0 && (
          <div className="mt-2 text-center text-xs text-mata-text-secondary">
            Total: <span className="font-bold">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-mata-border bg-mata-surface py-2 text-xs font-bold text-mata-text-secondary hover:bg-mata-border transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={parsedQty <= 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark py-2 text-xs font-bold text-white hover:shadow-lg hover:shadow-mata-orange/20 disabled:opacity-50 transition-all"
          >
            Add to Basket
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── DnD Wrappers ───
function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`transition-all duration-150 ${isDragging ? 'opacity-30 scale-95' : ''}`}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
}

function DroppableZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className} data-is-over={isOver}>
      {typeof children === 'function'
        ? (children as (isOver: boolean) => React.ReactNode)(isOver)
        : children}
    </div>
  );
}

// ─── Skeleton ───
function FeedSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-mata-border bg-mata-card p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 rounded bg-mata-surface" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-20 rounded bg-mata-surface" />
              <div className="h-2 w-32 rounded bg-mata-surface" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───
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
  const [dragSource, setDragSource] = useState<'feed' | 'basket' | null>(null);

  // Quantity modal state
  const [pendingAdd, setPendingAdd] = useState<{
    ticker: string;
    assetName: string;
    price: number;
    opportunityData: OpportunityWithPrice;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ─── Fetchers ───
  const fetchOpportunities = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const res = await fetch('/api/opportunities');
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data);
      }
    } catch { /* silent */ } finally {
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
    } catch { /* silent */ } finally {
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
    } catch { /* silent */ } finally {
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
    } catch { /* silent */ } finally {
      setLoadingBrief(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
    fetchBasket();
    fetchAnalytics();
    fetchBrief();
  }, [fetchOpportunities, fetchBasket, fetchAnalytics, fetchBrief]);

  // ─── Actions ───
  const showQuantityModal = useCallback(
    (ticker: string) => {
      const opp = opportunities.find((o) => o.ticker === ticker);
      if (!opp) return;
      setPendingAdd({
        ticker: opp.ticker,
        assetName: opp.asset_name,
        price: opp.last_price ?? 0,
        opportunityData: opp,
      });
    },
    [opportunities]
  );

  const confirmAddToBasket = useCallback(
    async (quantity: number) => {
      if (!pendingAdd) return;
      const opp = pendingAdd.opportunityData;

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
            entry_price: opp.last_price ?? 0,
            quantity,
          }),
        });
        if (res.ok) {
          await Promise.all([fetchBasket(), fetchAnalytics()]);
        }
      } catch { /* silent */ }

      setPendingAdd(null);
    },
    [pendingAdd, fetchBasket, fetchAnalytics]
  );

  const handleRemoveFromBasket = useCallback(
    async (ticker: string) => {
      try {
        const res = await fetch(`/api/basket?ticker=${encodeURIComponent(ticker)}`, { method: 'DELETE' });
        if (res.ok) {
          await Promise.all([fetchBasket(), fetchAnalytics()]);
        }
      } catch { /* silent */ }
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
      } catch { /* silent */ }
    },
    [fetchBasket, fetchAnalytics]
  );

  const handleRunScanner = async () => {
    setScannerRunning(true);
    try {
      const res = await fetch('/api/scanner/run', { method: 'POST' });
      if (res.ok) await fetchOpportunities();
    } catch { /* silent */ } finally {
      setScannerRunning(false);
    }
  };

  // ─── DnD ───
  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    setActiveDragId(id);
    // Determine source
    const isFromBasket = positions.some((p) => p.ticker === id);
    setDragSource(isFromBasket ? 'basket' : 'feed');
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const id = active.id as string;

    if (dragSource === 'feed' && over?.id === 'basket-drop') {
      // Dragged from feed to basket → show quantity modal
      showQuantityModal(id);
    } else if (dragSource === 'basket' && over?.id === 'remove-zone') {
      // Dragged from basket to remove zone
      handleRemoveFromBasket(id);
    } else if (dragSource === 'basket' && !over) {
      // Dragged from basket and dropped outside → remove
      handleRemoveFromBasket(id);
    }

    setActiveDragId(null);
    setDragSource(null);
  }

  const draggedOpp = activeDragId && dragSource === 'feed'
    ? opportunities.find((o) => o.ticker === activeDragId)
    : null;
  const draggedPos = activeDragId && dragSource === 'basket'
    ? positions.find((p) => p.ticker === activeDragId)
    : null;

  // Check droppable states using a component
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-mata-text tracking-tight">Dashboard</h1>
          <p className="text-[11px] text-mata-text-muted">Your trading command center</p>
        </div>
        <button
          onClick={handleRunScanner}
          disabled={scannerRunning}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-4 py-2 text-xs font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.97] disabled:opacity-50"
        >
          {scannerRunning ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              Run Scanner
            </>
          )}
        </button>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT: Scanner feed */}
        <div className="lg:col-span-3">
          {loadingFeed ? (
            <FeedSkeleton />
          ) : (
            <ScannerFeed
              opportunities={opportunities}
              onAdd={showQuantityModal}
            />
          )}
        </div>

        {/* CENTER: Basket (the heart) */}
        <div className="lg:col-span-5">
          <DroppableBasketArea
            positions={positions}
            onRemove={handleRemoveFromBasket}
            onWeightChange={handleWeightChange}
            loadingBasket={loadingBasket}
            isDraggingFromFeed={dragSource === 'feed'}
          />

          {/* Remove zone - visible when dragging from basket */}
          {dragSource === 'basket' && (
            <RemoveDropZone />
          )}

          {/* Daily Brief below basket */}
          <div className="mt-4">
            <DailyBrief brief={brief} onRefresh={fetchBrief} loading={loadingBrief} />
          </div>
        </div>

        {/* RIGHT: Analytics */}
        <div className="lg:col-span-4">
          <AnalyticsPanel analytics={analytics} loading={loadingAnalytics} />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedOpp && (
          <div className="rounded-xl border-2 border-mata-orange bg-mata-card px-4 py-2.5 shadow-2xl shadow-mata-orange/20">
            <span className="text-sm font-black text-mata-text">{draggedOpp.ticker}</span>
            <span className="ml-2 text-[10px] text-mata-text-muted">{draggedOpp.asset_name}</span>
            <span className="ml-2 text-[10px] font-bold text-mata-orange">{draggedOpp.opportunity_score}</span>
          </div>
        )}
        {draggedPos && (
          <div className="rounded-xl border-2 border-mata-red bg-mata-card px-4 py-2.5 shadow-2xl shadow-mata-red/20">
            <span className="text-sm font-black text-mata-text">{draggedPos.ticker}</span>
            <span className="ml-2 text-[10px] text-mata-text-muted">Drop outside to remove</span>
          </div>
        )}
      </DragOverlay>

      {/* Quantity Modal */}
      {pendingAdd && (
        <QuantityModal
          ticker={pendingAdd.ticker}
          assetName={pendingAdd.assetName}
          price={pendingAdd.price}
          onConfirm={confirmAddToBasket}
          onCancel={() => setPendingAdd(null)}
        />
      )}
    </DndContext>
  );
}

// ─── Scanner Feed with Progressive Reveal ───

const INITIAL_COUNT = 9;
const INCREMENT = 6;
const MAX_COUNT = 21;

function ScannerFeed({
  opportunities,
  onAdd,
}: {
  opportunities: OpportunityWithPrice[];
  onAdd: (ticker: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [filter, setFilter] = useState<'All' | 'Hot Now' | 'Swing' | 'Run'>('All');

  const filtered = filter === 'All'
    ? opportunities
    : opportunities.filter((o) => o.opportunity_label === filter);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < Math.min(filtered.length, MAX_COUNT);
  const remaining = Math.min(INCREMENT, Math.min(filtered.length, MAX_COUNT) - visibleCount);

  const counts = {
    'Hot Now': opportunities.filter((o) => o.opportunity_label === 'Hot Now').length,
    Swing: opportunities.filter((o) => o.opportunity_label === 'Swing').length,
    Run: opportunities.filter((o) => o.opportunity_label === 'Run').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">⚡</span>
        <div>
          <h2 className="text-xs font-black text-mata-text tracking-tight">Mark&apos;s Scanner</h2>
          <p className="text-[9px] text-mata-text-muted">{opportunities.length} found · drag to basket</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-2">
        {(['All', 'Hot Now', 'Swing', 'Run'] as const).map((tab) => {
          const count = tab === 'All' ? opportunities.length : counts[tab];
          return (
            <button
              key={tab}
              onClick={() => { setFilter(tab); setVisibleCount(INITIAL_COUNT); }}
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold transition-all ${
                filter === tab
                  ? 'bg-mata-orange text-white'
                  : 'bg-mata-surface text-mata-text-muted hover:bg-mata-border'
              }`}
            >
              {tab} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {visible.length > 0 ? (
        <div className="space-y-1.5">
          {visible.map((opp) => (
            <DraggableCard key={opp.ticker} id={opp.ticker}>
              <OpportunityCardInFeed opportunity={opp} onAdd={onAdd} />
            </DraggableCard>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-mata-border bg-mata-surface/50 p-6 text-center">
          <p className="text-[10px] text-mata-text-muted">No {filter !== 'All' ? filter : ''} opportunities</p>
        </div>
      )}

      {/* See more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((prev) => Math.min(prev + INCREMENT, MAX_COUNT))}
          className="mt-2 w-full rounded-lg border border-mata-border bg-mata-surface py-2 text-[10px] font-bold text-mata-text-secondary hover:bg-mata-border transition-all"
        >
          See more ({remaining})
        </button>
      )}
    </div>
  );
}

// ─── Sub-components ───

function OpportunityCardInFeed({
  opportunity,
  onAdd,
}: {
  opportunity: OpportunityWithPrice;
  onAdd: (ticker: string) => void;
}) {
  // We render inline using OpportunityFeed's card style
  const o = opportunity;
  const changeColor = (o.pct_change ?? 0) >= 0 ? 'text-mata-green' : 'text-mata-red';
  const changeSign = (o.pct_change ?? 0) >= 0 ? '+' : '';

  return (
    <div className="group relative rounded-xl border border-mata-border bg-mata-card p-2.5 transition-all hover:card-glow hover:border-mata-orange/30 cursor-grab active:cursor-grabbing">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-black text-mata-text">{o.ticker}</span>
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
              o.opportunity_label === 'Hot Now'
                ? 'bg-red-100 text-red-600'
                : o.opportunity_label === 'Run'
                ? 'bg-green-100 text-green-600'
                : 'bg-blue-100 text-blue-600'
            }`}>
              {o.opportunity_label}
            </span>
          </div>
          <div className="text-[9px] text-mata-text-muted truncate max-w-[120px]">{o.asset_name}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
            o.opportunity_score >= 70 ? 'bg-mata-green/10 text-mata-green'
            : o.opportunity_score >= 50 ? 'bg-mata-yellow/10 text-mata-yellow'
            : 'bg-mata-red/10 text-mata-red'
          }`}>
            {o.opportunity_score}
          </div>
          {o.last_price != null && (
            <div className="text-right">
              <div className="text-[10px] font-bold text-mata-text">${o.last_price.toFixed(2)}</div>
              {o.pct_change != null && (
                <div className={`text-[8px] font-semibold ${changeColor}`}>
                  {changeSign}{(o.pct_change * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Quick add on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onAdd(o.ticker); }}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded bg-mata-orange px-1.5 py-0.5 text-[8px] font-bold text-white hover:bg-mata-orange-dark"
      >
        +
      </button>
    </div>
  );
}

function DroppableBasketArea({
  positions,
  onRemove,
  onWeightChange,
  loadingBasket,
  isDraggingFromFeed,
}: {
  positions: BasketPosition[];
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, weight: number) => void;
  loadingBasket: boolean;
  isDraggingFromFeed: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'basket-drop' });

  return (
    <div ref={setNodeRef}>
      {loadingBasket ? (
        <div className="animate-pulse rounded-2xl border-2 border-mata-border bg-mata-card p-6">
          <div className="h-4 w-24 rounded bg-mata-surface mb-4" />
          <div className="space-y-2">
            <div className="h-8 rounded bg-mata-surface" />
            <div className="h-8 rounded bg-mata-surface" />
            <div className="h-8 rounded bg-mata-surface" />
          </div>
        </div>
      ) : (
        <BasketWithDraggablePositions
          positions={positions}
          onRemove={onRemove}
          onWeightChange={onWeightChange}
          isOver={isOver && isDraggingFromFeed}
        />
      )}
    </div>
  );
}

function BasketWithDraggablePositions({
  positions,
  onRemove,
  onWeightChange,
  isOver,
}: {
  positions: BasketPosition[];
  onRemove: (ticker: string) => void;
  onWeightChange: (ticker: string, weight: number) => void;
  isOver: boolean;
}) {
  return (
    <BasketPanel
      positions={positions}
      onRemove={onRemove}
      onWeightChange={onWeightChange}
      isOver={isOver}
    />
  );
}

function RemoveDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'remove-zone' });

  return (
    <div
      ref={setNodeRef}
      className={`mt-2 rounded-xl border-2 border-dashed py-3 text-center transition-all ${
        isOver
          ? 'border-mata-red bg-mata-red/10 text-mata-red'
          : 'border-mata-border text-mata-text-muted'
      }`}
    >
      <span className="text-xs font-bold">{isOver ? 'Release to remove' : 'Drag here to remove'}</span>
    </div>
  );
}
