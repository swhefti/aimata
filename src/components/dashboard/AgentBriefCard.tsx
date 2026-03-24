'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import type { AgentName } from '@/types';

interface BriefLine {
  text: string;
}

interface AgentBriefCardProps {
  agent: AgentName;
  title: string;
  lines: BriefLine[];
}

function formatMarkdown(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((segment, i) => {
    if (segment.startsWith('**') && segment.endsWith('**')) {
      return <strong key={i} className="font-bold text-mata-text">{segment.slice(2, -2)}</strong>;
    }
    return <span key={i}>{segment}</span>;
  });
}

export default function AgentBriefCard({ agent, title, lines }: AgentBriefCardProps) {
  const [expanded, setExpanded] = useState(false);

  const previewLines = lines.slice(0, 2);
  const hasMore = lines.length > 2;

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-mata-surface/50 transition-colors text-left"
      >
        <AgentAvatar agentName={agent} size="xs" />
        <div className="flex-1 min-w-0">
          <span className="text-[9px] font-black text-mata-text uppercase tracking-wider">{title}</span>
        </div>
        {hasMore && (
          <span className="text-[8px] text-mata-text-muted flex-shrink-0">{expanded ? '▾' : '▸'}</span>
        )}
      </button>

      <div className="px-3 pb-2 space-y-0.5">
        {(expanded ? lines : previewLines).map((line, i) => (
          <p key={i} className="text-[10px] text-mata-text-secondary leading-snug">
            {formatMarkdown(line.text)}
          </p>
        ))}
        {!expanded && hasMore && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[8px] text-mata-orange font-bold hover:text-mata-orange-dark transition-colors"
          >
            +{lines.length - 2} more
          </button>
        )}
      </div>
    </div>
  );
}
