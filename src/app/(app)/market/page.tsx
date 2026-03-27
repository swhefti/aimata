'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { OpportunityLabel, RiskLabel } from '@/types';
import Badge from '@/components/ui/Badge';
import Sparkline from '@/components/ui/Sparkline';

// ─── Types ───

interface MarketAsset {
  ticker: string;
  asset_name: string;
  asset_type: 'stock' | 'crypto';
  sector: string | null;
  opportunity_score: number;
  momentum_score: number;
  breakout_score: number;
  mean_reversion_score: number;
  catalyst_score: number;
  sentiment_score: number;
  volatility_score: number;
  regime_fit_score: number;
  opportunity_label: OpportunityLabel;
  risk_label: RiskLabel;
  setup_type: string;
  explanation: string;
  horizon_days: number;
  last_price: number | null;
  daily_change: number | null;
  pct_change: number | null;
  price_history: number[];
  in_feed: boolean;
  in_basket?: boolean;
}

type SortField =
  | 'ticker'
  | 'opportunity_score'
  | 'momentum_score'
  | 'breakout_score'
  | 'mean_reversion_score'
  | 'catalyst_score'
  | 'sentiment_score'
  | 'volatility_score'
  | 'regime_fit_score'
  | 'last_price'
  | 'pct_change';

type SortDir = 'asc' | 'desc';

// ─── Sub-score bar component ───

function ScoreBar({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 70 ? 'bg-mata-green' : value >= 50 ? 'bg-mata-yellow' : 'bg-mata-red';
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs text-mata-text-secondary shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-mata-surface overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-bold text-mata-text">{value}</span>
    </div>
  );
}

// ─── Filter button ───

function FilterBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
        active
          ? 'bg-mata-orange/10 text-mata-orange'
          : 'text-mata-text-secondary hover:bg-mata-surface hover:text-mata-text'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Sortable header ───

function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  className = '',
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-mata-text-secondary hover:text-mata-text transition-colors ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-mata-orange">
            {currentDir === 'desc' ? '\u25BC' : '\u25B2'}
          </span>
        )}
      </span>
    </th>
  );
}

// ─── Score cell color ───

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-mata-green/15 text-mata-green';
  if (score >= 50) return 'bg-mata-yellow/15 text-mata-yellow';
  return 'bg-mata-red/15 text-mata-red';
}

function labelVariant(label: OpportunityLabel): 'hot' | 'swing' | 'run' {
  if (label === 'Hot Now') return 'hot';
  if (label === 'Swing') return 'swing';
  return 'run';
}

function riskVariant(risk: RiskLabel): 'low' | 'medium' | 'high' {
  return risk.toLowerCase() as 'low' | 'medium' | 'high';
}

// ─── Main Page ───

