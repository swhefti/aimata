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
import Sparkline from '@/components/ui/Sparkline';
import BasketPanel from '@/components/basket/BasketPanel';
import AnalyticsPanel from '@/components/basket/AnalyticsPanel';
import DailyBrief from '@/components/dashboard/DailyBrief';
import AgentStrip from '@/components/dashboard/AgentStrip';
import BasketNarrative from '@/components/basket/BasketNarrative';
import { computePositionActions, type PositionSignal } from '@/lib/scoring/actions';

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Decent';
  if (score >= 40) return 'Below avg';
  return 'Weak';
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
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
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-mata-border bg-mata-surface py-2 text-xs font-bold text-mata-text-secondary hover:bg-mata-border transition-all">
            Cancel
          </button>
          <button type="submit" disabled={parsedQty <= 0} className="flex-1 rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark py-2 text-xs font-bold text-white hover:shadow-lg hover:shadow-mata-orange/20 disabled:opacity-50 transition-all">
            Add to Basket
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── DnD Wrappers ───
function DraggableCard({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      className={`transition-all duration-150 ${isDragging ? 'opacity-30 scale-90' : ''}`}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
}

// ─── Skeleton ───
function FeedSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="animate-pulse aspect-square rounded-2xl border border-mata-border bg-mata-card p-3">
          <div className="h-3 w-10 rounded bg-mata-surface mb-2" />
          <div className="h-2 w-16 rounded bg-mata-surface mb-3" />
          <div className="h-8 w-8 rounded-full bg-mata-surface mx-auto" />
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
  const [brief, setBrief] = useState<{ content: string; agent_name: string; created_at: string } | null>(null);

  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingBasket, setLoadingBasket] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingBrief, setLoadingBrief] = useState(true);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<'feed' | 'basket' | null>(null);
  const [flippedTicker, setFlippedTicker] = useState<string | null>(null);
  const [signals, setSignals] = useState<PositionSignal[]>([]);

  const [pendingAdd, setPendingAdd] = useState<{
    ticker: string; assetName: string; price: number; opportunityData: OpportunityWithPrice;
  } | null>(null);
  const scannerColRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ─── Fetchers ───
  const fetchOpportunities = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const res = await fetch('/api/opportunities');
      if (res.ok) setOpportunities(await res.json());
    } catch { /* silent */ } finally { setLoadingFeed(false); }
  }, []);

  const fetchBasket = useCallback(async () => {
    setLoadingBasket(true);
    try {
      const res = await fetch('/api/basket');
      if (res.ok) { const data = await res.json(); setPositions(data.positions ?? []); }
    } catch { /* silent */ } finally { setLoadingBasket(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/basket/analytics');
      if (res.ok) setAnalytics(await res.json());
    } catch { /* silent */ } finally { setLoadingAnalytics(false); }
  }, []);

  const fetchBrief = useCallback(async () => {
    setLoadingBrief(true);
    try {
      const res = await fetch('/api/brief');
      if (res.ok) { const data = await res.json(); setBrief(data.brief ?? null); }
    } catch { /* silent */ } finally { setLoadingBrief(false); }
  }, []);

  useEffect(() => {
    fetchOpportunities(); fetchBasket(); fetchAnalytics(); fetchBrief();
  }, [fetchOpportunities, fetchBasket, fetchAnalytics, fetchBrief]);

  // Compute Rex's signals whenever positions change
  useEffect(() => {
    setSignals(computePositionActions(positions));
  }, [positions]);

  // ─── Actions ───
  const showQuantityModal = useCallback((ticker: string) => {
    const opp = opportunities.find((o) => o.ticker === ticker);
    if (!opp) return;
    setPendingAdd({ ticker: opp.ticker, assetName: opp.asset_name, price: opp.last_price ?? 0, opportunityData: opp });
  }, [opportunities]);

  const confirmAddToBasket = useCallback(async (quantity: number) => {
    if (!pendingAdd) return;
    const opp = pendingAdd.opportunityData;
    try {
      const res = await fetch('/api/basket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: opp.ticker, asset_name: opp.asset_name, asset_type: opp.asset_type, opportunity_score: opp.opportunity_score, risk_label: opp.risk_label, setup_type: opp.setup_type, entry_price: opp.last_price ?? 0, quantity }),
      });
      if (res.ok) await Promise.all([fetchBasket(), fetchAnalytics()]);
    } catch { /* silent */ }
    setPendingAdd(null);
  }, [pendingAdd, fetchBasket, fetchAnalytics]);

  const handleRemoveFromBasket = useCallback(async (ticker: string) => {
    try {
      const res = await fetch(`/api/basket?ticker=${encodeURIComponent(ticker)}`, { method: 'DELETE' });
      if (res.ok) await Promise.all([fetchBasket(), fetchAnalytics()]);
    } catch { /* silent */ }
  }, [fetchBasket, fetchAnalytics]);

  const handleWeightChange = useCallback(async (ticker: string, weight: number) => {
    try {
      const res = await fetch('/api/basket/weight', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker, manual_weight: weight }) });
      if (res.ok) await Promise.all([fetchBasket(), fetchAnalytics()]);
    } catch { /* silent */ }
  }, [fetchBasket, fetchAnalytics]);

  const handleTrim = useCallback(async (ticker: string) => {
    // Trim = halve the quantity
    const pos = positions.find((p) => p.ticker === ticker);
    if (!pos || pos.quantity <= 0) return;
    const newQty = pos.quantity / 2;
    try {
      const res = await fetch('/api/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker, asset_name: pos.asset_name, asset_type: pos.asset_type,
          opportunity_score: pos.opportunity_score, risk_label: pos.risk_label,
          setup_type: pos.setup_type, entry_price: pos.entry_price, quantity: newQty,
        }),
      });
      if (res.ok) await Promise.all([fetchBasket(), fetchAnalytics()]);
    } catch { /* silent */ }
  }, [positions, fetchBasket, fetchAnalytics]);

  const handleRunScanner = async () => {
    setScannerRunning(true);
    try {
      const res = await fetch('/api/scanner/run', { method: 'POST' });
      if (res.ok) await fetchOpportunities();
    } catch { /* silent */ } finally { setScannerRunning(false); }
  };

  // ─── DnD ───
  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    setActiveDragId(id);
    setDragSource(positions.some((p) => p.ticker === id) ? 'basket' : 'feed');
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const id = active.id as string;
    if (dragSource === 'feed' && over?.id === 'basket-drop') showQuantityModal(id);
    else if (dragSource === 'basket' && over?.id === 'remove-zone') handleRemoveFromBasket(id);
    else if (dragSource === 'basket' && !over) handleRemoveFromBasket(id);
    setActiveDragId(null);
    setDragSource(null);
  }

  const draggedOpp = activeDragId && dragSource === 'feed' ? opportunities.find((o) => o.ticker === activeDragId) : null;
  const draggedPos = activeDragId && dragSource === 'basket' ? positions.find((p) => p.ticker === activeDragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-mata-text tracking-tight">Dashboard</h1>
          <p className="text-[11px] text-mata-text-muted">Your trading command center</p>
        </div>
        <button onClick={handleRunScanner} disabled={scannerRunning}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-mata-orange to-mata-orange-dark px-4 py-2 text-xs font-bold text-white transition-all hover:shadow-lg hover:shadow-mata-orange/20 active:scale-[0.97] disabled:opacity-50">
          {scannerRunning ? (
            <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg>Scanning...</>
          ) : (
            <><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>Run Scanner</>
          )}
        </button>
      </div>

      {/* Agent commentary strip */}
      <AgentStrip opportunities={opportunities} positions={positions} analytics={analytics} signals={signals} />

      {/* 3 equal columns */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* LEFT: Scanner */}
        <div ref={scannerColRef}>
          {loadingFeed ? <FeedSkeleton /> : (
            <ScannerFeed opportunities={opportunities} onAdd={showQuantityModal} flippedTicker={flippedTicker} onFlip={setFlippedTicker} columnRef={scannerColRef} />
          )}
        </div>

        {/* CENTER: Basket */}
        <div>
          <DroppableBasketArea positions={positions} onRemove={handleRemoveFromBasket} onWeightChange={handleWeightChange} onTrim={handleTrim} loadingBasket={loadingBasket} isDraggingFromFeed={dragSource === 'feed'} signals={signals} />
          {dragSource === 'basket' && <RemoveDropZone />}
          {/* Paul's narrative review */}
          <div className="mt-3">
            <BasketNarrative positions={positions} analytics={analytics} />
          </div>
          <div className="mt-3">
            <DailyBrief
              positions={positions}
              analytics={analytics}
              opportunities={opportunities}
              signals={signals}
              claudeBrief={brief}
              onRefreshClaude={fetchBrief}
              claudeLoading={loadingBrief}
            />
          </div>
        </div>

        {/* RIGHT: Analytics */}
        <div>
          <AnalyticsPanel analytics={analytics} loading={loadingAnalytics} />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggedOpp && (
          <div className="rounded-2xl border-2 border-mata-orange bg-mata-card p-3 shadow-2xl shadow-mata-orange/20 aspect-square w-28 flex flex-col items-center justify-center">
            <span className="text-base font-black text-mata-text">{draggedOpp.ticker}</span>
            <span className="text-[9px] text-mata-text-muted">{draggedOpp.asset_name}</span>
            <span className="text-sm font-black text-mata-orange mt-1">{draggedOpp.opportunity_score}</span>
          </div>
        )}
        {draggedPos && (
          <div className="rounded-xl border-2 border-mata-red bg-mata-card px-4 py-2.5 shadow-2xl shadow-mata-red/20">
            <span className="text-sm font-black text-mata-text">{draggedPos.ticker}</span>
            <span className="ml-2 text-[10px] text-mata-text-muted">Drop to remove</span>
          </div>
        )}
      </DragOverlay>

      {/* Quantity Modal */}
      {pendingAdd && (
        <QuantityModal ticker={pendingAdd.ticker} assetName={pendingAdd.assetName} price={pendingAdd.price} onConfirm={confirmAddToBasket} onCancel={() => setPendingAdd(null)} />
      )}
    </DndContext>
  );
}

