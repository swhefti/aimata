'use client';

import Image from 'next/image';
import { AGENTS } from '@/lib/agents';
import type { AgentName } from '@/types';

interface AgentAvatarProps {
  agentName: AgentName;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  showRole?: boolean;
}

const sizeMap = {
  xs: { px: 20, cls: 'w-5 h-5' },
  sm: { px: 28, cls: 'w-7 h-7' },
  md: { px: 36, cls: 'w-9 h-9' },
  lg: { px: 48, cls: 'w-12 h-12' },
};

const agentImages: Record<string, string> = {
  Mark: '/agents/mark.png',
  Nia: '/agents/nia.png',
  Rex: '/agents/rex.png',
};

const agentRingColor: Record<string, string> = {
  Mark: 'ring-orange-400/40',
  Nia: 'ring-violet-400/40',
  Rex: 'ring-red-400/40',
  Paul: 'ring-blue-400/40',
};

export default function AgentAvatar({ agentName, size = 'sm', showName, showRole }: AgentAvatarProps) {
  const agent = AGENTS[agentName];
  const s = sizeMap[size];
  const imgSrc = agentImages[agentName];
  const ringColor = agentRingColor[agentName] ?? 'ring-mata-border';

  return (
    <div className="flex items-center gap-1.5">
      <div className={`${s.cls} rounded-full overflow-hidden ring-2 ${ringColor} flex-shrink-0 bg-mata-surface`}>
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={agentName}
            width={s.px}
            height={s.px}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-500">
            <span className="text-[9px] font-black text-white">{agentName[0]}</span>
          </div>
        )}
      </div>
      {(showName || showRole) && agent && (
        <div className="min-w-0">
          {showName && <div className="text-xs font-black text-mata-text leading-tight">{agent.name}</div>}
          {showRole && <div className="text-[9px] text-mata-text-muted truncate">{agent.role}</div>}
        </div>
      )}
    </div>
  );
}
