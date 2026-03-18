'use client';

import { AGENTS } from '@/lib/agents';
import type { AgentName } from '@/types';

interface AgentAvatarProps {
  agentName: AgentName;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  showRole?: boolean;
}

const sizeMap = {
  xs: { container: 'w-6 h-6', text: 'text-[9px]', ring: 'ring-1' },
  sm: { container: 'w-8 h-8', text: 'text-xs', ring: 'ring-2' },
  md: { container: 'w-10 h-10', text: 'text-sm', ring: 'ring-2' },
  lg: { container: 'w-14 h-14', text: 'text-lg', ring: 'ring-2' },
};

// Each agent gets a distinct shape and style
const agentStyles: Record<string, { shape: string; gradient: string; ringColor: string; initial: string }> = {
  Mark: {
    shape: 'rounded-lg rotate-3',
    gradient: 'from-orange-400 to-red-500',
    ringColor: 'ring-orange-400/30',
    initial: 'M',
  },
  Paul: {
    shape: 'rounded-full',
    gradient: 'from-blue-400 to-indigo-500',
    ringColor: 'ring-blue-400/30',
    initial: 'P',
  },
  Nia: {
    shape: 'rounded-xl -rotate-3',
    gradient: 'from-violet-400 to-purple-500',
    ringColor: 'ring-violet-400/30',
    initial: 'N',
  },
  Rex: {
    shape: 'rounded-lg rotate-0 [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
    gradient: 'from-red-400 to-rose-600',
    ringColor: 'ring-red-400/30',
    initial: 'R',
  },
};

export default function AgentAvatar({ agentName, size = 'sm', showName, showRole }: AgentAvatarProps) {
  const agent = AGENTS[agentName];
  const s = sizeMap[size];
  const style = agentStyles[agentName] ?? agentStyles.Mark;

  return (
    <div className="flex items-center gap-2">
      <div className={`${s.container} ${style.shape} ${style.ringColor} ${s.ring} bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-sm`}>
        <span className={`${s.text} font-black text-white drop-shadow-sm`}>
          {style.initial}
        </span>
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
