/**
 * Domain: Operations & Evaluation (Phase 8)
 *
 * Queries existing tables to provide operational visibility:
 * - Graph/node execution metrics
 * - Agent token/latency/cost metrics
 * - Scanner run history
 * - Opportunity outcome evaluation
 * - Basket quality evaluation
 * - Config audit
 */

import { getAdminClient } from '@/server/db';

// ─── Cost Constants ───
// Claude Sonnet 4: $3 per 1M input, $15 per 1M output (approximate)
// Claude Haiku 3.5: $0.80 per 1M input, $4 per 1M output
const COST_PER_TOKEN = 0.000009; // blended avg ≈ $9 per 1M tokens

// ─── Overview / Health ───

export interface OpsOverview {
  scannerRuns: { total: number; today: number; lastRunAt: string | null };
  graphRuns: { total: number; today: number; failed: number; avgLatencyMs: number };
  agentCalls: { total: number; today: number; totalTokens: number; estimatedCost: number };
  activeUsers: number;
  feedSize: number;
  errors: { total: number; today: number };
}

export async function getOpsOverview(): Promise<OpsOverview> {
  const db = getAdminClient();
  const today = new Date().toISOString().split('T')[0];

  // Scanner runs
  const { count: scannerTotal } = await db.schema('trader').from('opportunity_runs').select('*', { count: 'exact', head: true });
  const { count: scannerToday } = await db.schema('trader').from('opportunity_runs').select('*', { count: 'exact', head: true }).gte('ran_at', today);
  const { data: lastRun } = await db.schema('trader').from('opportunity_runs').select('ran_at').order('ran_at', { ascending: false }).limit(1).single();

  // Graph runs
  const { count: graphTotal } = await db.schema('trader').from('graph_runs').select('*', { count: 'exact', head: true });
  const { count: graphToday } = await db.schema('trader').from('graph_runs').select('*', { count: 'exact', head: true }).gte('created_at', today);
  const { count: graphFailed } = await db.schema('trader').from('graph_runs').select('*', { count: 'exact', head: true }).eq('status', 'failed');
  const { data: latencyData } = await db.schema('trader').from('graph_runs').select('total_latency_ms').not('total_latency_ms', 'is', null);
  const avgLatency = latencyData && latencyData.length > 0
    ? latencyData.reduce((s: number, r: { total_latency_ms: number }) => s + r.total_latency_ms, 0) / latencyData.length
    : 0;

  // Agent calls — primary source is node_runs (LangGraph), supplemented by raw_llm_outputs (direct calls)
  const { count: nodeRunTotal } = await db.schema('trader').from('node_runs').select('*', { count: 'exact', head: true });
  const { count: nodeRunToday } = await db.schema('trader').from('node_runs').select('*', { count: 'exact', head: true }).gte('created_at', today);
  const { data: nodeTokenData } = await db.schema('trader').from('node_runs').select('tokens_used');
  const nodeTokens = (nodeTokenData ?? []).reduce((s: number, r: { tokens_used: number | null }) => s + (r.tokens_used ?? 0), 0);

  // Also count direct agent calls from raw_llm_outputs (non-graph calls)
  const { count: directLlmCount } = await db.schema('trader').from('raw_llm_outputs').select('*', { count: 'exact', head: true });
  const { data: directTokenData } = await db.schema('trader').from('raw_llm_outputs').select('tokens_used');
  const directTokens = (directTokenData ?? []).reduce((s: number, r: { tokens_used: number | null }) => s + (r.tokens_used ?? 0), 0);

  const totalAgentCalls = (nodeRunTotal ?? 0) + (directLlmCount ?? 0);
  const totalTokens = nodeTokens + directTokens;

  // Users
  const { count: userCount } = await db.schema('trader').from('baskets').select('*', { count: 'exact', head: true });

  // Feed
  const { count: feedCount } = await db.schema('trader').from('opportunity_feed').select('*', { count: 'exact', head: true });

  // Errors
  const { count: errorTotal } = await db.schema('trader').from('node_runs').select('*', { count: 'exact', head: true }).eq('status', 'failed');
  const { count: errorToday } = await db.schema('trader').from('node_runs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', today);

  return {
    scannerRuns: { total: scannerTotal ?? 0, today: scannerToday ?? 0, lastRunAt: (lastRun?.ran_at as string) ?? null },
    graphRuns: { total: graphTotal ?? 0, today: graphToday ?? 0, failed: graphFailed ?? 0, avgLatencyMs: Math.round(avgLatency) },
    agentCalls: { total: totalAgentCalls, today: nodeRunToday ?? 0, totalTokens, estimatedCost: totalTokens * COST_PER_TOKEN },
    activeUsers: userCount ?? 0,
    feedSize: feedCount ?? 0,
    errors: { total: errorTotal ?? 0, today: errorToday ?? 0 },
  };
}

