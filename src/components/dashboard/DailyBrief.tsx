'use client';

import AgentAvatar from '@/components/ui/AgentAvatar';
import type { AgentName } from '@/types';

interface DailyBriefProps {
  brief: {
    content: string;
    agent_name: string;
    created_at: string;
  } | null;
  onRefresh: () => void;
  loading?: boolean;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function BriefSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-5">
      <div className="h-4 w-2/3 rounded bg-mata-surface" />
      <div className="h-4 w-full rounded bg-mata-surface" />
      <div className="h-4 w-5/6 rounded bg-mata-surface" />
      <div className="h-4 w-3/4 rounded bg-mata-surface" />
      <div className="h-4 w-1/2 rounded bg-mata-surface" />
    </div>
  );
}

function formatBriefContent(content: string): React.ReactNode {
  // Split on double newlines for paragraphs, single newlines for line breaks
  const paragraphs = content.split(/\n\n+/);

  return paragraphs.map((paragraph, i) => {
    const lines = paragraph.split('\n');
    return (
      <p key={i} className="text-sm leading-relaxed text-mata-text-secondary">
        {lines.map((line, j) => (
          <span key={j}>
            {j > 0 && <br />}
            {/* Bold text between ** markers */}
            {line.split(/(\*\*[^*]+\*\*)/).map((segment, k) => {
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return (
                  <strong key={k} className="font-bold text-mata-text">
                    {segment.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={k}>{segment}</span>;
            })}
          </span>
        ))}
      </p>
    );
  });
}

export default function DailyBrief({ brief, onRefresh, loading }: DailyBriefProps) {
  return (
    <div className="rounded-2xl border border-mata-border bg-mata-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mata-border px-5 py-4">
        <div className="flex items-center gap-3">
          <AgentAvatar
            agentName={(brief?.agent_name as AgentName) ?? 'Paul'}
            size="md"
          />
          <div>
            <h2 className="text-lg font-black text-mata-text tracking-tight">
              Daily Brief
            </h2>
            {brief && (
              <p className="text-[11px] text-mata-text-muted">
                {formatTimestamp(brief.created_at)}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-mata-surface px-3 py-1.5 text-xs font-semibold text-mata-text-secondary transition-all hover:bg-mata-border hover:text-mata-text disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={loading ? 'animate-spin' : ''}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <BriefSkeleton />
      ) : brief ? (
        <div className="space-y-3 px-5 py-4">
          {formatBriefContent(brief.content)}
        </div>
      ) : (
        <div className="flex flex-col items-center py-12 px-6 text-center">
          <span className="text-2xl mb-2">📋</span>
          <p className="text-sm text-mata-text-muted">
            No brief available yet. Click refresh to generate one.
          </p>
        </div>
      )}
    </div>
  );
}
