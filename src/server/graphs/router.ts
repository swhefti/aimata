/**
 * Specialist Routing Graph — Phase 7B
 *
 * LangGraph graph that:
 * 1. Takes a user question + subject context
 * 2. Routes to the most appropriate specialist (Mark/Nia/Paul/Rex)
 * 3. Invokes the specialist with bounded context
 * 4. Persists thread, messages, routing decision, and graph run
 *
 * The graph is grounded in existing deterministic data.
 * It routes to explain and reason, not to replace scoring or actions.
 */

import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getAdminClient } from '@/server/db';
import { AGENT_SPECS, PROMPT_VERSION, type AgentStructuredOutput } from '@/server/agents/contracts';
import type { AgentName } from '@/types';

// ─── Graph State ───

const RouterState = Annotation.Root({
  // Inputs
  userId: Annotation<string>,
  question: Annotation<string>,
  subjectType: Annotation<string>,
  subjectId: Annotation<string | null>,
  contextSummary: Annotation<string>,

  // Routing
  routedAgent: Annotation<AgentName | null>,
  routingReason: Annotation<string>,

  // Thread/run IDs (set after creation)
  threadId: Annotation<string>,
  graphRunId: Annotation<string>,

  // Specialist output
  answer: Annotation<string>,
  structured: Annotation<AgentStructuredOutput | null>,
  answerStatus: Annotation<string>,
  tokensUsed: Annotation<number>,
  latencyMs: Annotation<number>,
});

type RouterStateType = typeof RouterState.State;

// ─── Node: Route the question ───

