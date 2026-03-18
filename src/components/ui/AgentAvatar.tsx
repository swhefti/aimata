import type { AgentName } from '@/types';
import { AGENTS } from '@/lib/agents';

interface AgentAvatarProps {
  agentName: AgentName;
  size?: 'sm' | 'md';
}

export default function AgentAvatar({ agentName, size = 'sm' }: AgentAvatarProps) {
  const agent = AGENTS[agentName];
  const sizeClasses = size === 'sm' ? 'h-6 gap-1.5 text-xs' : 'h-8 gap-2 text-sm';
  const iconSize = size === 'sm' ? 'w-5 h-5 text-sm' : 'w-7 h-7 text-base';

  return (
    <div className={`inline-flex items-center ${sizeClasses}`}>
      <span
        className={`${iconSize} flex items-center justify-center rounded-full`}
        style={{ backgroundColor: `${agent.color}18` }}
      >
        {agent.icon}
      </span>
      <span className="font-bold" style={{ color: agent.color }}>
        {agent.name}
      </span>
      {size === 'md' && (
        <span className="text-mata-text-muted font-medium">{agent.role}</span>
      )}
    </div>
  );
}
