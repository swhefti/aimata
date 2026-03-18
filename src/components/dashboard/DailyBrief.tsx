'use client';

import { useMemo } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import type { OpportunityScore, BasketPosition, BasketAnalytics, AgentName } from '@/types';
import type { PositionSignal } from '@/lib/scoring/actions';
import { generateLocalBrief, type LocalBrief, type BriefSection } from '@/lib/briefs/local';

interface DailyBriefProps {
  positions: BasketPosition[];
  analytics: BasketAnalytics | null;
  opportunities: OpportunityScore[];
  signals: PositionSignal[];
  /** Claude-generated brief from API — shown as upgrade when available */
  claudeBrief?: { content: string; agent_name: string; created_at: string } | null;
  onRefreshClaude?: () => void;
  claudeLoading?: boolean;
}

// Agent color mapping for section borders
const agentBorderColor: Record<string, string> = {
  Mark: 'border-l-orange-400',
  Paul: 'border-l-blue-400',
  Nia: 'border-l-violet-400',
  Rex: 'border-l-red-400',
};

const agentBg: Record<string, string> = {
  Mark: 'bg-orange-50/50',
  Paul: 'bg-blue-50/50',
  Nia: 'bg-violet-50/50',
  Rex: 'bg-red-50/50',
};

function formatMarkdown(text: string): React.ReactNode {
  // Bold **text** and emoji preservation
  return text.split(/(\*\*[^*]+\*\*)/).map((segment, i) => {
    if (segment.startsWith('**') && segment.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-mata-text">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{segment}</span>;
  });
}

function BriefSectionCard({ section, index }: { section: BriefSection; index: number }) {
  const borderColor = agentBorderColor[section.agent] ?? 'border-l-gray-400';
  const bg = agentBg[section.agent] ?? 'bg-gray-50/50';

  return (
    <div
      className={`rounded-xl border border-mata-border ${bg} border-l-[3px] ${borderColor} overflow-hidden animate-[slideInUp_0.3s_ease-out_both]`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <AgentAvatar agentName={section.agent as AgentName} size="xs" />
        <div>
          <span className="text-[10px] font-black text-mata-text">{section.agent}</span>
          <span className="text-[9px] text-mata-text-muted ml-1.5">{section.title}</span>
        </div>
      </div>

      {/* Lines */}
      <div className="px-3 pb-3 space-y-1.5">
        {section.lines.map((line, i) => (
          <p key={i} className="text-[11px] text-mata-text-secondary leading-snug">
            {formatMarkdown(line)}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function DailyBrief({
  positions,
  analytics,
  opportunities,
  signals,
  claudeBrief,
  onRefreshClaude,
  claudeLoading,
}: DailyBriefProps) {
  // Always generate a local brief from current data
  const localBrief: LocalBrief = useMemo(
    () => generateLocalBrief(positions, analytics, opportunities, signals),
    [positions, analytics, opportunities, signals]
  );

  return (
    <div className="rounded-2xl border border-mata-border bg-mata-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mata-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AgentAvatar agentName="Paul" size="sm" />
          <div>
            <h2 className="text-sm font-black text-mata-text tracking-tight">Daily Brief</h2>
            <p className="text-[9px] text-mata-text-muted">{localBrief.summary}</p>
          </div>
        </div>

        {onRefreshClaude && (
          <button
            onClick={onRefreshClaude}
            disabled={claudeLoading}
            className="flex items-center gap-1 rounded-lg bg-mata-surface px-2.5 py-1 text-[9px] font-semibold text-mata-text-secondary hover:bg-mata-border transition-all disabled:opacity-50"
            title="Generate AI-enhanced brief"
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={claudeLoading ? 'animate-spin' : ''}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            AI Brief
          </button>
        )}
      </div>

      {/* Agent sections */}
      <div className="p-3 space-y-2">
        {localBrief.sections.map((section, i) => (
          <BriefSectionCard key={section.agent} section={section} index={i} />
        ))}
      </div>

      {/* Claude AI brief (if available) — shown below as enhanced version */}
      {claudeBrief && (
        <div className="border-t border-mata-border px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 w-1.5 rounded-full bg-mata-orange pulse-dot" />
            <span className="text-[9px] font-black text-mata-orange uppercase tracking-wider">AI-Enhanced Brief</span>
            <span className="text-[8px] text-mata-text-muted">
              {new Date(claudeBrief.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
              })}
            </span>
          </div>
          <div className="space-y-2">
            {claudeBrief.content.split(/\n\n+/).map((paragraph, i) => (
              <p key={i} className="text-[11px] text-mata-text-secondary leading-relaxed">
                {formatMarkdown(paragraph)}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
