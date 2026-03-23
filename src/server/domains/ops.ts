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

  // Agent calls (from raw_llm_outputs)
  const { count: llmTotal } = await db.schema('trader').from('raw_llm_outputs').select('*', { count: 'exact', head: true });
  const { count: llmToday } = await db.schema('trader').from('raw_llm_outputs').select('*', { count: 'exact', head: true }).gte('created_at', today);
  const { data: tokenData } = await db.schema('trader').from('raw_llm_outputs').select('tokens_used');
  const totalTokens = (tokenData ?? []).reduce((s: number, r: { tokens_used: number | null }) => s + (r.tokens_used ?? 0), 0);

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
    agentCalls: { total: llmTotal ?? 0, today: llmToday ?? 0, totalTokens, estimatedCost: totalTokens * COST_PER_TOKEN },
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

// ─── Opportunity Outcome Evaluation ───

export interface OpportunityOutcome {
  ticker: string;
  scoredAt: string;
  score: number;
  label: string;
  riskLabel: string;
  setupType: string;
  priceAtScore: number | null;
  currentPrice: number | null;
  returnPct: number | null;
}

export async function getOpportunityOutcomes(): Promise<OpportunityOutcome[]> {
  const db = getAdminClient();

  // Get the latest scored opportunities
  const { data: scored } = await db.schema('trader').from('opportunity_feed')
    .select('ticker, opportunity_score, opportunity_label, risk_label, setup_type, scored_at')
    .order('opportunity_score', { ascending: false });

  if (!scored || scored.length === 0) return [];

  // Get quotes for current prices
  const tickers = scored.map((s: { ticker: string }) => s.ticker);
  const { data: quotes } = await db.from('market_quotes')
    .select('ticker, last_price')
    .in('ticker', tickers)
    .order('date', { ascending: false });

  const quoteMap = new Map<string, number>();
  for (const q of quotes ?? []) {
    if (!quoteMap.has(q.ticker as string)) quoteMap.set(q.ticker as string, q.last_price as number);
  }

  // Get historical prices near scoring time for return calculation
  const { data: histPrices } = await db.from('price_history')
    .select('ticker, date, close')
    .in('ticker', tickers)
    .order('date', { ascending: false })
    .limit(tickers.length * 5);

  const entryMap = new Map<string, number>();
  for (const p of histPrices ?? []) {
    if (!entryMap.has(p.ticker as string)) entryMap.set(p.ticker as string, p.close as number);
  }

  return scored.map((s: Record<string, unknown>) => {
    const ticker = s.ticker as string;
    const priceAtScore = entryMap.get(ticker) ?? null;
    const currentPrice = quoteMap.get(ticker) ?? null;
    const returnPct = priceAtScore && currentPrice ? ((currentPrice - priceAtScore) / priceAtScore) * 100 : null;

    return {
      ticker,
      scoredAt: s.scored_at as string,
      score: s.opportunity_score as number,
      label: s.opportunity_label as string,
      riskLabel: s.risk_label as string,
      setupType: s.setup_type as string,
      priceAtScore,
      currentPrice,
      returnPct,
    };
  });
}

// ─── LLM Output Log ───

export async function getLlmOutputs(limit: number = 50) {
  const db = getAdminClient();
  const { data } = await db.schema('trader').from('raw_llm_outputs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}
