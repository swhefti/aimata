'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import OpportunityCard from './OpportunityCard';
import type { OpportunityScore } from '@/types';

type OpportunityWithPrice = OpportunityScore & {
  last_price?: number;
  daily_change?: number;
  pct_change?: number;
  price_history?: number[];
};

interface OpportunityFeedProps {
  opportunities: OpportunityWithPrice[];
  onAddToBasket: (ticker: string) => void;
}

const INITIAL_COUNT = 9;
const INCREMENT = 6;
const MAX_COUNT = 21;

export default function OpportunityFeed({ opportunities, onAddToBasket }: OpportunityFeedProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [filter, setFilter] = useState<'All' | 'Hot Now' | 'Swing' | 'Run'>('All');

  const filtered = filter === 'All'
    ? opportunities
    : opportunities.filter((o) => o.opportunity_label === filter);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < Math.min(filtered.length, MAX_COUNT);

  const labelCounts = {
    'Hot Now': opportunities.filter(o => o.opportunity_label === 'Hot Now').length,
    'Swing': opportunities.filter(o => o.opportunity_label === 'Swing').length,
    'Run': opportunities.filter(o => o.opportunity_label === 'Run').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AgentAvatar agentName="Mark" size="sm" />
        <div>
          <h2 className="text-sm font-black text-mata-text tracking-tight">Mark&apos;s Scanner</h2>
          <p className="text-[10px] text-mata-text-muted">{opportunities.length} opportunities found</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {(['All', 'Hot Now', 'Swing', 'Run'] as const).map((tab) => {
          const count = tab === 'All' ? opportunities.length : labelCounts[tab];
          return (
            <button
              key={tab}
              onClick={() => { setFilter(tab); setVisibleCount(INITIAL_COUNT); }}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                filter === tab
                  ? 'bg-mata-orange text-white'
                  : 'bg-mata-surface text-mata-text-secondary hover:bg-mata-border'
              }`}
            >
              {tab} {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {visible.length > 0 ? (
        <div className="space-y-2">
          {visible.map((opp) => (
            <OpportunityCard
              key={opp.ticker}
              opportunity={opp}
              onAdd={onAddToBasket}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-mata-border bg-mata-surface/50 p-8 text-center">
          <p className="text-xs text-mata-text-muted">No {filter !== 'All' ? filter : ''} opportunities found</p>
          <p className="text-[10px] text-mata-text-muted mt-1">Run the scanner to discover new setups</p>
        </div>
      )}

      {/* See more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((prev) => Math.min(prev + INCREMENT, MAX_COUNT))}
          className="mt-3 w-full rounded-xl border border-mata-border bg-mata-surface py-2.5 text-xs font-bold text-mata-text-secondary hover:bg-mata-border hover:text-mata-text transition-all"
        >
          See more ({Math.min(INCREMENT, Math.min(filtered.length, MAX_COUNT) - visibleCount)} more)
        </button>
      )}
    </div>
  );
}
