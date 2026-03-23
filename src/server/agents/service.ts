/**
 * Agent Service — Phase 6.5 hardened
 *
 * Real specialist agent layer with:
 * 1. Bounded context packages (not raw DB queries)
 * 2. Structured prompts with versioning and role boundaries
 * 3. Structured output parsing (stance, confidence, drivers, risks)
 * 4. Persisted artifacts with full provenance (agent_briefs + raw_llm_outputs)
 * 5. Robust fallback — deterministic core never breaks if agents fail
 * 6. Latency/cost instrumentation per call
 *
 * Agents explain deterministic canon — they don't replace scoring math.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/server/db';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import {
  AGENT_SPECS,
  PROMPT_VERSION,
  type AgentStructuredOutput,
  type AgentArtifact,
  type ArtifactStatus,
  type MarketContext,
  type TickerContext,
  type BasketContext,
  type ActionContext,
} from '@/server/agents/contracts';
import type { AgentName } from '@/types';

const MODEL = 'claude-sonnet-4-20250514';

// ─── Core: Call agent and persist ───

async function callAgent(
  agentName: AgentName,
  promptKey: string,
  contextMessage: string,
  subjectType: AgentArtifact['subject_type'],
  subjectId: string | null,
  sourceRunId: string | null,
  userId: string | null,
): Promise<AgentArtifact> {
  const db = getAdminClient();
  const config = await loadConfig(db);
  const temperature = getConfigValue<number>(config, 'model.temperature');
  const maxTokens = getConfigValue<number>(config, 'model.max_tokens');

  const spec = AGENT_SPECS[agentName];
  const systemPrompt = `${spec.systemPrompt}\n\n${spec.boundaryInstruction}\n\n${spec.outputInstruction}`;

  let content = '';
  let structured: AgentStructuredOutput | null = null;
  let tokensUsed = 0;
  let status: ArtifactStatus = 'success';
  const startTime = Date.now();

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: contextMessage }],
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    structured = parseStructuredOutput(rawText);
    content = structured?.summary ?? rawText;

    if (!structured) {
      // LLM responded but didn't produce valid structured output — still usable
      status = 'fallback';
    }
  } catch (err) {
    // LLM unavailable — produce deterministic fallback
    status = 'failed';
    content = buildFallbackContent(agentName, promptKey, contextMessage);
    console.error(`Agent ${agentName} call failed:`, err instanceof Error ? err.message : err);
  }

  const latencyMs = Date.now() - startTime;

  // ── Persist raw LLM output for audit trail ──
  try {
    await db.schema('trader').from('raw_llm_outputs').insert({
      prompt_key: `${promptKey}@${PROMPT_VERSION}`,
      input_data: {
        system: systemPrompt.substring(0, 500),
        user: contextMessage.substring(0, 2000),
        prompt_version: PROMPT_VERSION,
        status,
      },
      output_text: content,
      model: MODEL,
      tokens_used: tokensUsed,
      duration_ms: latencyMs,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-critical — don't fail the agent call if audit logging fails
  }

  // ── Persist agent artifact ──
  const artifact: AgentArtifact = {
    agent_name: agentName,
    subject_type: subjectType,
    subject_id: subjectId,
    brief_type: subjectType === 'market' ? 'daily' : 'commentary',
    content,
    structured_output: structured,
    prompt_key: promptKey,
    prompt_version: PROMPT_VERSION,
    model: MODEL,
    source_run_id: sourceRunId,
    tokens_used: tokensUsed,
    latency_ms: latencyMs,
    status,
    created_at: new Date().toISOString(),
  };

  try {
    const { data } = await db.schema('trader').from('agent_briefs').insert({
      user_id: userId,
      agent_name: agentName,
      content,
      brief_type: artifact.brief_type,
      subject_type: subjectType,
      subject_id: subjectId,
      prompt_key: `${promptKey}@${PROMPT_VERSION}`,
      model: MODEL,
      structured_output: structured ? { ...structured, status, latency_ms: latencyMs } : { status, latency_ms: latencyMs },
      source_run_id: sourceRunId,
      tokens_used: tokensUsed,
      metadata: null,
      created_at: artifact.created_at,
    }).select('id').single();

    if (data) artifact.id = data.id as string;
  } catch {
    // Non-critical — artifact was still generated even if storage fails
  }

  return artifact;
}

// ─── Structured output parsing ───

function parseStructuredOutput(text: string): AgentStructuredOutput | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.stance && parsed.summary) {
      return {
        stance: parsed.stance,
        confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
        topDrivers: Array.isArray(parsed.topDrivers) ? parsed.topDrivers.slice(0, 5) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
        summary: String(parsed.summary).substring(0, 500),
      };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

// ─── Deterministic Fallback ───

function buildFallbackContent(agentName: AgentName, promptKey: string, context: string): string {
  const spec = AGENT_SPECS[agentName];

  // Extract basic info from context for a useful fallback
  const tickerMatch = context.match(/Ticker:\s*(\w+)/);
  const ticker = tickerMatch?.[1] ?? '';
  const scoreMatch = context.match(/Score:\s*(\d+)/);
  const score = scoreMatch?.[1] ?? '';

  switch (agentName) {
    case 'Mark':
      return ticker
        ? `${ticker} scores ${score}/100. Review the component scores above for setup details. Mark's AI assessment is temporarily unavailable.`
        : `Market data is available above. Mark's AI assessment is temporarily unavailable.`;
    case 'Nia':
      return ticker
        ? `Check the catalyst and sentiment scores for ${ticker} in the system data above. Nia's narrative assessment is temporarily unavailable.`
        : `Sentiment data is shown in the system metrics. Nia's AI assessment is temporarily unavailable.`;
    case 'Paul':
      return `Basket analytics are shown above (concentration, correlation, quality). Paul's deeper review is temporarily unavailable.`;
    case 'Rex':
      return `The system action recommendation is shown above. Rex's tactical explanation is temporarily unavailable.`;
    default:
      return `Agent assessment is temporarily unavailable. System data remains available above.`;
  }
}

// ─── Specialist Functions ───

export async function markTickerCommentary(
  ctx: TickerContext,
  userId: string | null = null,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const message = `Analyze this opportunity setup:
Ticker: ${ctx.ticker} (${ctx.name}) — ${ctx.assetType}${ctx.sector ? `, ${ctx.sector}` : ''}
Price: $${ctx.price?.toFixed(2) ?? 'N/A'} (${ctx.changePct != null ? (ctx.changePct >= 0 ? '+' : '') + (ctx.changePct * 100).toFixed(1) + '%' : 'N/A'})
Opportunity Score: ${ctx.scores.opportunity}/100 — ${ctx.label}, ${ctx.riskLabel} risk, ${ctx.setupType} setup
Components: Momentum ${ctx.scores.momentum}, Breakout ${ctx.scores.breakout}, Reversion ${ctx.scores.meanReversion}, Catalyst ${ctx.scores.catalyst}, Sentiment ${ctx.scores.sentiment}, Volatility ${ctx.scores.volatility}, Regime ${ctx.scores.regimeFit}
Horizon: ~${ctx.horizonDays} days`;

  return callAgent('Mark', 'mark.ticker_commentary', message, 'ticker', ctx.ticker, sourceRunId, userId);
}

export async function niaTickerCommentary(
  ctx: TickerContext,
  userId: string | null = null,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const message = `Assess the narrative and catalyst quality for:
Ticker: ${ctx.ticker} (${ctx.name}) — ${ctx.assetType}
Catalyst Score: ${ctx.scores.catalyst}/100
Sentiment Score: ${ctx.scores.sentiment}/100 (${ctx.scores.sentiment >= 65 ? 'elevated attention' : ctx.scores.sentiment >= 45 ? 'normal' : 'below average'})
${ctx.fundamentals ? `Revenue Growth: ${ctx.fundamentals.revenueGrowth != null ? (ctx.fundamentals.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}, Margin: ${ctx.fundamentals.profitMargin != null ? (ctx.fundamentals.profitMargin * 100).toFixed(1) + '%' : 'N/A'}, ROE: ${ctx.fundamentals.roe != null ? (ctx.fundamentals.roe * 100).toFixed(1) + '%' : 'N/A'}` : 'No fundamental data (likely crypto).'}`;

  return callAgent('Nia', 'nia.ticker_commentary', message, 'ticker', ctx.ticker, sourceRunId, userId);
}

export async function paulBasketBrief(
  ctx: BasketContext,
  userId: string,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const positionLines = ctx.positions.map(
    (p) => `  ${p.ticker}: ${p.weight.toFixed(1)}% weight, ${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}% P&L, score ${p.score}, ${p.riskLabel} risk`
  ).join('\n');

  const message = `Assess this basket's health and balance:
Positions: ${ctx.positionCount} (${ctx.winners}W / ${ctx.losers}L)
Value: $${ctx.totalValue.toFixed(0)} | Invested: $${ctx.totalCost.toFixed(0)} | Return: ${ctx.totalPnlPct >= 0 ? '+' : ''}${ctx.totalPnlPct.toFixed(1)}%
${positionLines}
${ctx.analytics ? `Analytics: Probability ${ctx.analytics.probabilityScore}/100 (${ctx.analytics.basketQuality}), Concentration: ${ctx.analytics.concentrationRisk}, Correlation: ${ctx.analytics.correlationRisk}, Crypto: ${ctx.analytics.cryptoAllocation.toFixed(0)}%, Largest: ${ctx.analytics.largestPosition} at ${ctx.analytics.largestPositionPct.toFixed(0)}%` : ''}`;

  return callAgent('Paul', 'paul.basket_brief', message, 'basket', null, sourceRunId, userId);
}

export async function rexActionExplanation(
  ctx: ActionContext,
  basketCtx: BasketContext | null,
  userId: string,
): Promise<AgentArtifact> {
  const message = `Justify this recommended action:
Action: ${ctx.action} on ${ctx.ticker}
Urgency: ${ctx.urgency}
System reason: ${ctx.reason}
Position: ${ctx.positionWeight.toFixed(1)}% of basket, P&L ${ctx.pnlPct >= 0 ? '+' : ''}${ctx.pnlPct.toFixed(1)}%, score ${ctx.opportunityScore}/100, ${ctx.riskLabel} risk
${basketCtx ? `Basket context: ${basketCtx.positionCount} positions, overall ${basketCtx.totalPnlPct >= 0 ? '+' : ''}${basketCtx.totalPnlPct.toFixed(1)}%` : ''}`;

  return callAgent('Rex', 'rex.action_explanation', message, 'recommendation', ctx.ticker, null, userId);
}

export async function markMarketBrief(
  ctx: MarketContext,
  userId: string | null = null,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const topLines = ctx.topOpportunities.slice(0, 5).map(
    (o) => `  ${o.ticker} (${o.name}): ${o.score}/100, ${o.label}, ${o.setupType}, ${o.riskLabel} risk`
  ).join('\n');

  const message = `Summarize the market scan results:
Universe: ${ctx.totalAssets} assets | ${ctx.hotNowCount} Hot Now, ${ctx.swingCount} Swing, ${ctx.runCount} Run
Last scan: ${ctx.lastScanAt ?? 'unknown'}
Top setups:\n${topLines}`;

  return callAgent('Mark', 'mark.market_brief', message, 'market', null, sourceRunId, userId);
}

// ─── Contextual Ask ───

export async function askAgent(
  agentName: AgentName,
  question: string,
  context: string,
  subjectType: AgentArtifact['subject_type'],
  subjectId: string | null,
  userId: string,
): Promise<AgentArtifact> {
  const message = `User question: ${question}\n\nContext:\n${context}`;
  return callAgent(agentName, `${agentName.toLowerCase()}.ask`, message, subjectType, subjectId, null, userId);
}

// ─── Retrieve persisted artifacts ───

export async function getLatestArtifact(
  agentName: AgentName,
  subjectType: string,
  subjectId: string | null,
): Promise<AgentArtifact | null> {
  const db = getAdminClient();

  let query = db
    .schema('trader')
    .from('agent_briefs')
    .select('*')
    .eq('agent_name', agentName)
    .order('created_at', { ascending: false })
    .limit(1);

  try {
    if (subjectType) query = query.eq('subject_type', subjectType);
    if (subjectId) query = query.eq('subject_id', subjectId);
  } catch { /* columns may not exist */ }

  const { data } = await query.single();
  if (!data) return null;

  return mapToArtifact(data);
}