// ─── Scanner Feed ───
const INITIAL_COUNT = 9;
const INCREMENT = 6;
const MAX_COUNT = 21;

function ScannerFeed({
  opportunities, onAdd, flippedTicker, onFlip, columnRef,
}: {
  opportunities: OpportunityWithPrice[];
  onAdd: (ticker: string) => void;
  flippedTicker: string | null;
  onFlip: (ticker: string | null) => void;
  columnRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [filter, setFilter] = useState<'All' | 'Hot Now' | 'Swing' | 'Run'>('All');

  const filtered = filter === 'All' ? opportunities : opportunities.filter((o) => o.opportunity_label === filter);
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
        <span className="text-base">⚡</span>
        <div>
          <h2 className="text-xs font-black text-mata-text tracking-tight">Mark&apos;s Scanner</h2>
          <p className="text-[9px] text-mata-text-muted">{opportunities.length} found · click to flip · drag to basket</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {(['All', 'Hot Now', 'Swing', 'Run'] as const).map((tab) => {
          const count = tab === 'All' ? opportunities.length : counts[tab];
          return (
            <button key={tab} onClick={() => { setFilter(tab); setVisibleCount(INITIAL_COUNT); }}
              className={`rounded-lg px-2 py-1 text-[9px] font-bold transition-all ${filter === tab ? 'bg-mata-orange text-white' : 'bg-mata-surface text-mata-text-muted hover:bg-mata-border'}`}>
              {tab} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Square card grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {visible.map((opp) => (
            <FlippableCard
              key={opp.ticker}
              opportunity={opp}
              isFlipped={flippedTicker === opp.ticker}
              onFlip={() => onFlip(flippedTicker === opp.ticker ? null : opp.ticker)}
              onAdd={onAdd}
              columnRef={columnRef}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-mata-border bg-mata-surface/50 p-8 text-center">
          <p className="text-[10px] text-mata-text-muted">No {filter !== 'All' ? filter : ''} opportunities</p>
        </div>
      )}

      {/* See more */}
      {hasMore && (
        <button onClick={() => setVisibleCount((prev) => Math.min(prev + INCREMENT, MAX_COUNT))}
          className="mt-3 w-full rounded-xl border border-mata-border bg-mata-surface py-2.5 text-[10px] font-bold text-mata-text-secondary hover:bg-mata-border transition-all">
          See more ({remaining})
        </button>
      )}
    </div>
  );
}

// ─── Flippable Square Card ───
function FlippableCard({
  opportunity: o,
  isFlipped,
  onFlip,
  onAdd,
  columnRef,
}: {
  opportunity: OpportunityWithPrice;
  isFlipped: boolean;
  onFlip: () => void;
  onAdd: (ticker: string) => void;
  columnRef: React.RefObject<HTMLDivElement | null>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [closing, setClosing] = useState(false);

  const changeColor = (o.pct_change ?? 0) >= 0 ? 'text-mata-green' : 'text-mata-red';
  const changeSign = (o.pct_change ?? 0) >= 0 ? '+' : '';

  const labelColor = o.opportunity_label === 'Hot Now'
    ? 'bg-red-500/10 text-red-500 border-red-500/20'
    : o.opportunity_label === 'Run'
    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    : 'bg-blue-500/10 text-blue-500 border-blue-500/20';

  const scoreColor = o.opportunity_score >= 70 ? 'text-mata-green' : o.opportunity_score >= 50 ? 'text-mata-yellow' : 'text-mata-red';
  const scoreBg = o.opportunity_score >= 70 ? 'bg-mata-green/10' : o.opportunity_score >= 50 ? 'bg-mata-yellow/10' : 'bg-mata-red/10';

  const scores = [
    { label: 'Momentum', value: o.momentum_score, icon: '↗' },
    { label: 'Breakout', value: o.breakout_score, icon: '⬆' },
    { label: 'Reversion', value: o.mean_reversion_score, icon: '↩' },
    { label: 'Catalyst', value: o.catalyst_score, icon: '⚡' },
    { label: 'Sentiment', value: o.sentiment_score, icon: '📊' },
    { label: 'Volatility', value: o.volatility_score, icon: '〰' },
    { label: 'Regime', value: o.regime_fit_score, icon: '🎯' },
  ];

  function handleOpen() {
    if (cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width });
    }
    setClosing(false);
    onFlip();
  }

  function handleClose() {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onFlip();
    }, 450);
  }

  // Compute column center for the expansion target
  const colRect = columnRef.current?.getBoundingClientRect();
  const targetLeft = colRect ? colRect.left + colRect.width / 2 : (rect ? rect.left + rect.width / 2 : 0);
  const targetTop = colRect ? colRect.top + Math.min(colRect.height / 2, window.innerHeight / 2) : (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);

  const expandedSize = rect ? rect.width * 3.5 : 350;

  return (
    <>
      <DraggableCard id={o.ticker} disabled={isFlipped}>
        <div
          ref={cardRef}
          className="cursor-pointer"
          onClick={handleOpen}
        >
          {/* ═══ FRONT (always in grid) ═══ */}
          <div className={`aspect-square rounded-2xl border bg-mata-card p-2.5 flex flex-col justify-between transition-all duration-300 ${
            isFlipped
              ? 'border-mata-orange/40 opacity-40 scale-95'
              : 'border-mata-border hover:card-glow hover:border-mata-orange/30'
          }`}>
            {/* Top: label */}
            <div className="flex items-start justify-between">
              <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md border ${labelColor}`}>
                {o.opportunity_label}
              </span>
              <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                o.risk_label === 'Low' ? 'text-mata-green' : o.risk_label === 'High' ? 'text-mata-red' : 'text-mata-yellow'
              }`}>
                {o.risk_label}
              </span>
            </div>

            {/* Center: ticker + score */}
            <div className="text-center -mt-1">
              <div className="text-base font-black text-mata-text leading-tight">{o.ticker}</div>
              <div className="text-[8px] text-mata-text-muted truncate px-1">{o.asset_name}</div>
              <div className={`text-xl font-black ${scoreColor} mt-0.5 leading-none`}>
                {o.opportunity_score}
              </div>
              <div className={`text-[7px] font-bold ${scoreColor} mt-0.5`}>
                {scoreLabel(o.opportunity_score)}
              </div>
            </div>

            {/* Bottom: price */}
            <div className="text-center">
              {o.last_price != null && (
                <div className="text-[9px] font-bold text-mata-text">${o.last_price.toFixed(2)}</div>
              )}
              {o.pct_change != null && (
                <div className={`text-[8px] font-bold ${changeColor}`}>
                  {changeSign}{(o.pct_change * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>
      </DraggableCard>

      {/* ═══ FLIPPED BACK (fixed overlay) ═══ */}
      {(isFlipped || closing) && rect && (
        <div className="fixed inset-0 z-50" onClick={handleClose}>
          {/* Backdrop */}
          <div className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-400 ${closing ? 'opacity-0' : 'animate-[fadeIn_0.3s_ease-out]'}`} />

          {/* The card back — expands from card position to column center */}
          <div
            className="absolute"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: expandedSize,
              height: expandedSize,
              perspective: '1200px',
              top: closing ? `${rect.top + rect.width / 2}px` : `${targetTop}px`,
              left: closing ? `${rect.left + rect.width / 2}px` : `${targetLeft}px`,
              transform: closing
                ? `translate(-50%, -50%) scale(${rect.width / expandedSize})`
                : 'translate(-50%, -50%) scale(1)',
              opacity: closing ? 0 : 1,
              transition: 'top 0.45s ease-in, left 0.45s ease-in, transform 0.45s ease-in, opacity 0.35s ease-in',
              ...(!closing ? {
                animation: 'expandToTarget 0.5s ease-out forwards',
                '--origin-top': `${rect.top + rect.width / 2}px`,
                '--origin-left': `${rect.left + rect.width / 2}px`,
                '--origin-scale': `${rect.width / expandedSize}`,
                '--target-top': `${targetTop}px`,
                '--target-left': `${targetLeft}px`,
              } as React.CSSProperties : {}),
            }}
          >
            <div
              className={`w-full h-full ${closing ? '' : 'animate-[flipIn_0.5s_ease-out_forwards]'}`}
              style={{
                transformStyle: 'preserve-3d',
                ...(closing ? { transform: 'rotateY(-180deg)', transition: 'transform 0.45s ease-in' } : {}),
              }}
            >
              <div
                className="w-full h-full rounded-2xl border-2 border-mata-orange/30 bg-mata-card shadow-2xl shadow-mata-orange/10 overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                }}
              >
                <div className="h-full flex flex-col">
                  {/* Back header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-mata-border">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-mata-text">{o.ticker}</span>
                          <span className={`${scoreBg} ${scoreColor} text-sm font-black px-2 py-0.5 rounded-lg`}>{o.opportunity_score}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${labelColor}`}>
                            {o.opportunity_label}
                          </span>
                        </div>
                        <div className="text-xs text-mata-text-muted mt-0.5">{o.asset_name}</div>
                      </div>
                    </div>
                    <button
                      onClick={handleClose}
                      className="rounded-lg p-1.5 text-mata-text-muted hover:text-mata-text hover:bg-mata-surface transition-all"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Price + chart row */}
                    <div className="flex items-start gap-4">
                      <div>
                        {o.last_price != null && (
                          <div className="text-2xl font-black text-mata-text">${o.last_price.toFixed(2)}</div>
                        )}
                        {o.pct_change != null && (
                          <div className={`text-sm font-bold ${changeColor}`}>
                            {changeSign}{(o.pct_change * 100).toFixed(2)}%
                          </div>
                        )}
                        <div className="text-[10px] text-mata-text-muted mt-1">
                          {o.setup_type} setup · {o.risk_label} risk · ~{o.horizon_days}d horizon
                        </div>
                      </div>
                      {o.price_history && o.price_history.length > 1 && (
                        <div className="flex-1 bg-mata-surface/50 rounded-xl p-3">
                          <Sparkline data={o.price_history} width={300} height={80} strokeWidth={2} fillOpacity={0.12} />
                        </div>
                      )}
                    </div>

                    {/* Score breakdown */}
                    <div>
                      <div className="text-[10px] font-black text-mata-text-muted uppercase tracking-wider mb-2">Why this score?</div>
                      <div className="space-y-2">
                        {scores.map((s) => {
                          const barColor = s.value >= 70 ? '#22c55e' : s.value >= 40 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={s.label} className="flex items-center gap-2">
                              <span className="text-sm w-5 text-center">{s.icon}</span>
                              <span className="text-xs font-semibold text-mata-text-secondary w-20">{s.label}</span>
                              <div className="flex-1 h-2.5 rounded-full bg-mata-surface overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${s.value}%`, backgroundColor: barColor }}
                                />
                              </div>
                              <span className="text-xs font-black text-mata-text w-8 text-right">{s.value}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mark's explanation */}
                    <div className="bg-mata-surface/50 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">⚡</span>
                        <span className="text-[10px] font-black text-mata-text uppercase tracking-wider">Mark&apos;s Take</span>
                      </div>
                      <p className="text-xs text-mata-text-secondary leading-relaxed">
                        &quot;{o.explanation}&quot;
                      </p>
                    </div>
                  </div>

                  {/* Back footer */}
                  <div className="px-5 py-2.5 border-t border-mata-border flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAdd(o.ticker); }}
                      className="rounded-lg bg-gradient-to-r from-mata-orange to-mata-orange-dark px-4 py-1.5 text-[10px] font-bold text-white hover:shadow-md hover:shadow-mata-orange/20 transition-all active:scale-[0.97]"
                    >
                      + Add to Basket
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Droppable Basket Area ───
function DroppableBasketArea({
  positions, onRemove, onWeightChange, onTrim, loadingBasket, isDraggingFromFeed, signals,
}: {
  positions: BasketPosition[]; onRemove: (t: string) => void; onWeightChange: (t: string, w: number) => void; onTrim: (t: string) => void; loadingBasket: boolean; isDraggingFromFeed: boolean; signals: PositionSignal[];
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
          </div>
        </div>
      ) : (
        <BasketPanel positions={positions} onRemove={onRemove} onWeightChange={onWeightChange} onTrim={onTrim} isOver={isOver && isDraggingFromFeed} signals={signals} />
      )}
    </div>
  );
}

function RemoveDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'remove-zone' });
  return (
    <div ref={setNodeRef} className={`mt-2 rounded-xl border-2 border-dashed py-3 text-center transition-all ${isOver ? 'border-mata-red bg-mata-red/10 text-mata-red' : 'border-mata-border text-mata-text-muted'}`}>
      <span className="text-xs font-bold">{isOver ? 'Release to remove' : 'Drag here to remove'}</span>
    </div>
  );
}