export default function MarketPage() {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [basketTickers, setBasketTickers] = useState<Set<string>>(new Set());

  // Filters
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | 'stock' | 'crypto'>('all');
  const [labelFilter, setLabelFilter] = useState<'all' | OpportunityLabel>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLabel>('all');
  const [search, setSearch] = useState('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('opportunity_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    Promise.all([
      fetch('/api/market').then(r => r.json()),
      fetch('/api/basket').then(r => r.json()).catch(() => ({ positions: [] })),
    ]).then(([marketData, basketData]) => {
      setAssets(marketData);
      const held = new Set<string>((basketData.positions ?? []).map((p: { ticker: string }) => p.ticker));
      setBasketTickers(held);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField]
  );

  const filtered = useMemo(() => {
    let list = assets;
    if (assetTypeFilter !== 'all') {
      list = list.filter((a) => a.asset_type === assetTypeFilter);
    }
    if (labelFilter !== 'all') {
      list = list.filter((a) => a.opportunity_label === labelFilter);
    }
    if (riskFilter !== 'all') {
      list = list.filter((a) => a.risk_label === riskFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.ticker.toLowerCase().includes(q) ||
          a.asset_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [assets, assetTypeFilter, labelFilter, riskFilter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-mata-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-mata-text tracking-tight">
          Market Universe
        </h1>
        <p className="text-sm text-mata-text-muted mt-1">
          All scored assets from the latest scan &middot; {assets.length} assets
        </p>
      </div>

      {/* Filter bar */}
      <div className="mata-card mata-border rounded-xl p-3 flex flex-wrap items-center gap-3">
        {/* Asset type */}
        <div className="flex items-center gap-1 border-r border-mata-border pr-3">
          <FilterBtn label="All" active={assetTypeFilter === 'all'} onClick={() => setAssetTypeFilter('all')} />
          <FilterBtn label="Stocks" active={assetTypeFilter === 'stock'} onClick={() => setAssetTypeFilter('stock')} />
          <FilterBtn label="Crypto" active={assetTypeFilter === 'crypto'} onClick={() => setAssetTypeFilter('crypto')} />
        </div>

        {/* Label filter */}
        <div className="flex items-center gap-1 border-r border-mata-border pr-3">
          <FilterBtn label="All" active={labelFilter === 'all'} onClick={() => setLabelFilter('all')} />
          <FilterBtn label="Hot Now" active={labelFilter === 'Hot Now'} onClick={() => setLabelFilter('Hot Now')} />
          <FilterBtn label="Swing" active={labelFilter === 'Swing'} onClick={() => setLabelFilter('Swing')} />
          <FilterBtn label="Run" active={labelFilter === 'Run'} onClick={() => setLabelFilter('Run')} />
        </div>

        {/* Risk filter */}
        <div className="flex items-center gap-1 border-r border-mata-border pr-3">
          <FilterBtn label="All" active={riskFilter === 'all'} onClick={() => setRiskFilter('all')} />
          <FilterBtn label="Low" active={riskFilter === 'Low'} onClick={() => setRiskFilter('Low')} />
          <FilterBtn label="Medium" active={riskFilter === 'Medium'} onClick={() => setRiskFilter('Medium')} />
          <FilterBtn label="High" active={riskFilter === 'High'} onClick={() => setRiskFilter('High')} />
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticker or name..."
          className="flex-1 min-w-[160px] rounded-lg border border-mata-border bg-mata-surface px-3 py-1.5 text-sm text-mata-text placeholder:text-mata-text-muted outline-none focus:border-mata-orange/50 focus:ring-1 focus:ring-mata-orange/20 transition-all"
        />
      </div>

      {/* Table */}
      <div className="mata-card mata-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mata-border bg-mata-surface/50">
                <SortHeader label="Ticker" field="ticker" currentField={sortField} currentDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-mata-text-secondary hidden sm:table-cell">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-mata-text-secondary hidden md:table-cell">
                  Trend
                </th>
                <SortHeader label="Price" field="last_price" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Chg %" field="pct_change" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Score" field="opportunity_score" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-mata-text-secondary hidden lg:table-cell">
                  Label
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-mata-text-secondary hidden lg:table-cell">
                  Risk
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-mata-text-secondary hidden xl:table-cell">
                  Setup
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((asset) => {
                const isExpanded = expandedTicker === asset.ticker;
                return (
                  <TableRow
                    key={asset.ticker}
                    asset={{ ...asset, in_basket: basketTickers.has(asset.ticker) }}
                    isExpanded={isExpanded}
                    onToggle={() =>
                      setExpandedTicker(isExpanded ? null : asset.ticker)
                    }
                  />
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center text-mata-text-muted"
                  >
                    No assets match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Table row + expandable detail ───

function TableRow({
  asset,
  isExpanded,
  onToggle,
}: {
  asset: MarketAsset;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const pctChange = asset.pct_change ?? 0;
  const changeColor = pctChange >= 0 ? 'text-mata-green' : 'text-mata-red';

  return (
    <>
      <tr
        onClick={onToggle}
        className={`group cursor-pointer border-b border-mata-border/50 transition-colors hover:bg-mata-surface/50 ${
          asset.in_feed ? 'border-l-2 border-l-mata-orange' : ''
        } ${!asset.in_feed ? 'opacity-70 hover:opacity-100' : ''}`}
      >
        {/* Ticker + Name */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-mata-text">{asset.ticker}</span>
                {asset.in_feed && (
                  <span className="rounded bg-mata-orange/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-mata-orange">
                    In Feed
                  </span>
                )}
                {asset.in_basket && (
                  <span className="rounded bg-mata-green/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-mata-green">
                    Held
                  </span>
                )}
              </div>
              <div className="text-[11px] text-mata-text-muted truncate max-w-[140px]">
                {asset.asset_name}
              </div>
            </div>
          </div>
        </td>

        {/* Asset type */}
        <td className="px-3 py-2.5 hidden sm:table-cell">
          <Badge
            label={asset.asset_type}
            variant={asset.asset_type === 'crypto' ? 'swing' : 'default'}
          />
        </td>

        {/* Sparkline */}
        <td className="px-3 py-2.5 hidden md:table-cell">
          <Sparkline data={asset.price_history} width={80} height={20} strokeWidth={1.2} />
        </td>

        {/* Price */}
        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-mata-text">
          {asset.last_price != null
            ? `$${asset.last_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '--'}
        </td>

        {/* Change % */}
        <td className={`px-3 py-2.5 font-mono text-xs font-semibold ${changeColor}`}>
          {pctChange >= 0 ? '+' : ''}
          {pctChange.toFixed(2)}%
        </td>

        {/* Score */}
        <td className="px-3 py-2.5">
          <span
            className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-black ${scoreColor(asset.opportunity_score)}`}
          >
            {asset.opportunity_score}
          </span>
        </td>

        {/* Label */}
        <td className="px-3 py-2.5 hidden lg:table-cell">
          <Badge label={asset.opportunity_label} variant={labelVariant(asset.opportunity_label)} />
        </td>

        {/* Risk */}
        <td className="px-3 py-2.5 hidden lg:table-cell">
          <Badge label={asset.risk_label} variant={riskVariant(asset.risk_label)} />
        </td>

        {/* Setup */}
        <td className="px-3 py-2.5 text-xs text-mata-text-secondary hidden xl:table-cell">
          {asset.setup_type}
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="border-b border-mata-border bg-mata-surface/30 p-0">
            <div className="animate-slideInUp p-4 sm:p-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Sub-scores */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-mata-text-secondary mb-3">
                    Sub-Scores
                  </h4>
                  <ScoreBar label="Momentum" value={asset.momentum_score} />
                  <ScoreBar label="Breakout" value={asset.breakout_score} />
                  <ScoreBar label="Mean Reversion" value={asset.mean_reversion_score} />
                  <ScoreBar label="Catalyst" value={asset.catalyst_score} />
                  <ScoreBar label="Sentiment" value={asset.sentiment_score} />
                  <ScoreBar label="Volatility" value={asset.volatility_score} />
                  <ScoreBar label="Regime Fit" value={asset.regime_fit_score} />
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  {/* Larger sparkline */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-mata-text-secondary mb-2">
                      Price Chart
                    </h4>
                    <div className="mata-card mata-border rounded-lg p-3">
                      <Sparkline
                        data={asset.price_history}
                        width={320}
                        height={80}
                        strokeWidth={2}
                        fillOpacity={0.15}
                      />
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-mata-text-secondary mb-2">
                      Analysis
                    </h4>
                    <p className="text-sm text-mata-text leading-relaxed">
                      {asset.explanation}
                    </p>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs text-mata-text-muted">
                      Horizon: <span className="font-semibold text-mata-text">{asset.horizon_days}d</span>
                    </div>
                    {asset.sector && (
                      <div className="text-xs text-mata-text-muted">
                        Sector: <span className="font-semibold text-mata-text">{asset.sector}</span>
                      </div>
                    )}
                  </div>

                  {/* Add to basket button */}
                  <button className="rounded-lg bg-mata-orange px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-mata-orange/90 transition-colors">
                    Add to Basket
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
