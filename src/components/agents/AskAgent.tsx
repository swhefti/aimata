'use client';

import { useState, useRef, useEffect } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import type { AgentName } from '@/types';

interface AskAgentProps {
  /** Which agent to ask */
  agent: AgentName;
  /** Pre-filled context (subject data) */
  context: string;
  /** Subject type */
  subjectType: 'market' | 'ticker' | 'basket' | 'recommendation';
  /** Subject id */
  subjectId?: string;
  /** Placeholder text */
  placeholder?: string;
}

export default function AskAgent({
  agent,
  context,
  subjectType,
  subjectId,
  placeholder,
}: AskAgentProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [structured, setStructured] = useState<{
    stance: string;
    confidence: number;
    topDrivers: string[];
    risks: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleAsk() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    setStructured(null);

    try {
      const res = await fetch('/api/agents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          question: question.trim(),
          context,
          subjectType,
          subjectId: subjectId ?? null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnswer(data.artifact?.content ?? 'No response.');
        setStructured(data.artifact?.structured_output ?? null);
      } else {
        setAnswer('Failed to get response.');
      }
    } catch {
      setAnswer('Connection error.');
    } finally {
      setLoading(false);
    }
  }

  const stanceColor: Record<string, string> = {
    bullish: 'text-mata-green',
    neutral: 'text-mata-blue',
    bearish: 'text-mata-red',
    cautious: 'text-mata-yellow',
    urgent: 'text-mata-red',
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-mata-text-secondary bg-mata-surface hover:bg-mata-border border border-mata-border transition-all"
      >
        <AgentAvatar agentName={agent} size="xs" />
        Ask {agent}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-mata-border bg-mata-card overflow-hidden animate-[slideInUp_0.2s_ease-out]">
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mata-border">
        <AgentAvatar agentName={agent} size="xs" />
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder={placeholder ?? `Ask ${agent} a question...`}
          className="flex-1 text-[11px] text-mata-text bg-transparent focus:outline-none placeholder:text-mata-text-muted/50"
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || loading}
          className="rounded-md bg-mata-orange px-2 py-1 text-[9px] font-bold text-white hover:bg-mata-orange-dark disabled:opacity-50 transition-all"
        >
          {loading ? '...' : 'Ask'}
        </button>
        <button onClick={() => setOpen(false)} className="text-mata-text-muted hover:text-mata-text text-xs p-0.5">✕</button>
      </div>

      {/* Response */}
      {loading && (
        <div className="p-3 animate-pulse space-y-2">
          <div className="h-3 w-full rounded bg-mata-surface" />
          <div className="h-3 w-2/3 rounded bg-mata-surface" />
        </div>
      )}

      {answer && !loading && (
        <div className="p-3">
          {structured && (
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[9px] font-black ${stanceColor[structured.stance] ?? 'text-mata-text-muted'}`}>
                {structured.stance.toUpperCase()}
              </span>
              <span className="text-[8px] text-mata-text-muted">
                {Math.round(structured.confidence * 100)}% confidence
              </span>
            </div>
          )}
          <p className="text-[11px] text-mata-text-secondary leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}
