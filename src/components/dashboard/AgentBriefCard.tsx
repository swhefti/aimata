'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import AgentModal from '@/components/agents/AgentModal';
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
  const [showModal, setShowModal] = useState(false);

  const previewLines = lines.slice(0, 2);
  const hasMore = lines.length > 2;

  return (
    <>
      <div className="relative pt-1">
        {/* Agent face + name — clickable to open modal */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 mb-1 ml-0.5 hover:opacity-80 transition-opacity"
          title={`Talk to ${agent}`}
        >
          <AgentAvatar agentName={agent} size="md" />
          <span className="text-[11px] font-black text-mata-text">{agent}</span>
        </button>

        {/* Speech bubble */}
        <div className="relative ml-3">
          <div className="absolute -top-1 left-3 w-2.5 h-2.5 bg-mata-card border-l border-t border-mata-border rotate-45 z-[5]" />

          <div
            className="relative z-[4] rounded-xl border border-mata-border bg-mata-card overflow-hidden cursor-pointer hover:border-mata-orange/20 transition-colors"
            onClick={() => hasMore ? setExpanded(!expanded) : setShowModal(true)}
          >
            <div className="px-3 pt-2.5 pb-2">
              <div className="space-y-0.5">
                {(expanded ? lines : previewLines).map((line, i) => (
                  <p key={i} className="text-[10px] text-mata-text-secondary leading-snug">
                    {formatMarkdown(line.text)}
                  </p>
                ))}
              </div>

              {hasMore && (
                <button className="text-[8px] font-bold text-mata-orange hover:text-mata-orange-dark transition-colors mt-1">
                  {expanded ? 'Show less' : `+${lines.length - 2} more`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Agent modal */}
      {showModal && (
        <AgentModal agent={agent} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
