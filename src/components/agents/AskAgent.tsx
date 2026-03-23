'use client';

import { useState, useRef, useEffect } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import type { AgentName } from '@/types';

interface AskAgentProps {
  /** Subject type for context grounding */
  subjectType: 'market' | 'ticker' | 'basket' | 'recommendation';
  /** Subject id (ticker, basket id, etc.) */
  subjectId?: string;
  /** Optional pre-built context (if not provided, API builds it) */
  context?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Suggested questions */
  suggestions?: string[];
}

interface RoutedAnswer {
  routedAgent: AgentName;
  routingReason: string;
  answer: string;
  structured: {
    stance: string;
    confidence: number;
    topDrivers: string[];
    risks: string[];
  } | null;
  status: string;
  tokensUsed: number;
  latencyMs: number;
}

export default function AskAgent({
  subjectType,
  subjectId,
  context,
  placeholder,
  suggestions,
}: AskAgentProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoutedAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleAsk(q?: string) {
    const finalQ = q ?? question;
    if (!finalQ.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/agents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: finalQ.trim(),
          subjectType,
          subjectId: subjectId ?? null,
          context: context ?? undefined,
        }),
      });

      if (res.ok) {
        setResult(await res.json());
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to get response');
      }
    } catch {
      setError('Connection error');
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-mata-text-secondary bg-mata-surface hover:bg-mata-border border border-mata-border transition-all"
      >
        <div className="flex -space-x-1">
          {(['Mark', 'Nia', 'Paul', 'Rex'] as const).map((a) => (
            <div key={a} className="ring-1 ring-mata-surface rounded-full">
              <AgentAvatar agentName={a} size="xs" />
            </div>
          ))}
        </div>
        Ask the team
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card overflow-hidden animate-[slideInUp_0.2s_ease-out]">
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mata-border">
        <div className="flex -space-x-1 flex-shrink-0">
          {result?.routedAgent ? (
            <AgentAvatar agentName={result.routedAgent} size="xs" />
          ) : (
            (['Mark', 'Nia', 'Paul', 'Rex'] as const).map((a) => (
              <div key={a} className="ring-1 ring-mata-card rounded-full">
                <AgentAvatar agentName={a} size="xs" />
              </div>
            ))
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder={placeholder ?? 'Ask a question...'}
          className="flex-1 text-[11px] text-mata-text bg-transparent focus:outline-none placeholder:text-mata-text-muted/50"
        />
        <button
          onClick={() => handleAsk()}
          disabled={!question.trim() || loading}
          className="rounded-md bg-mata-orange px-2.5 py-1 text-[9px] font-bold text-white hover:bg-mata-orange-dark disabled:opacity-50 transition-all"
        >
          {loading ? '...' : 'Ask'}
        </button>
        <button onClick={() => { setOpen(false); setResult(null); setError(null); }} className="text-mata-text-muted hover:text-mata-text text-xs p-0.5">✕</button>
      </div>

      {/* Quick suggestions */}
      {!result && !loading && suggestions && suggestions.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-mata-border/50">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setQuestion(s); handleAsk(s); }}
              className="rounded-md bg-mata-surface px-2 py-0.5 text-[9px] text-mata-text-secondary hover:bg-mata-border transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-3 animate-pulse space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-mata-surface" />
            <div className="h-2 w-16 rounded bg-mata-surface" />
          </div>
          <div className="h-3 w-full rounded bg-mata-surface" />
          <div className="h-3 w-2/3 rounded bg-mata-surface" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3">
          <p className="text-[10px] text-mata-red">{error}</p>
          <p className="text-[9px] text-mata-text-muted mt-1 italic">System data remains available.</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="p-3 space-y-2">
          {/* Routing info */}
          <div className="flex items-center gap-2">
            <AgentAvatar agentName={result.routedAgent} size="xs" />
            <span className="text-[10px] font-black text-mata-text">{result.routedAgent}</span>
            <span className="text-[8px] text-mata-text-muted italic">· {result.routingReason}</span>
          </div>

          {/* Stance + confidence */}
          {result.structured && result.status === 'success' && (
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${stanceColor[result.structured.stance] ?? 'bg-mata-surface'}`}>
                {result.structured.stance.toUpperCase()}
              </span>
              <span className="text-[8px] text-mata-text-muted">{Math.round(result.structured.confidence * 100)}% confidence</span>
            </div>
          )}

          {/* Answer text */}
          <p className="text-[11px] text-mata-text-secondary leading-relaxed">{result.answer}</p>

          {/* Drivers/Risks */}
          {result.structured && result.status === 'success' && (result.structured.topDrivers.length > 0 || result.structured.risks.length > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {result.structured.topDrivers.length > 0 && (
                <div>
                  <div className="text-[8px] font-black text-mata-green uppercase mb-0.5">Drivers</div>
                  {result.structured.topDrivers.map((d, i) => (
                    <div key={i} className="text-[9px] text-mata-text-secondary">+ {d}</div>
                  ))}
                </div>
              )}
              {result.structured.risks.length > 0 && (
                <div>
                  <div className="text-[8px] font-black text-mata-red uppercase mb-0.5">Risks</div>
                  {result.structured.risks.map((r, i) => (
                    <div key={i} className="text-[9px] text-mata-text-secondary">– {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Provenance */}
          <div className="pt-1.5 border-t border-mata-border/30 flex items-center justify-between text-[8px] text-mata-text-muted">
            <span>Routed → {result.routedAgent} · {result.tokensUsed} tokens · {(result.latencyMs / 1000).toFixed(1)}s</span>
            <span>{result.status === 'success' ? '✓' : result.status === 'fallback' ? '~' : '✕'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
