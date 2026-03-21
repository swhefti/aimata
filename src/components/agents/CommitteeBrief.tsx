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

interface SpecialistResult {
  agent: string;
  content: string;
  stance: string | null;
  confidence: number | null;
  status: string;
}

interface CommitteeResult {
  graphRunId: string;
  committeeBrief: string;
  committeeStructured: StructuredOutput | null;
  specialists: SpecialistResult[];
  status: string;
  totalTokens: number;
  totalLatencyMs: number;
}

export default function CommitteeBrief() {
  const [result, setResult] = useState<CommitteeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agents/committee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectType: 'basket' }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to generate committee brief');
        return;
      }

      setResult(await res.json());
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  const stanceColor: Record<string, string> = {
    bullish: 'text-mata-green bg-mata-green/10 border-mata-green/20',
    neutral: 'text-mata-blue bg-mata-blue/10 border-mata-blue/20',
    bearish: 'text-mata-red bg-mata-red/10 border-mata-red/20',
    cautious: 'text-mata-yellow bg-mata-yellow/10 border-mata-yellow/20',
    urgent: 'text-mata-red bg-mata-red/10 border-mata-red/20',
  };

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mata-border">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {(['Mark', 'Nia', 'Paul', 'Rex'] as const).map((a) => (
              <div key={a} className="ring-2 ring-mata-card rounded-full">
                <AgentAvatar agentName={a} size="xs" />
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-black text-mata-text">Committee Brief</h3>
            <p className="text-[8px] text-mata-text-muted">All 4 agents synthesized</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-mata-orange to-mata-orange-dark px-3 py-1.5 text-[9px] font-bold text-white hover:shadow-md hover:shadow-mata-orange/20 disabled:opacity-50 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" /></svg>
              Running...
            </span>
          ) : result ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {/* Content */}
      {loading && !result && (
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-3 w-3/4 rounded bg-mata-surface" />
          <div className="h-3 w-full rounded bg-mata-surface" />
          <div className="h-3 w-2/3 rounded bg-mata-surface" />
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[0,1,2,3].map(i => <div key={i} className="h-12 rounded bg-mata-surface" />)}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4">
          <div className="text-[10px] text-mata-red font-semibold">Committee unavailable</div>
          <p className="text-[10px] text-mata-text-muted mt-1">{error}</p>
          <p className="text-[9px] text-mata-text-muted mt-1 italic">Deterministic analytics remain available above.</p>
        </div>
      )}

      {result && (
        <div className="p-4 space-y-3">
          {/* Committee stance */}
          {result.committeeStructured && (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${stanceColor[result.committeeStructured.stance] ?? 'text-mata-text-muted bg-mata-surface'}`}>
                {result.committeeStructured.stance.toUpperCase()}
              </span>
              <span className="text-[9px] text-mata-text-muted">
                {Math.round(result.committeeStructured.confidence * 100)}% committee confidence
              </span>
            </div>
          )}

          {/* Committee narrative */}
          <p className="text-[11px] text-mata-text-secondary leading-relaxed">
            {result.committeeBrief}
          </p>

          {/* Drivers / Risks */}
          {result.committeeStructured && (
            <div className="grid grid-cols-2 gap-2">
              {result.committeeStructured.topDrivers.length > 0 && (
                <div className="rounded-lg bg-mata-green/5 border border-mata-green/10 px-3 py-2">
                  <div className="text-[8px] font-black text-mata-green uppercase mb-1">Drivers</div>
                  {result.committeeStructured.topDrivers.map((d, i) => (
                    <div key={i} className="text-[9px] text-mata-text-secondary">+ {d}</div>
                  ))}
                </div>
              )}
              {result.committeeStructured.risks.length > 0 && (
                <div className="rounded-lg bg-mata-red/5 border border-mata-red/10 px-3 py-2">
                  <div className="text-[8px] font-black text-mata-red uppercase mb-1">Risks</div>
                  {result.committeeStructured.risks.map((r, i) => (
                    <div key={i} className="text-[9px] text-mata-text-secondary">– {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Specialist breakdown (expandable) */}
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[9px] font-bold text-mata-text-muted hover:text-mata-text transition-colors"
            >
              {expanded ? '▾ Hide specialist views' : '▸ Show specialist views'} ({result.specialists.length} agents)
            </button>

            {expanded && (
              <div className="mt-2 space-y-1.5 animate-[slideInUp_0.15s_ease-out]">
                {result.specialists.map((s) => (
                  <div key={s.agent} className="flex items-start gap-2 rounded-lg bg-mata-surface/50 border border-mata-border/50 px-3 py-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <AgentAvatar agentName={s.agent as AgentName} size="xs" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-mata-text">{s.agent}</span>
                        {s.stance && (
                          <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${stanceColor[s.stance] ?? 'bg-mata-surface'}`}>
                            {s.stance}
                          </span>
                        )}
                        {s.confidence !== null && (
                          <span className="text-[7px] text-mata-text-muted">{Math.round(s.confidence * 100)}%</span>
                        )}
                        {s.status !== 'success' && (
                          <span className="text-[7px] text-mata-yellow bg-mata-yellow/10 px-1 rounded">{s.status}</span>
                        )}
                      </div>
                      <p className="text-[9px] text-mata-text-secondary leading-snug mt-0.5">{s.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Provenance */}
          <div className="pt-2 border-t border-mata-border/50 flex items-center justify-between text-[8px] text-mata-text-muted">
            <span>Committee · {result.totalTokens} tokens · {(result.totalLatencyMs / 1000).toFixed(1)}s</span>
            <span>{result.status === 'completed' ? '✓' : '⚠'} {result.graphRunId.substring(0, 8)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