// ─── Run Explorer ───

export interface RunRecord {
  id: string;
  type: string;
  graph_type?: string;
  subject_type?: string;
  subject_id?: string;
  status: string;
  total_tokens?: number;
  total_latency_ms?: number;
  node_count?: number;
  nodes_completed?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export async function getGraphRuns(limit: number = 50, offset: number = 0): Promise<RunRecord[]> {
  const db = getAdminClient();
  const { data } = await db.schema('trader').from('graph_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    type: 'graph',
    graph_type: r.graph_type as string,
    subject_type: r.subject_type as string,
    subject_id: r.subject_id as string | undefined,
    status: r.status as string,
    total_tokens: r.total_tokens as number,
    total_latency_ms: r.total_latency_ms as number,
    node_count: r.node_count as number,
    nodes_completed: r.nodes_completed as number,
    error_message: r.error_message as string | undefined,
    created_at: r.created_at as string,
    completed_at: r.completed_at as string | undefined,
  }));
}

export interface NodeRecord {
  id: string;
  node_name: string;
  agent_name: string | null;
  status: string;
  output_text: string | null;
  structured_output: unknown;
  tokens_used: number;
  latency_ms: number;
  error_message: string | null;
  created_at: string;
}

export async function getNodeRuns(graphRunId: string): Promise<NodeRecord[]> {
  const db = getAdminClient();
  const { data } = await db.schema('trader').from('node_runs')
    .select('*')
    .eq('graph_run_id', graphRunId)
    .order('created_at', { ascending: true });

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    node_name: r.node_name as string,
    agent_name: (r.agent_name as string) ?? null,
    status: r.status as string,
    output_text: (r.output_text as string) ?? null,
    structured_output: r.structured_output ?? null,
    tokens_used: (r.tokens_used as number) ?? 0,
    latency_ms: (r.latency_ms as number) ?? 0,
    error_message: (r.error_message as string) ?? null,
    created_at: r.created_at as string,
  }));
}

// ─── Agent Metrics ───

export interface AgentMetrics {
  agent: string;
  callCount: number;
  totalTokens: number;
  avgLatency: number;
  failureCount: number;
  estimatedCost: number;
}

export async function getAgentMetrics(): Promise<AgentMetrics[]> {
  const db = getAdminClient();
  const { data: nodes } = await db.schema('trader').from('node_runs')
    .select('agent_name, status, tokens_used, latency_ms')
    .not('agent_name', 'is', null);

  const byAgent: Record<string, { calls: number; tokens: number; latency: number; failures: number }> = {};
  for (const n of (nodes ?? []) as { agent_name: string; status: string; tokens_used: number; latency_ms: number }[]) {
    const a = n.agent_name;
    if (!byAgent[a]) byAgent[a] = { calls: 0, tokens: 0, latency: 0, failures: 0 };
    byAgent[a].calls++;
    byAgent[a].tokens += n.tokens_used ?? 0;
    byAgent[a].latency += n.latency_ms ?? 0;
    if (n.status === 'failed') byAgent[a].failures++;
  }

  return Object.entries(byAgent).map(([agent, stats]) => ({
    agent,
    callCount: stats.calls,
    totalTokens: stats.tokens,
    avgLatency: stats.calls > 0 ? Math.round(stats.latency / stats.calls) : 0,
    failureCount: stats.failures,
    estimatedCost: stats.tokens * COST_PER_TOKEN,
  }));
}

// ─── Scanner History ───

