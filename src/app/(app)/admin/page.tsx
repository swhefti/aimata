'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SystemConfig } from '@/types';
import { CONFIG_MANIFEST } from '@/lib/config/manifest';
import ConfigEditor from '@/components/admin/ConfigEditor';

/* ─── Types ─── */
type Tab = 'overview' | 'runs' | 'agents' | 'evaluation' | 'config' | 'activity';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'runs', label: 'Runs' },
  { key: 'agents', label: 'Agents' },
  { key: 'evaluation', label: 'Evaluation' },
  { key: 'config', label: 'Config' },
  { key: 'activity', label: 'Activity' },
];

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400 border-green-500/20',
  failed: 'bg-red-500/15 text-red-400 border-red-500/20',
  running: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  pending: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

const AGENT_COLORS: Record<string, string> = {
  Mark: 'text-orange-400',
  Nia: 'text-purple-400',
  Paul: 'text-blue-400',
  Rex: 'text-red-400',
};

/* ─── Helpers ─── */
function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-mata-surface ${className}`} />;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-mata-border bg-mata-card py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mata-red/10">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mata-red">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-mata-text">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-xl bg-mata-surface px-5 py-2 text-sm font-semibold text-mata-text-secondary hover:bg-mata-border transition-colors">
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-mata-border bg-mata-card py-16">
      <p className="text-sm text-mata-text-muted">{message}</p>
    </div>
  );
}

/* ─── Data Hook ─── */
function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

/* ─── Tab Components ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OverviewTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error, reload } = useFetch<any>('/api/admin/overview');

  if (loading) return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-mata-border bg-mata-card p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <EmptyState message="No overview data available." />;

  const cards = [
    { title: 'Scanner Runs', main: data.scannerRuns?.total ?? 0, sub: `Today: ${data.scannerRuns?.today ?? 0} | Last: ${data.scannerRuns?.lastRunAt ?? 'N/A'}` },
    { title: 'Graph Runs', main: data.graphRuns?.total ?? 0, sub: `Today: ${data.graphRuns?.today ?? 0} | Failed: ${data.graphRuns?.failed ?? 0} | Avg: ${data.graphRuns?.avgLatencyMs ?? 0}ms` },
    { title: 'Agent Calls', main: data.agentCalls?.total ?? 0, sub: `Today: ${data.agentCalls?.today ?? 0} | Tokens: ${(data.agentCalls?.totalTokens ?? 0).toLocaleString()} | $${(data.agentCalls?.estimatedCost ?? 0).toFixed(2)}` },
    { title: 'Active Users', main: data.activeUsers ?? 0, sub: '' },
    { title: 'Feed Size', main: data.feedSize ?? 0, sub: '' },
    { title: 'Errors', main: data.errors?.total ?? 0, sub: `Today: ${data.errors?.today ?? 0}` },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.title} className="rounded-2xl border border-mata-border bg-mata-card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-mata-text-muted">{c.title}</p>
          <p className="mt-2 text-3xl font-black text-mata-text">{typeof c.main === 'number' ? c.main.toLocaleString() : c.main}</p>
          {c.sub && <p className="mt-1 text-xs text-mata-text-muted">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function RunsTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error, reload } = useFetch<any[]>('/api/admin/runs');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodeRuns, setNodeRuns] = useState<Record<string, any[]>>({});
  const [nodeLoading, setNodeLoading] = useState<string | null>(null);

  const handleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (nodeRuns[id]) return;
    setNodeLoading(id);
    try {
      const res = await fetch(`/api/admin/runs/${id}`);
      if (res.ok) {
        const detail = await res.json();
        setNodeRuns((prev) => ({ ...prev, [id]: detail.nodeRuns ?? detail.node_runs ?? [] }));
      }
    } catch { /* silent */ }
    setNodeLoading(null);
  };

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
    </div>
  );
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState message="No runs recorded yet." />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-mata-border bg-mata-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mata-border bg-mata-surface/50 text-left text-xs font-bold uppercase tracking-wider text-mata-text-muted">
            <th className="px-4 py-3">Type</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Tokens</th><th className="px-4 py-3">Latency</th><th className="px-4 py-3">Nodes</th><th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mata-border/50">
          {data.map((run: Record<string, unknown>) => {
            const id = String(run.id ?? run._id ?? '');
            const isExpanded = expandedId === id;
            return (
              <tr key={id} className="group">
                <td colSpan={7} className="p-0">
                  <button onClick={() => handleExpand(id)} className="w-full text-left grid grid-cols-7 px-4 py-3 hover:bg-mata-surface/30 transition-colors cursor-pointer">
                    <span className="text-mata-text font-medium">{String(run.graph_type ?? run.type ?? '')}</span>
                    <span className="text-mata-text-secondary truncate">{run.subject_id ? `${String(run.subject_type ?? '')}:${String(run.subject_id)}` : String(run.subject_type ?? '')}</span>
                    <span><StatusBadge status={String(run.status ?? 'pending')} /></span>
                    <span className="text-mata-text-muted">{Number(run.total_tokens ?? 0).toLocaleString()}</span>
                    <span className="text-mata-text-muted">{Number(run.total_latency_ms ?? 0)}ms</span>
                    <span className="text-mata-text-muted">{String(run.nodes_completed ?? 0)}/{String(run.node_count ?? 0)}</span>
                    <span className="text-mata-text-muted">{run.created_at ? new Date(String(run.created_at)).toLocaleString() : ''}</span>
                  </button>
                  {isExpanded && (
                    <div className="bg-mata-surface/20 px-6 py-4 border-t border-mata-border/30">
                      {nodeLoading === id ? (
                        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                      ) : nodeRuns[id]?.length ? (
                        <table className="w-full text-xs">
                          <thead><tr className="text-left text-mata-text-muted font-bold uppercase tracking-wider">
                            <th className="pb-2">Node</th><th className="pb-2">Agent</th><th className="pb-2">Status</th>
                            <th className="pb-2">Output</th><th className="pb-2">Tokens</th><th className="pb-2">Latency</th><th className="pb-2">Error</th>
                          </tr></thead>
                          <tbody className="divide-y divide-mata-border/30">
                            {nodeRuns[id].map((nr: Record<string, unknown>, i: number) => (
                              <tr key={i}>
                                <td className="py-2 text-mata-text font-medium">{String(nr.node_name ?? '')}</td>
                                <td className={`py-2 font-semibold ${AGENT_COLORS[String(nr.agent_name ?? '')] ?? 'text-mata-text-secondary'}`}>{String(nr.agent_name ?? '')}</td>
                                <td className="py-2"><StatusBadge status={String(nr.status ?? 'pending')} /></td>
                                <td className="py-2 text-mata-text-muted max-w-[200px] truncate">{String(nr.output_text ?? '').slice(0, 100)}</td>
                                <td className="py-2 text-mata-text-muted">{Number(nr.tokens_used ?? 0).toLocaleString()}</td>
                                <td className="py-2 text-mata-text-muted">{Number(nr.latency_ms ?? 0)}ms</td>
                                <td className="py-2 text-red-400">{String(nr.error_message ?? '')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-mata-text-muted">No node runs found.</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AgentsTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error, reload } = useFetch<any[]>('/api/admin/agents');

  if (loading) return (
    <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
  );
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState message="No agent data available." />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-mata-border bg-mata-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mata-border bg-mata-surface/50 text-left text-xs font-bold uppercase tracking-wider text-mata-text-muted">
            <th className="px-4 py-3">Agent</th><th className="px-4 py-3">Calls</th><th className="px-4 py-3">Tokens</th>
            <th className="px-4 py-3">Avg Latency</th><th className="px-4 py-3">Failures</th><th className="px-4 py-3">Est. Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mata-border/50">
          {data.map((a: Record<string, unknown>) => (
            <tr key={String(a.agent ?? a.name ?? '')} className="hover:bg-mata-surface/30 transition-colors">
              <td className={`px-4 py-3 font-bold ${AGENT_COLORS[String(a.agent ?? a.name ?? '')] ?? 'text-mata-text'}`}>{String(a.agent ?? a.name ?? '')}</td>
              <td className="px-4 py-3 text-mata-text">{Number(a.callCount ?? a.calls ?? 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-mata-text-muted">{Number(a.totalTokens ?? a.tokens ?? 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-mata-text-muted">{Number(a.avg_latency ?? a.avgLatency ?? 0)}ms</td>
              <td className="px-4 py-3 text-red-400">{Number(a.failureCount ?? a.failures ?? 0)}</td>
              <td className="px-4 py-3 text-mata-text">${Number(a.estimated_cost ?? a.estimatedCost ?? 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvaluationTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error, reload } = useFetch<any>('/api/admin/evaluation');

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const rows = data?.rows ?? data?.evaluations ?? [];
  const summary = data?.summary;

  if (!rows.length) return <EmptyState message="No evaluation data yet." />;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {summary.byScoreBucket?.length > 0 && (
            <div className="rounded-2xl border border-mata-border bg-mata-card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-2">Avg Return by Score</p>
              <div className="space-y-1 text-sm">
                {(summary.byScoreBucket as { label: string; count: number; avgReturn: number }[]).map((b) => (
                  <div key={b.label} className="flex justify-between">
                    <span className="text-mata-text-secondary">{b.label} ({b.count})</span>
                    <span className={b.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}>{b.avgReturn.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.byLabel?.length > 0 && (
            <div className="rounded-2xl border border-mata-border bg-mata-card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-2">Avg Return by Label</p>
              <div className="space-y-1 text-sm">
                {(summary.byLabel as { label: string; count: number; avgReturn: number }[]).map((b) => (
                  <div key={b.label} className="flex justify-between">
                    <span className="text-mata-text-secondary">{b.label} ({b.count})</span>
                    <span className={b.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}>{b.avgReturn.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.byRisk?.length > 0 && (
            <div className="rounded-2xl border border-mata-border bg-mata-card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-2">Avg Return by Risk</p>
              <div className="space-y-1 text-sm">
                {(summary.byRisk as { label: string; count: number; avgReturn: number }[]).map((b) => (
                  <div key={b.label} className="flex justify-between">
                    <span className="text-mata-text-secondary">{b.label} ({b.count})</span>
                    <span className={b.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}>{b.avgReturn.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-mata-border bg-mata-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mata-border bg-mata-surface/50 text-left text-xs font-bold uppercase tracking-wider text-mata-text-muted">
              <th className="px-4 py-3">Ticker</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Risk</th><th className="px-4 py-3">Setup</th><th className="px-4 py-3">Price at Score</th>
              <th className="px-4 py-3">Current</th><th className="px-4 py-3">Return %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mata-border/50">
            {rows.map((e: Record<string, unknown>, i: number) => {
              const ret = Number(e.return_pct ?? e.returnPct ?? 0);
              return (
                <tr key={i} className="hover:bg-mata-surface/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-mata-text">{String(e.ticker ?? '')}</td>
                  <td className="px-4 py-3 text-mata-text">{String(e.score ?? '')}</td>
                  <td className="px-4 py-3 text-mata-text-secondary">{String(e.label ?? '')}</td>
                  <td className="px-4 py-3 text-mata-text-secondary">{String(e.risk ?? '')}</td>
                  <td className="px-4 py-3 text-mata-text-muted">{String(e.setup ?? '')}</td>
                  <td className="px-4 py-3 text-mata-text-muted">${Number(e.price_at_score ?? e.priceAtScore ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-mata-text-muted">${Number(e.current_price ?? e.currentPrice ?? 0).toFixed(2)}</td>
                  <td className={`px-4 py-3 font-bold ${ret >= 0 ? 'text-green-400' : 'text-red-400'}`}>{ret.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfigTab() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load configuration');
      const data = await res.json();
      const configEntries: SystemConfig[] = (data.manifest ?? []).map(
        (item: { key: string; current_value: string | number | boolean; group: string; label: string; description: string; type: string }) => ({
          key: item.key,
          value: String(item.current_value),
          group: item.group,
          label: item.label,
          description: item.description,
          type: item.type,
          validation: null,
          updated_at: new Date().toISOString(),
        })
      );
      setConfigs(configEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleSave = useCallback(async (key: string, value: string) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error('Failed to save');
    setConfigs((prev) => prev.map((c) => c.key === key ? { ...c, value, updated_at: new Date().toISOString() } : c));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-mata-border bg-mata-card overflow-hidden">
          <div className="border-b border-mata-border bg-mata-surface/50 px-5 py-3"><Skeleton className="h-4 w-24" /></div>
          <div className="p-5 space-y-5">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /><Skeleton className="h-10 w-full max-w-xs" /></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  if (error) return <ErrorBox message={error} onRetry={fetchConfigs} />;

  return <ConfigEditor configs={configs} manifest={CONFIG_MANIFEST} onSave={handleSave} />;
}

function ActivityTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, loading, error, reload } = useFetch<any[]>('/api/admin/activity');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (loading) return (
    <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
  );
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState message="No activity entries yet." />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-mata-border bg-mata-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mata-border bg-mata-surface/50 text-left text-xs font-bold uppercase tracking-wider text-mata-text-muted">
            <th className="px-4 py-3">Time</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Graph/Prompt</th>
            <th className="px-4 py-3">Agent/Node</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tokens</th>
            <th className="px-4 py-3">Latency</th><th className="px-4 py-3">Output Preview</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mata-border/50">
          {data.map((entry: Record<string, unknown>, i: number) => {
            const isGraph = entry.source === 'graph_node';
            const sourceBadgeCls = isGraph
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
              : 'bg-orange-500/15 text-orange-400 border-orange-500/20';
            const sourceLabel = isGraph ? 'graph' : 'direct';
            const graphOrPrompt = isGraph ? String(entry.graph_type ?? '') : String(entry.prompt_key ?? '');
            const agentOrNode = String(entry.agent_name ?? entry.node_name ?? '');
            const preview = String(entry.output_preview ?? '').slice(0, 80);

            return (
              <tr key={String(entry.id ?? i)} className="group">
                <td colSpan={8} className="p-0">
                  <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)} className="w-full text-left grid grid-cols-8 px-4 py-3 hover:bg-mata-surface/30 transition-colors cursor-pointer">
                    <span className="text-mata-text-muted">{entry.timestamp ? new Date(String(entry.timestamp)).toLocaleString() : ''}</span>
                    <span><span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${sourceBadgeCls}`}>{sourceLabel}</span></span>
                    <span className="text-mata-text font-medium truncate">{graphOrPrompt}</span>
                    <span className={`font-semibold ${AGENT_COLORS[agentOrNode] ?? 'text-mata-text-secondary'}`}>{agentOrNode}</span>
                    <span><StatusBadge status={String(entry.status ?? 'pending')} /></span>
                    <span className="text-mata-text-muted">{Number(entry.tokens_used ?? 0).toLocaleString()}</span>
                    <span className="text-mata-text-muted">{Number(entry.latency_ms ?? 0)}ms</span>
                    <span className="text-mata-text-muted truncate">{preview}</span>
                  </button>
                  {expandedIdx === i && (
                    <div className="bg-mata-surface/20 px-6 py-4 border-t border-mata-border/30 space-y-3">
                      {Boolean(entry.output_preview) && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-mata-text-muted mb-1">Output Preview</p>
                          <pre className="text-xs text-mata-text-secondary bg-mata-surface rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">{String(entry.output_preview)}</pre>
                        </div>
                      )}
                      {Boolean(entry.error_message) && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-1">Error</p>
                          <pre className="text-xs text-red-400 bg-red-500/5 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">{String(entry.error_message)}</pre>
                        </div>
                      )}
                      <div className="flex gap-4 text-xs text-mata-text-muted">
                        {Boolean(entry.model) && <span>Model: <span className="text-mata-text-secondary">{String(entry.model)}</span></span>}
                        {Boolean(entry.graph_type) && <span>Graph: <span className="text-mata-text-secondary">{String(entry.graph_type)}</span></span>}
                        {Boolean(entry.node_name) && <span>Node: <span className="text-mata-text-secondary">{String(entry.node_name)}</span></span>}
                        {Boolean(entry.prompt_key) && <span>Prompt: <span className="text-mata-text-secondary">{String(entry.prompt_key)}</span></span>}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Page ─── */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-mata-text tracking-tight">aiMATA Admin</h1>
        <p className="text-sm text-mata-text-muted mt-0.5">System monitoring, agent analytics, and configuration</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl border border-mata-border bg-mata-surface/50 p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-mata-card text-mata-orange shadow-sm'
                : 'text-mata-text-muted hover:text-mata-text hover:bg-mata-card/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'runs' && <RunsTab />}
      {activeTab === 'agents' && <AgentsTab />}
      {activeTab === 'evaluation' && <EvaluationTab />}
      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'activity' && <ActivityTab />}
    </div>
  );
}