export async function getArtifactsForSubject(
  subjectType: string,
  subjectId: string | null,
  limit: number = 10,
): Promise<AgentArtifact[]> {
  const db = getAdminClient();

  let query = db
    .schema('trader')
    .from('agent_briefs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  try {
    if (subjectType) query = query.eq('subject_type', subjectType);
    if (subjectId) query = query.eq('subject_id', subjectId);
  } catch { /* columns may not exist */ }

  const { data } = await query;
  return (data ?? []).map(mapToArtifact);
}

function mapToArtifact(d: Record<string, unknown>): AgentArtifact {
  const so = d.structured_output as Record<string, unknown> | null;
  const status = (so?.status as ArtifactStatus) ?? 'success';
  const latencyMs = (so?.latency_ms as number) ?? null;

  return {
    id: d.id as string,
    agent_name: d.agent_name as AgentName,
    subject_type: (d.subject_type as AgentArtifact['subject_type']) ?? 'market',
    subject_id: (d.subject_id as string) ?? null,
    brief_type: d.brief_type as string,
    content: d.content as string,
    structured_output: so && typeof so.stance === 'string' ? {
      stance: so.stance as AgentStructuredOutput['stance'],
      confidence: (so.confidence as number) ?? 0.5,
      topDrivers: (so.topDrivers as string[]) ?? [],
      risks: (so.risks as string[]) ?? [],
      summary: (so.summary as string) ?? d.content as string,
    } : null,
    prompt_key: (d.prompt_key as string) ?? '',
    prompt_version: ((d.prompt_key as string) ?? '').split('@')[1] ?? PROMPT_VERSION,
    model: (d.model as string) ?? '',
    source_run_id: (d.source_run_id as string) ?? null,
    tokens_used: (d.tokens_used as number) ?? null,
    latency_ms: latencyMs,
    status,
    created_at: d.created_at as string,
  };
}
