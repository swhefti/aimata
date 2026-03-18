import type { AgentName } from '@/types';
import { AGENTS } from '@/lib/agents';
import AgentAvatar from '@/components/ui/AgentAvatar';

interface AgentCommentaryProps {
  agentName: AgentName;
  commentary: string;
  loading?: boolean;
}

function CommentarySkeleton({ color }: { color: string }) {
  return (
    <div
      className="animate-pulse rounded-xl border-l-4 bg-mata-surface/50 p-4 space-y-2"
      style={{ borderColor: color }}
    >
      <div className="h-4 w-1/3 rounded bg-mata-surface" />
      <div className="h-3 w-full rounded bg-mata-surface" />
      <div className="h-3 w-5/6 rounded bg-mata-surface" />
      <div className="h-3 w-2/3 rounded bg-mata-surface" />
    </div>
  );
}

export default function AgentCommentary({
  agentName,
  commentary,
  loading,
}: AgentCommentaryProps) {
  const agent = AGENTS[agentName];

  if (loading) {
    return <CommentarySkeleton color={agent.color} />;
  }

  return (
    <div
      className="rounded-xl border-l-4 bg-mata-card border border-mata-border p-4"
      style={{ borderLeftColor: agent.color }}
    >
      <div className="mb-2">
        <AgentAvatar agentName={agentName} size="sm" />
      </div>
      <p className="text-sm leading-relaxed text-mata-text-secondary">{commentary}</p>
    </div>
  );
}
