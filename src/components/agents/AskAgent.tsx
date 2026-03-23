'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import type { AgentName } from '@/types';

interface AskAgentProps {
  subjectType: 'market' | 'ticker' | 'basket' | 'recommendation';
  subjectId?: string;
  context?: string;
  placeholder?: string;
  suggestions?: string[];
}

interface ThreadMessage {
  id: string;
  role: string;
  agent_name: string | null;
  content: string;
  structured_output: {
    stance?: string;
    confidence?: number;
    topDrivers?: string[];
    risks?: string[];
  } | null;
  tokens_used: number;
  latency_ms: number;
  created_at: string;
}

interface ThreadData {
  id: string;
  routed_agent: string | null;
  routing_reason: string | null;
  messages: ThreadMessage[];
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
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load thread history when opened
  const loadThreads = useCallback(async () => {
    try {
      const params = new URLSearchParams({ subjectType });
      if (subjectId) params.set('subjectId', subjectId);
      const res = await fetch(`/api/agents/threads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads ?? []);
      }
    } catch { /* silent */ }
  }, [subjectType, subjectId]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      loadThreads();
    }
  }, [open, loadThreads]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [threads]);

  async function handleAsk(q?: string) {
    const finalQ = q ?? question;
    if (!finalQ.trim() || loading) return;
    setLoading(true);
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
        setQuestion('');
        // Reload threads to show the new exchange
        await loadThreads();
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

  // Flatten all messages from all threads for display
  const allMessages: (ThreadMessage & { threadAgent: string | null; threadReason: string | null })[] = [];
  for (const t of threads) {
    for (const m of t.messages) {
      allMessages.push({ ...m, threadAgent: t.routed_agent, threadReason: t.routing_reason });
    }
  }

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
        {allMessages.length > 0 && (
          <span className="ml-1 text-[8px] text-mata-text-muted">({allMessages.length})</span>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card overflow-hidden animate-[slideInUp_0.2s_ease-out]">
      {/* Thread history */}
      {allMessages.length > 0 && (
        <div ref={scrollRef} className="max-h-64 overflow-y-auto px-3 py-2 space-y-2 border-b border-mata-border/50">
          {allMessages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && m.agent_name && (
                <div className="flex-shrink-0 mt-0.5">
                  <AgentAvatar agentName={m.agent_name as AgentName} size="xs" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 ${
                m.role === 'user'
                  ? 'bg-mata-orange/10 text-mata-text'
                  : 'bg-mata-surface text-mata-text-secondary'
              }`}>
                {m.role === 'assistant' && m.agent_name && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[8px] font-black text-mata-text">{m.agent_name}</span>
                    {m.structured_output?.stance && (
                      <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${stanceColor[m.structured_output.stance] ?? 'bg-mata-surface'}`}>
                        {m.structured_output.stance}
                      </span>
                    )}
                    {m.threadReason && (
                      <span className="text-[7px] text-mata-text-muted italic">{m.threadReason}</span>
                    )}
                  </div>
                )}
                <p className="text-[10px] leading-snug">{m.content}</p>
                <div className="text-[7px] text-mata-text-muted mt-0.5">
                  {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  {m.role === 'assistant' && m.tokens_used > 0 && ` · ${m.tokens_used} tok`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2">
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
        <button onClick={() => { setOpen(false); }} className="text-mata-text-muted hover:text-mata-text text-xs p-0.5">✕</button>
      </div>

      {/* Quick suggestions (only when no messages yet) */}
      {allMessages.length === 0 && !loading && suggestions && suggestions.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-1 border-t border-mata-border/50">
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
        <div className="px-3 py-2 flex items-center gap-2 border-t border-mata-border/50">
          <div className="h-4 w-4 rounded-full bg-mata-surface animate-pulse" />
          <div className="h-2 w-24 rounded bg-mata-surface animate-pulse" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 border-t border-mata-border/50">
          <p className="text-[10px] text-mata-red">{error}</p>
        </div>
      )}
    </div>
  );
}
