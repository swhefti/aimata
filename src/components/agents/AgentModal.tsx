'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import AgentAvatar from '@/components/ui/AgentAvatar';
import { AGENTS } from '@/lib/agents';
import type { AgentName } from '@/types';

interface AgentModalProps {
  agent: AgentName;
  onClose: () => void;
}

interface ThreadMessage {
  id: string;
  role: string;
  agent_name: string | null;
  content: string;
  structured_output: { stance?: string; confidence?: number } | null;
  created_at: string;
}

interface ThreadData {
  messages: ThreadMessage[];
  routed_agent: string | null;
}

const AGENT_INTROS: Record<string, string> = {
  Mark: "Hey — I'm Mark. I scan the entire market every cycle to find you the strongest short-term setups. Momentum, breakouts, timing — that's my world. Ask me what's hot, what's moving, or which setup looks strongest right now.",
  Nia: "Hi, I'm Nia. I'm the one who reads between the lines — news, catalysts, sentiment shifts, and the stories that drive real moves. I'll tell you whether a move has substance or if it's just noise. Ask me what's really going on.",
  Rex: "I'm Rex. I manage your basket — I watch risk, concentration, and balance, and I tell you exactly what to do. Add, hold, trim, or exit. No sugarcoating. Ask me about any position or whether your basket needs work.",
};

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  Mark: [
    "What's the strongest setup right now?",
    "Any breakouts I should watch?",
    "Which Hot Now picks do you like most?",
    "What scored highest today?",
  ],
  Nia: [
    "What's the most important news today?",
    "Is there a real catalyst behind the top movers?",
    "Which names have narrative momentum?",
    "Any sentiment shifts I should know about?",
  ],
  Rex: [
    "Is my basket balanced?",
    "Should I trim anything?",
    "What's the biggest risk in my basket?",
    "Any positions I should exit?",
  ],
};

export default function AgentModal({ agent, onClose }: AgentModalProps) {
  const agentInfo = AGENTS[agent];
  const intro = AGENT_INTROS[agent] ?? '';
  const suggestions = SUGGESTED_QUESTIONS[agent] ?? [];

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; agent?: string }[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load past threads for this agent's subject
  const loadHistory = useCallback(async () => {
    try {
      const subjectType = agent === 'Mark' ? 'market' : agent === 'Rex' ? 'basket' : 'market';
      const res = await fetch(`/api/agents/threads?subjectType=${subjectType}`);
      if (res.ok) {
        const data = await res.json();
        const threads: ThreadData[] = data.threads ?? [];
        const hist: { role: string; content: string; agent?: string }[] = [];
        for (const t of threads.slice(0, 3)) {
          for (const m of t.messages) {
            if (m.agent_name === agent || m.role === 'user') {
              hist.push({ role: m.role, content: m.content, agent: m.agent_name ?? undefined });
            }
          }
        }
        if (hist.length > 0) setMessages(hist);
      }
    } catch { /* silent */ }
    setThreadsLoaded(true);
  }, [agent]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function handleAsk(q?: string) {
    const finalQ = q ?? question;
    if (!finalQ.trim() || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: finalQ.trim() }]);
    setQuestion('');
    setLoading(true);

    try {
      const subjectType = agent === 'Mark' ? 'market' : agent === 'Rex' ? 'basket' : 'market';
      const res = await fetch('/api/agents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: finalQ.trim(), subjectType }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer ?? 'No response.',
          agent: data.routedAgent ?? agent,
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I couldn\'t process that right now.', agent }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error.', agent }]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

      <div
        className="relative w-full max-w-md max-h-[85vh] bg-mata-card rounded-2xl border border-mata-border shadow-2xl overflow-hidden flex flex-col animate-[slideInUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — agent profile */}
        <div className="px-5 pt-5 pb-4 border-b border-mata-border bg-gradient-to-b from-mata-surface/50 to-transparent">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AgentAvatar agentName={agent} size="lg" />
              <div>
                <h2 className="text-lg font-black text-mata-text">{agentInfo.name}</h2>
                <p className="text-[10px] font-semibold text-mata-text-muted uppercase tracking-wider">{agentInfo.role}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-mata-text-muted hover:text-mata-text hover:bg-mata-surface transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Agent intro — first person */}
          <p className="mt-3 text-[11px] text-mata-text-secondary leading-relaxed italic">
            &ldquo;{intro}&rdquo;
          </p>
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[200px]">
          {!threadsLoaded ? (
            <div className="animate-pulse space-y-2 pt-4">
              <div className="h-3 w-2/3 rounded bg-mata-surface" />
              <div className="h-3 w-1/2 rounded bg-mata-surface" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center pt-6">
              <p className="text-[10px] text-mata-text-muted mb-3">Ask {agent} a question</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-0.5">
                    <AgentAvatar agentName={(m.agent ?? agent) as AgentName} size="xs" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  m.role === 'user'
                    ? 'bg-mata-orange/10 text-mata-text'
                    : 'bg-mata-surface text-mata-text-secondary'
                }`}>
                  <p className="text-[11px] leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-2">
              <div className="flex-shrink-0 mt-0.5"><AgentAvatar agentName={agent} size="xs" /></div>
              <div className="rounded-xl bg-mata-surface px-3 py-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-mata-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-mata-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-mata-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested questions — shown when no conversation yet */}
        {messages.length === 0 && !loading && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleAsk(s)}
                className="rounded-lg bg-mata-surface border border-mata-border px-2.5 py-1.5 text-[10px] text-mata-text-secondary hover:bg-mata-border hover:text-mata-text transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-mata-border px-4 py-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder={`Ask ${agent}...`}
            className="flex-1 text-[12px] text-mata-text bg-transparent focus:outline-none placeholder:text-mata-text-muted/50"
            autoFocus
          />
          <button
            onClick={() => handleAsk()}
            disabled={!question.trim() || loading}
            className="rounded-lg bg-mata-orange px-3 py-1.5 text-[10px] font-bold text-white hover:bg-mata-orange-dark disabled:opacity-50 transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
