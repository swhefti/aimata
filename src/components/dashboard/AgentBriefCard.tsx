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
    <div className="relative">
      {/* Agent face — sits at top-left, overlapping the bubble */}
      <div className="absolute -top-2 -left-1 z-10">
        <AgentAvatar agentName={agent} size="sm" />
      </div>

      {/* Speech bubble */}
      <div
        className="rounded-xl border border-mata-border bg-mata-card overflow-hidden ml-3 mt-2 cursor-pointer hover:border-mata-orange/20 transition-colors"
        onClick={() => hasMore && setExpanded(!expanded)}
      >
        {/* Speech bubble pointer (triangle pointing to the avatar) */}
        <div className="absolute top-4 left-1.5 w-2 h-2 bg-mata-card border-l border-t border-mata-border rotate-[-45deg] z-[5]" />

        <div className="px-3 pt-2 pb-2">
          {/* Title */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-black text-mata-text-muted uppercase tracking-wider">{title}</span>
            {hasMore && (
              <span className="text-[8px] text-mata-text-muted">{expanded ? '▾' : `+${lines.length - 2}`}</span>
            )}
          </div>

          {/* Content */}
          <div className="space-y-0.5">
            {(expanded ? lines : previewLines).map((line, i) => (
              <p key={i} className="text-[10px] text-mata-text-secondary leading-snug">
                {formatMarkdown(line.text)}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
