'use client';

import { useState } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import type { AgentName } from '@/types';

interface StructuredOutput {
  stance: string;
  confidence: number;
  topDrivers: string[];
  risks: string[];
  summary: string;
}

interface Artifact {
  agent_name: AgentName;
  content: string;
  structured_output: StructuredOutput | null;
  subject_type: string;
  subject_id: string | null;
  prompt_key: string;
  prompt_version: string;
  model: string;
  tokens_used: number | null;
  latency_ms: number | null;
  status: 'success' | 'failed' | 'fallback';
  created_at: string;
}

interface ExplainDrawerProps {
  type: 'ticker' | 'basket' | 'action';
  ticker?: string;
  agent?: AgentName;
  label?: string;
  deterministicData?: { label: string; value: string; color?: string }[];
}

export default function ExplainDrawer({
  type,
  ticker,
  agent,
  label = 'Why?',
  deterministicData,
}: ExplainDrawerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agentName = agent ?? (type === 'ticker' ? 'Mark' : type === 'basket' ? 'Paul' : 'Rex');

  async function handleExplain() {
    if (artifact) { setOpen(!open); return; }

    setOpen(true);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agents/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ticker, agent: agentName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to generate explanation');
        return;
      }

      const data = await res.json();
      setArtifact(data.artifact);
    } catch {
      setError('Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  const stanceColor: Record<string, string> = {
    bullish: 'text-mata-green bg-mata-green/10',
    neutral: 'text-mata-blue bg-mata-blue/10',
    bearish: 'text-mata-red bg-mata-red/10',
    cautious: 'text-mata-yellow bg-mata-yellow/10',
    urgent: 'text-mata-red bg-mata-red/10',
  };

  return (
    <>
      <button
        onClick={handleExplain}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-bold text-mata-orange bg-mata-orange/5 hover:bg-mata-orange/10 border border-mata-orange/20 transition-all"
      >
        <AgentAvatar agentName={agentName} size="xs" />
        <span>{label}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-mata-border bg-mata-card overflow-hidden animate-[slideInUp_0.2s_ease-out]">
          {loading ? (
            <div className="p-4 animate-pulse space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-mata-surface" />
                <div className="h-3 w-24 rounded bg-mata-surface" />
              </div>
              <div className="h-3 w-full rounded bg-mata-surface" />
              <div className="h-3 w-3/4 rounded bg-mata-surface" />
            </div>
          ) : error ? (
            <div className="p-3">
              <div className="text-[10px] text-mata-red mb-1 font-semibold">Agent unavailable</div>
              <p className="text-[10px] text-mata-text-secondary">{error}</p>
              {deterministicData && (
                <p className="text-[9px] text-mata-text-muted mt-2 italic">System data above remains valid.</p>
              )}
            </div>
          ) : artifact ? (
            <div>
              {/* Header: agent + status */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <AgentAvatar agentName={artifact.agent_name} size="sm" showName />
                  <span className="text-[8px] text-mata-text-muted italic">agent commentary</span>
                </div>
                <div className="flex items-center gap-2">
                  {artifact.structured_output && artifact.status === 'success' && (
                    <>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${stanceColor[artifact.structured_output.stance] ?? 'text-mata-text-muted bg-mata-surface'}`}>
                        {artifact.structured_output.stance.toUpperCase()}
                      </span>
                      <span className="text-[9px] text-mata-text-muted">
                        {Math.round(artifact.structured_output.confidence * 100)}%
                      </span>
                    </>
                  )}
                  {artifact.status === 'failed' && (
                    <span className="text-[8px] text-mata-red bg-mata-red/10 px-1.5 py-0.5 rounded">fallback</span>
                  )}
                  {artifact.status === 'fallback' && (
                    <span className="text-[8px] text-mata-yellow bg-mata-yellow/10 px-1.5 py-0.5 rounded">partial</span>
                  )}
                  <button onClick={() => setOpen(false)} className="text-mata-text-muted hover:text-mata-text text-xs p-0.5">✕</button>
                </div>
              </div>

              {/* System data (deterministic — NOT from the agent) */}
              {deterministicData && deterministicData.length > 0 && (
                <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-mata-surface/50 border border-mata-border/50">
                  <div className="text-[8px] font-black text-mata-text-muted uppercase tracking-wider mb-1">
                    System Data <span className="font-normal normal-case">(deterministic, not AI)</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {deterministicData.map((d, i) => (
                      <div key={i} className="text-[10px]">
                        <span className="text-mata-text-muted">{d.label}: </span>
                        <span className={`font-bold ${d.color ?? 'text-mata-text'}`}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agent narrative */}
              <div className="px-3 pb-2">
                <p className="text-[11px] text-mata-text-secondary leading-relaxed">{artifact.content}</p>
              </div>

              {/* Structured: drivers + risks */}
              {artifact.structured_output && artifact.status === 'success' && (
                <div className="px-3 pb-2 grid grid-cols-2 gap-2">
                  {artifact.structured_output.topDrivers.length > 0 && (
                    <div>
                      <div className="text-[8px] font-black text-mata-green uppercase mb-1">Drivers</div>
                      {artifact.structured_output.topDrivers.map((d, i) => (
                        <div key={i} className="text-[9px] text-mata-text-secondary flex gap-1">
                          <span className="text-mata-green flex-shrink-0">+</span> {d}
                        </div>
                      ))}
                    </div>
                  )}
                  {artifact.structured_output.risks.length > 0 && (
                    <div>
                      <div className="text-[8px] font-black text-mata-red uppercase mb-1">Risks</div>
                      {artifact.structured_output.risks.map((r, i) => (
                        <div key={i} className="text-[9px] text-mata-text-secondary flex gap-1">
                          <span className="text-mata-red flex-shrink-0">–</span> {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Provenance footer */}
              <div className="px-3 py-1.5 border-t border-mata-border/50 flex items-center justify-between text-[8px] text-mata-text-muted">
                <span>{artifact.model} · prompt v{artifact.prompt_version} · {artifact.tokens_used ?? '?'} tokens</span>
                <span>{artifact.latency_ms ? `${(artifact.latency_ms / 1000).toFixed(1)}s` : ''} · {new Date(artifact.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
