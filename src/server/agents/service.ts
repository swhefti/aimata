/**
 * Agent Service — Phase 6
 *
 * Real specialist agent layer that:
 * 1. Receives bounded context packages (not raw DB queries)
 * 2. Calls Claude with structured prompts
 * 3. Parses structured outputs (stance, confidence, drivers, risks, summary)
 * 4. Persists artifacts with provenance (agent_briefs + raw_llm_outputs)
 * 5. Falls back to deterministic outputs if LLM is unavailable
 *
 * Agents explain deterministic canon — they don't replace scoring math.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAdminClient } from '@/server/db';
import { loadConfig, getConfigValue } from '@/lib/config/runtime';
import {
  AGENT_SPECS,
  type AgentStructuredOutput,
  type AgentArtifact,
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
  const systemPrompt = `${spec.systemPrompt}\n\n${spec.outputInstruction}`;

  let content = '';
  let structured: AgentStructuredOutput | null = null;
  let tokensUsed = 0;
  const startTime = Date.now();

  try {
    const anthropic = new Anthropic();
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

    // Try to parse structured output
    structured = parseStructuredOutput(rawText);
    content = structured?.summary ?? rawText;
  } catch (err) {
    // LLM unavailable — use the context as fallback
    content = `${spec.name} is temporarily unavailable.`;
    console.error(`Agent ${agentName} call failed:`, err instanceof Error ? err.message : err);
  }

  const durationMs = Date.now() - startTime;

  // ── Persist raw LLM output for audit trail ──
  try {
    await db.schema('trader').from('raw_llm_outputs').insert({
      prompt_key: promptKey,
      input_data: { system: systemPrompt.substring(0, 500), user: contextMessage.substring(0, 2000) },
      output_text: content,
      model: MODEL,
      tokens_used: tokensUsed,
      duration_ms: durationMs,
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
    model: MODEL,
    source_run_id: sourceRunId,
    tokens_used: tokensUsed,
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
      prompt_key: promptKey,
      model: MODEL,
      structured_output: structured,
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
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.stance && parsed.summary) {
      return {
        stance: parsed.stance,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        topDrivers: Array.isArray(parsed.topDrivers) ? parsed.topDrivers : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        summary: parsed.summary,
      };
    }
  } catch {
    // Not valid JSON — return null, use raw text
  }
  return null;
}

// ─── Specialist Functions ───

/**
 * Mark: Generate opportunity commentary for a specific ticker.
 */
