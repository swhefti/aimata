'use client';

import { useState, useMemo } from 'react';
import type { OpportunityScore } from '@/types';
import AgentAvatar from '@/components/ui/AgentAvatar';
import OpportunityCard from './OpportunityCard';

interface OpportunityFeedProps {
  opportunities: (OpportunityScore & {
    last_price?: number;
    daily_change?: number;
    pct_change?: number;
  })[];
  onAddToBasket: (ticker: string) => void;
}

const TABS = ['All', 'Hot Now', 'Swing', 'Run'] as const;

export default function OpportunityFeed({
  opportunities,
  onAddToBasket,
}: OpportunityFeedProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('All');

  const filtered = useMemo(() => {
    if (activeTab === 'All') return opportunities;
    return opportunities.filter((o) => o.opportunity_label === activeTab);
  }, [opportunities, activeTab]);

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AgentAvatar agentName="Mark" size="md" />
          <div>
            <h2 className="text-lg font-black text-mata-text tracking-tight">
              Mark&apos;s Scanner
            </h2>
            <p className="text-xs text-mata-text-muted">
              {opportunities.length} opportunities found
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-mata-surface rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-mata-card text-mata-orange shadow-sm'
                : 'text-mata-text-muted hover:text-mata-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((opp) => (
            <OpportunityCard
              key={opp.ticker}
              opportunity={opp}
              onAdd={onAddToBasket}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-mata-border bg-mata-surface/50 py-16 px-8">
          <span className="text-3xl mb-3">🔍</span>
          <p className="text-sm font-semibold text-mata-text-secondary">
            No opportunities match this filter
          </p>
          <p className="text-xs text-mata-text-muted mt-1">
            Try switching to &quot;All&quot; to see everything Mark found
          </p>
        </div>
      )}
    </section>
  );
}