async function routeNode(state: RouterStateType): Promise<Partial<RouterStateType>> {
  const db = getAdminClient();
  const startTime = Date.now();

  try {
    const model = new ChatAnthropic({
      model: 'claude-haiku-3-5-20241022',
      maxTokens: 128,
      temperature: 0,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await model.invoke([
      new SystemMessage(
        `You are a routing classifier for aiMATA, a trading intelligence platform with 4 specialist agents.

Agents and their domains:
- Mark: opportunity setups, scores, momentum, breakouts, timing, technical quality
- Nia: catalysts, news, sentiment, fundamentals, narrative support, market mood
- Paul: basket health, concentration, correlation, diversification, portfolio risk, balance
- Rex: position actions, trim/hold/exit/add decisions, P&L discipline, trade management

Given the user's question and the subject context, respond with ONLY a JSON object:
{"agent":"Mark|Nia|Paul|Rex","reason":"one short sentence why this agent"}

Route to the best single specialist. If ambiguous, prefer:
- Mark for opportunity/ticker questions
- Paul for basket/portfolio questions
- Rex for action/trade questions
- Nia for why/narrative/catalyst questions`
      ),
      new HumanMessage(
        `Subject: ${state.subjectType}${state.subjectId ? ` (${state.subjectId})` : ''}
Question: ${state.question}
Context preview: ${state.contextSummary.substring(0, 300)}`
      ),
    ]);

    const rawText = typeof response.content === 'string'
      ? response.content
      : (response.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('');

    // Parse routing decision
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const agent = parsed.agent as string;
      const validAgents = ['Mark', 'Nia', 'Paul', 'Rex'];
      if (validAgents.includes(agent)) {
        // Persist routing node
        try {
          await db.schema('trader').from('node_runs').insert({
            graph_run_id: state.graphRunId,
            node_name: 'route',
            agent_name: agent,
            status: 'success',
            input_summary: state.question.substring(0, 200),
            output_text: rawText,
            structured_output: { agent, reason: parsed.reason },
            tokens_used: (response.usage_metadata?.input_tokens ?? 0) + (response.usage_metadata?.output_tokens ?? 0),
            latency_ms: Date.now() - startTime,
          });
        } catch { /* non-critical */ }

        return {
          routedAgent: agent as AgentName,
          routingReason: parsed.reason ?? `Routed to ${agent}`,
        };
      }
    }
  } catch (err) {
    console.error('Routing failed:', err instanceof Error ? err.message : err);
  }

  // Fallback routing based on subject type
  const fallbackAgent = inferAgentFromContext(state.subjectType, state.question);
  return {
    routedAgent: fallbackAgent,
    routingReason: `Fallback: routed by subject type (${state.subjectType})`,
  };
}

function inferAgentFromContext(subjectType: string, question: string): AgentName {
  const q = question.toLowerCase();

  // Keyword-based fallback
  if (q.includes('trim') || q.includes('sell') || q.includes('exit') || q.includes('hold') || q.includes('add more') || q.includes('action')) return 'Rex';
  if (q.includes('basket') || q.includes('risk') || q.includes('concentrated') || q.includes('diversif')) return 'Paul';
  if (q.includes('news') || q.includes('catalyst') || q.includes('sentiment') || q.includes('why is it moving') || q.includes('narrative')) return 'Nia';

  // Subject-type based
  switch (subjectType) {
    case 'ticker': return 'Mark';
    case 'basket': return 'Paul';
    case 'recommendation': return 'Rex';
    default: return 'Mark';
  }
}

// ─── Node: Run the routed specialist ───

async function specialistNode(state: RouterStateType): Promise<Partial<RouterStateType>> {
  const agent = state.routedAgent;
  if (!agent) {
    return { answer: 'Could not determine which specialist to ask.', answerStatus: 'failed', tokensUsed: 0, latencyMs: 0 };
  }

  const db = getAdminClient();
  const spec = AGENT_SPECS[agent];
  const startTime = Date.now();

  try {
    const model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      maxTokens: 512,
      temperature: 0.3,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await model.invoke([
      new SystemMessage(`${spec.systemPrompt}\n\n${spec.boundaryInstruction}\n\nThe user is asking you a specific question. Answer it directly based on the context provided. Stay concise (3-5 sentences).\n\n${spec.outputInstruction}`),
      new HumanMessage(`User question: ${state.question}\n\nContext:\n${state.contextSummary}`),
    ]);

    const rawText = typeof response.content === 'string'
      ? response.content
      : (response.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('');

    const tokensUsed = (response.usage_metadata?.input_tokens ?? 0) + (response.usage_metadata?.output_tokens ?? 0);
    const latencyMs = Date.now() - startTime;

    const structured = parseStructuredJSON(rawText);
    const content = structured?.summary ?? rawText;

    // Persist specialist node
    try {
      await db.schema('trader').from('node_runs').insert({
        graph_run_id: state.graphRunId,
        node_name: `specialist_${agent.toLowerCase()}`,
        agent_name: agent,
        status: structured ? 'success' : 'fallback',
        input_summary: state.question.substring(0, 200),
        output_text: content,
        structured_output: structured,
        tokens_used: tokensUsed,
        latency_ms: latencyMs,
      });
    } catch { /* non-critical */ }

    // Persist agent message
    try {
      await db.schema('trader').from('agent_messages').insert({
        thread_id: state.threadId,
        role: 'assistant',
        agent_name: agent,
        content,
        structured_output: structured,
        tokens_used: tokensUsed,
        latency_ms: latencyMs,
        prompt_key: `${agent.toLowerCase()}.routed@${PROMPT_VERSION}`,
        model: 'claude-sonnet-4-20250514',
      });
    } catch { /* non-critical */ }

    return {
      answer: content,
      structured,
      answerStatus: structured ? 'success' : 'fallback',
      tokensUsed,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error(`Specialist ${agent} failed:`, err instanceof Error ? err.message : err);

    const fallback = `I couldn't complete the analysis right now. Based on the data available, review the system metrics above for ${state.subjectId ?? state.subjectType} — the deterministic scores and actions remain valid.`;

    try {
      await db.schema('trader').from('node_runs').insert({
        graph_run_id: state.graphRunId,
        node_name: `specialist_${agent.toLowerCase()}`,
        agent_name: agent,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown',
        latency_ms: latencyMs,
      });
    } catch { /* non-critical */ }

    // Persist the fallback assistant message so the thread isn't left empty
    try {
      await db.schema('trader').from('agent_messages').insert({
        thread_id: state.threadId,
        role: 'assistant',
        agent_name: agent,
        content: fallback,
        structured_output: null,
        tokens_used: 0,
        latency_ms: latencyMs,
        prompt_key: `${agent.toLowerCase()}.routed.fallback@${PROMPT_VERSION}`,
        model: 'fallback',
      });
    } catch { /* non-critical */ }

    return {
      answer: fallback,
      structured: null,
      answerStatus: 'failed',
      tokensUsed: 0,
      latencyMs,
    };
  }
}

// ─── Conditional edge: route → specialist ───

function routeToSpecialist(state: RouterStateType): string {
  // Always goes to the specialist node (routing is already done)
  return 'specialist';
}

// ─── Build the graph ───

function buildRouterGraph() {
  const graph = new StateGraph(RouterState)
    .addNode('route', routeNode)
    .addNode('specialist', specialistNode)
    .addEdge('__start__', 'route')
    .addConditionalEdges('route', routeToSpecialist, { specialist: 'specialist' })
    .addEdge('specialist', END);

  return graph.compile();
}

// ─── Public API ───

export interface RoutedAnswer {
  threadId: string;
  graphRunId: string;
  question: string;
  routedAgent: AgentName;
  routingReason: string;
  answer: string;
  structured: AgentStructuredOutput | null;
  status: string;
  tokensUsed: number;
  latencyMs: number;
}

/**
 * Ask a contextual question. The router decides which specialist answers.
 */
export async function askWithRouting(
  userId: string,
  question: string,
  subjectType: string,
  subjectId: string | null,
  contextSummary: string,
): Promise<RoutedAnswer> {
  const db = getAdminClient();
  const startTime = Date.now();

  // Create graph run
  const { data: runData } = await db.schema('trader').from('graph_runs').insert({
    user_id: userId,
    graph_type: 'specialist_routing',
    subject_type: subjectType,
    subject_id: subjectId,
    status: 'running',
    node_count: 2,
  }).select('id').single();

  const graphRunId = (runData?.id as string) ?? crypto.randomUUID();

  // Create thread
  const { data: threadData } = await db.schema('trader').from('agent_threads').insert({
    user_id: userId,
    subject_type: subjectType,
    subject_id: subjectId,
    graph_run_id: graphRunId,
    status: 'active',
  }).select('id').single();

  const threadId = (threadData?.id as string) ?? crypto.randomUUID();

  // Persist user message
  try {
    await db.schema('trader').from('agent_messages').insert({
      thread_id: threadId,
      role: 'user',
      content: question,
    });
  } catch { /* non-critical */ }

  try {
    const app = buildRouterGraph();

    const result = await app.invoke({
      userId,
      question,
      subjectType,
      subjectId,
      contextSummary,
      routedAgent: null,
      routingReason: '',
      threadId,
      graphRunId,
      answer: '',
      structured: null,
      answerStatus: 'pending',
      tokensUsed: 0,
      latencyMs: 0,
    });

    const totalLatency = Date.now() - startTime;

    // Update graph run
    await db.schema('trader').from('graph_runs').update({
      status: result.answerStatus === 'failed' ? 'completed_with_errors' : 'completed',
      nodes_completed: 2,
      total_tokens: result.tokensUsed,
      total_latency_ms: totalLatency,
      completed_at: new Date().toISOString(),
    }).eq('id', graphRunId);

    // Update thread with routing info
    await db.schema('trader').from('agent_threads').update({
      routed_agent: result.routedAgent,
      routing_reason: result.routingReason,
      updated_at: new Date().toISOString(),
    }).eq('id', threadId);

    return {
      threadId,
      graphRunId,
      question,
      routedAgent: result.routedAgent ?? 'Mark',
      routingReason: result.routingReason,
      answer: result.answer,
      structured: result.structured,
      status: result.answerStatus,
      tokensUsed: result.tokensUsed,
      latencyMs: totalLatency,
    };
  } catch (err) {
    await db.schema('trader').from('graph_runs').update({
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Unknown',
      completed_at: new Date().toISOString(),
    }).eq('id', graphRunId);

    throw err;
  }
}

// ─── Helpers ───

function parseStructuredJSON(text: string): AgentStructuredOutput | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.stance && parsed.summary) {
      return {
        stance: parsed.stance,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        topDrivers: Array.isArray(parsed.topDrivers) ? parsed.topDrivers.slice(0, 5) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
        summary: String(parsed.summary).substring(0, 800),
      };
    }
  } catch { /* not valid JSON */ }
  return null;
}