export async function getScannerHistory(limit: number = 20) {
  const db = getAdminClient();
  const { data } = await db.schema('trader').from('opportunity_runs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}

// ─── Opportunity Outcome Evaluation (with summary) ───

export interface OpportunityOutcome {
  ticker: string;
  scored_at: string;
  score: number;
  label: string;
  risk: string;
  setup: string;
  price_at_score: number | null;
  current_price: number | null;
  return_pct: number | null;
}

interface BucketSummary {
  label: string;
  count: number;
  avgReturn: number | null;
}

export interface EvaluationResult {
  rows: OpportunityOutcome[];
  summary: {
    byScoreBucket: BucketSummary[];
    byLabel: BucketSummary[];
    byRisk: BucketSummary[];
  };
}

export async function getOpportunityOutcomes(): Promise<EvaluationResult> {
  const db = getAdminClient();

  const { data: scored } = await db.schema('trader').from('opportunity_feed')
    .select('ticker, opportunity_score, opportunity_label, risk_label, setup_type, scored_at')
    .order('opportunity_score', { ascending: false });

  if (!scored || scored.length === 0) {
    return { rows: [], summary: { byScoreBucket: [], byLabel: [], byRisk: [] } };
  }

  const tickers = scored.map((s: { ticker: string }) => s.ticker);

  // Current prices (latest quote per ticker)
  const { data: quotes } = await db.from('market_quotes')
    .select('ticker, last_price')
    .in('ticker', tickers)
    .order('date', { ascending: false });

  const quoteMap = new Map<string, number>();
  for (const q of quotes ?? []) {
    if (!quoteMap.has(q.ticker as string)) quoteMap.set(q.ticker as string, q.last_price as number);
  }

  // Entry prices: find the close on or nearest before scored_at per ticker.
  // Fetch enough history to cover all scoring dates.
  const { data: histPrices } = await db.from('price_history')
    .select('ticker, date, close')
    .in('ticker', tickers)
    .order('date', { ascending: false })
    .limit(tickers.length * 60);

  // Build a map of ticker → [{date, close}] sorted newest first
  const pricesByTicker = new Map<string, { date: string; close: number }[]>();
  for (const p of histPrices ?? []) {
    const t = p.ticker as string;
    const arr = pricesByTicker.get(t) ?? [];
    arr.push({ date: p.date as string, close: p.close as number });
    pricesByTicker.set(t, arr);
  }

  /**
   * Find the closing price on or just before a target date.
   * Uses the closest available date <= targetDate.
   */
  function findPriceAtDate(ticker: string, targetDate: string): number | null {
    const prices = pricesByTicker.get(ticker);
    if (!prices || prices.length === 0) return null;
    const target = targetDate.substring(0, 10); // YYYY-MM-DD
    // prices are sorted newest first; find first price <= target
    for (const p of prices) {
      if (p.date <= target) return p.close;
    }
    // If all prices are after the target, use the oldest available
    return prices[prices.length - 1].close;
  }

  // Build rows using the actual scored_at timestamp for entry price
  const rows: OpportunityOutcome[] = scored.map((s: Record<string, unknown>) => {
    const ticker = s.ticker as string;
    const scoredAt = s.scored_at as string;
    const scoredDate = scoredAt ? scoredAt.substring(0, 10) : '';
    const priceAtScore = scoredDate ? findPriceAtDate(ticker, scoredDate) : null;
    const currentPrice = quoteMap.get(ticker) ?? null;
    const returnPct = priceAtScore && currentPrice ? ((currentPrice - priceAtScore) / priceAtScore) * 100 : null;

    return {
      ticker,
      scored_at: s.scored_at as string,
      score: s.opportunity_score as number,
      label: s.opportunity_label as string,
      risk: s.risk_label as string,
      setup: s.setup_type as string,
      price_at_score: priceAtScore,
      current_price: currentPrice,
      return_pct: returnPct,
    };
  });

  // Compute summary
  function avgReturn(items: OpportunityOutcome[]): number | null {
    const withReturn = items.filter((r) => r.return_pct !== null);
    if (withReturn.length === 0) return null;
    return withReturn.reduce((s, r) => s + r.return_pct!, 0) / withReturn.length;
  }

  const byScoreBucket: BucketSummary[] = [
    { label: '≥70', count: 0, avgReturn: null },
    { label: '50-69', count: 0, avgReturn: null },
    { label: '<50', count: 0, avgReturn: null },
  ];
  const high = rows.filter((r) => r.score >= 70);
  const mid = rows.filter((r) => r.score >= 50 && r.score < 70);
  const low = rows.filter((r) => r.score < 50);
  byScoreBucket[0] = { label: '≥70', count: high.length, avgReturn: avgReturn(high) };
  byScoreBucket[1] = { label: '50-69', count: mid.length, avgReturn: avgReturn(mid) };
  byScoreBucket[2] = { label: '<50', count: low.length, avgReturn: avgReturn(low) };

  const labels = ['Hot Now', 'Swing', 'Run'];
  const byLabel = labels.map((l) => {
    const items = rows.filter((r) => r.label === l);
    return { label: l, count: items.length, avgReturn: avgReturn(items) };
  });

  const risks = ['Low', 'Medium', 'High'];
  const byRisk = risks.map((r) => {
    const items = rows.filter((row) => row.risk === r);
    return { label: r, count: items.length, avgReturn: avgReturn(items) };
  });

  return { rows, summary: { byScoreBucket, byLabel, byRisk } };
}

// ─── Unified Activity Feed (graph runs + direct LLM calls) ───

export interface ActivityEntry {
  id: string;
  source: 'graph_node' | 'direct_llm';
  timestamp: string;
  graph_type: string | null;
  node_name: string | null;
  agent_name: string | null;
  prompt_key: string | null;
  model: string | null;
  tokens_used: number;
  latency_ms: number;
  status: string;
  output_preview: string | null;
  error_message: string | null;
}

export async function getActivityFeed(limit: number = 50): Promise<ActivityEntry[]> {
  const db = getAdminClient();

  // Get node runs (from LangGraph)
  const { data: nodeData } = await db.schema('trader').from('node_runs')
    .select('id, graph_run_id, node_name, agent_name, status, output_text, tokens_used, latency_ms, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Get graph run types for context
  const graphRunIds = [...new Set((nodeData ?? []).map((n: { graph_run_id: string }) => n.graph_run_id).filter(Boolean))];
  const graphTypeMap = new Map<string, string>();
  if (graphRunIds.length > 0) {
    const { data: runs } = await db.schema('trader').from('graph_runs')
      .select('id, graph_type')
      .in('id', graphRunIds);
    for (const r of runs ?? []) {
      graphTypeMap.set(r.id as string, r.graph_type as string);
    }
  }

  const nodeEntries: ActivityEntry[] = (nodeData ?? []).map((n: Record<string, unknown>) => ({
    id: n.id as string,
    source: 'graph_node' as const,
    timestamp: n.created_at as string,
    graph_type: graphTypeMap.get(n.graph_run_id as string) ?? null,
    node_name: n.node_name as string,
    agent_name: (n.agent_name as string) ?? null,
    prompt_key: null,
    model: null,
    tokens_used: (n.tokens_used as number) ?? 0,
    latency_ms: (n.latency_ms as number) ?? 0,
    status: n.status as string,
    output_preview: n.output_text ? (n.output_text as string).substring(0, 150) : null,
    error_message: (n.error_message as string) ?? null,
  }));

  // Get direct LLM calls
  const { data: llmData } = await db.schema('trader').from('raw_llm_outputs')
    .select('id, prompt_key, model, tokens_used, duration_ms, output_text, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  const llmEntries: ActivityEntry[] = (llmData ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    source: 'direct_llm' as const,
    timestamp: l.created_at as string,
    graph_type: null,
    node_name: null,
    agent_name: null,
    prompt_key: (l.prompt_key as string) ?? null,
    model: (l.model as string) ?? null,
    tokens_used: (l.tokens_used as number) ?? 0,
    latency_ms: (l.duration_ms as number) ?? 0,
    status: 'completed',
    output_preview: l.output_text ? (l.output_text as string).substring(0, 150) : null,
    error_message: null,
  }));

  // Merge and sort by timestamp
  const all = [...nodeEntries, ...llmEntries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return all;
}

// ─── Thread Reader ───

export interface ThreadMessage {
  id: string;
  role: string;
  agent_name: string | null;
  content: string;
  structured_output: unknown;
  tokens_used: number;
  latency_ms: number;
  created_at: string;
}

export interface ThreadWithMessages {
  id: string;
  subject_type: string;
  subject_id: string | null;
  routed_agent: string | null;
  routing_reason: string | null;
  status: string;
  created_at: string;
  messages: ThreadMessage[];
}

export async function getThreadsForSubject(
  userId: string,
  subjectType: string,
  subjectId: string | null,
  limit: number = 5,
): Promise<ThreadWithMessages[]> {
  const db = getAdminClient();

  let query = db.schema('trader').from('agent_threads')
    .select('*')
    .eq('user_id', userId)
    .eq('subject_type', subjectType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (subjectId) {
    query = query.eq('subject_id', subjectId);
  }

  const { data: threads } = await query;
  if (!threads || threads.length === 0) return [];

  const result: ThreadWithMessages[] = [];
  for (const t of threads) {
    const { data: messages } = await db.schema('trader').from('agent_messages')
      .select('*')
      .eq('thread_id', t.id)
      .order('created_at', { ascending: true });

    result.push({
      id: t.id as string,
      subject_type: t.subject_type as string,
      subject_id: (t.subject_id as string) ?? null,
      routed_agent: (t.routed_agent as string) ?? null,
      routing_reason: (t.routing_reason as string) ?? null,
      status: t.status as string,
      created_at: t.created_at as string,
      messages: (messages ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: m.role as string,
        agent_name: (m.agent_name as string) ?? null,
        content: m.content as string,
        structured_output: m.structured_output ?? null,
        tokens_used: (m.tokens_used as number) ?? 0,
        latency_ms: (m.latency_ms as number) ?? 0,
        created_at: m.created_at as string,
      })),
    });
  }

  return result;
}