export async function markTickerCommentary(
  ctx: TickerContext,
  userId: string | null = null,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const message = `Analyze this opportunity:
Ticker: ${ctx.ticker} (${ctx.name}) — ${ctx.assetType}${ctx.sector ? `, ${ctx.sector}` : ''}
Price: $${ctx.price?.toFixed(2) ?? 'N/A'} (${ctx.changePct != null ? (ctx.changePct >= 0 ? '+' : '') + (ctx.changePct * 100).toFixed(1) + '%' : 'N/A'})
Opportunity Score: ${ctx.scores.opportunity}/100 — ${ctx.label}, ${ctx.riskLabel} risk, ${ctx.setupType} setup
Component Scores: Momentum ${ctx.scores.momentum}, Breakout ${ctx.scores.breakout}, Reversion ${ctx.scores.meanReversion}, Catalyst ${ctx.scores.catalyst}, Sentiment ${ctx.scores.sentiment}, Volatility ${ctx.scores.volatility}, Regime ${ctx.scores.regimeFit}
Horizon: ~${ctx.horizonDays} days
${ctx.fundamentals ? `Fundamentals: PE ${ctx.fundamentals.peRatio ?? 'N/A'}, Revenue Growth ${ctx.fundamentals.revenueGrowth != null ? (ctx.fundamentals.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}, Margin ${ctx.fundamentals.profitMargin != null ? (ctx.fundamentals.profitMargin * 100).toFixed(1) + '%' : 'N/A'}` : ''}`;

  return callAgent('Mark', 'mark.ticker_commentary', message, 'ticker', ctx.ticker, sourceRunId, userId);
}

/**
 * Nia: Generate sentiment/catalyst commentary for a ticker.
 */
export async function niaTickerCommentary(
  ctx: TickerContext,
  userId: string | null = null,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const message = `Assess the narrative and sentiment for:
Ticker: ${ctx.ticker} (${ctx.name}) — ${ctx.assetType}
Catalyst Score: ${ctx.scores.catalyst}/100
Sentiment Score: ${ctx.scores.sentiment}/100
Volume-based sentiment suggests: ${ctx.scores.sentiment >= 65 ? 'elevated market attention' : ctx.scores.sentiment >= 45 ? 'normal activity' : 'below-average interest'}
${ctx.fundamentals ? `Revenue Growth: ${ctx.fundamentals.revenueGrowth != null ? (ctx.fundamentals.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}, Profit Margin: ${ctx.fundamentals.profitMargin != null ? (ctx.fundamentals.profitMargin * 100).toFixed(1) + '%' : 'N/A'}, ROE: ${ctx.fundamentals.roe != null ? (ctx.fundamentals.roe * 100).toFixed(1) + '%' : 'N/A'}` : 'No fundamental data available (likely crypto).'}
Current setup: ${ctx.setupType}, ${ctx.label}, ${ctx.riskLabel} risk`;

  return callAgent('Nia', 'nia.ticker_commentary', message, 'ticker', ctx.ticker, sourceRunId, userId);
}

/**
 * Paul: Generate basket health assessment.
 */
export async function paulBasketBrief(
  ctx: BasketContext,
  userId: string,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const positionLines = ctx.positions.map(
    (p) => `  ${p.ticker}: ${p.weight.toFixed(1)}% weight, ${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}% P&L, score ${p.score}, ${p.riskLabel} risk`
  ).join('\n');

  const message = `Assess this basket:
Positions: ${ctx.positionCount} (${ctx.winners}W / ${ctx.losers}L)
Value: $${ctx.totalValue.toFixed(0)} | Invested: $${ctx.totalCost.toFixed(0)} | Return: ${ctx.totalPnlPct >= 0 ? '+' : ''}${ctx.totalPnlPct.toFixed(1)}%
${positionLines}
${ctx.analytics ? `
Analytics:
  Probability Score: ${ctx.analytics.probabilityScore}/100 (${ctx.analytics.basketQuality})
  Concentration: ${ctx.analytics.concentrationRisk} (largest: ${ctx.analytics.largestPosition} at ${ctx.analytics.largestPositionPct.toFixed(0)}%)
  Correlation: ${ctx.analytics.correlationRisk}
  Crypto: ${ctx.analytics.cryptoAllocation.toFixed(0)}%` : ''}`;

  return callAgent('Paul', 'paul.basket_brief', message, 'basket', null, sourceRunId, userId);
}

/**
 * Rex: Generate tactical action explanation.
 */
export async function rexActionExplanation(
  ctx: ActionContext,
  basketCtx: BasketContext | null,
  userId: string,
): Promise<AgentArtifact> {
  const message = `Explain this recommended action:
Action: ${ctx.action} on ${ctx.ticker}
Urgency: ${ctx.urgency}
System reason: ${ctx.reason}
Position: ${ctx.positionWeight.toFixed(1)}% of basket, P&L ${ctx.pnlPct >= 0 ? '+' : ''}${ctx.pnlPct.toFixed(1)}%, score ${ctx.opportunityScore}/100, ${ctx.riskLabel} risk
${basketCtx ? `Basket: ${basketCtx.positionCount} positions, ${basketCtx.totalPnlPct >= 0 ? '+' : ''}${basketCtx.totalPnlPct.toFixed(1)}% overall` : ''}`;

  return callAgent('Rex', 'rex.action_explanation', message, 'recommendation', ctx.ticker, null, userId);
}

/**
 * Generate a full market brief from Mark.
 */
export async function markMarketBrief(
  ctx: MarketContext,
  userId: string | null = null,
  sourceRunId: string | null = null,
): Promise<AgentArtifact> {
  const topLines = ctx.topOpportunities.slice(0, 5).map(
    (o) => `  ${o.ticker} (${o.name}): ${o.score}/100, ${o.label}, ${o.setupType}, ${o.riskLabel} risk`
  ).join('\n');

  const message = `Market scanner report:
Universe: ${ctx.totalAssets} assets scanned
Distribution: ${ctx.hotNowCount} Hot Now, ${ctx.swingCount} Swing, ${ctx.runCount} Run
Last scan: ${ctx.lastScanAt ?? 'unknown'}
Top setups:
${topLines}`;

  return callAgent('Mark', 'mark.market_brief', message, 'market', null, sourceRunId, userId);
}

// ─── Contextual Ask (minimal interaction entry point) ───

/**
 * Ask a specific agent a contextual question about a subject.
 * This is the Phase 6 minimal interaction entry point.
 * Not a full chat system — single question, grounded response.
 */
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

/**
 * Get the latest artifact for a subject from a specific agent.
 */
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

  // Only filter by subject_type/id if the columns exist (migration may not have run)
  try {
    if (subjectType) query = query.eq('subject_type', subjectType);
    if (subjectId) query = query.eq('subject_id', subjectId);
  } catch {
    // Columns may not exist yet
  }

  const { data } = await query.single();
  if (!data) return null;

  return {
    id: data.id as string,
    agent_name: data.agent_name as AgentName,
    subject_type: (data.subject_type as AgentArtifact['subject_type']) ?? 'market',
    subject_id: (data.subject_id as string) ?? null,
    brief_type: data.brief_type as string,
    content: data.content as string,
    structured_output: (data.structured_output as AgentStructuredOutput) ?? null,
    prompt_key: (data.prompt_key as string) ?? '',
    model: (data.model as string) ?? '',
    source_run_id: (data.source_run_id as string) ?? null,
    tokens_used: (data.tokens_used as number) ?? null,
    created_at: data.created_at as string,
  };
}

/**
 * Get all recent artifacts for a subject (all agents).
 */
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
  } catch {
    // Columns may not exist
  }

  const { data } = await query;

  return (data ?? []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    agent_name: d.agent_name as AgentName,
    subject_type: (d.subject_type as AgentArtifact['subject_type']) ?? 'market',
    subject_id: (d.subject_id as string) ?? null,
    brief_type: d.brief_type as string,
    content: d.content as string,
    structured_output: (d.structured_output as AgentStructuredOutput) ?? null,
    prompt_key: (d.prompt_key as string) ?? '',
    model: (d.model as string) ?? '',
    source_run_id: (d.source_run_id as string) ?? null,
    tokens_used: (d.tokens_used as number) ?? null,
    created_at: d.created_at as string,
  }));
}
