/**
 * Committee Synthesis Graph — Phase 7A
 *
 * LangGraph-powered graph that:
 * 1. Loads structured deterministic context (basket, analytics, feed, actions)
 * 2. Runs Mark, Nia, Paul, Rex specialist nodes in parallel
 * 3. Synthesizes their outputs into a unified committee brief
 * 4. Persists graph runs, node outputs, and the final artifact
 *
 * The graph reads from existing deterministic outputs and agent service.
 * It does NOT replace scoring, recommendation, or action logic.
 * It synthesizes and explains what the deterministic core has already computed.
 */

import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getAdminClient } from '@/server/db';
import { AGENT_SPECS, PROMPT_VERSION, type AgentStructuredOutput } from '@/server/agents/contracts';
import type { AgentName } from '@/types';

// ─── Graph State ───

interface SpecialistOutput {
  agent: AgentName;
  content: string;
  structured: AgentStructuredOutput | null;
  status: 'success' | 'failed' | 'fallback';
  tokensUsed: number;
  latencyMs: number;
}

const CommitteeState = Annotation.Root({
  // Input context
  userId: Annotation<string>,
  subjectType: Annotation<string>,
  subjectId: Annotation<string | null>,
  contextSummary: Annotation<string>,
  graphRunId: Annotation<string>,

  // Specialist outputs (parallel)
  markOutput: Annotation<SpecialistOutput | null>,
  niaOutput: Annotation<SpecialistOutput | null>,
  paulOutput: Annotation<SpecialistOutput | null>,
  rexOutput: Annotation<SpecialistOutput | null>,

  // Synthesis
  committeeBrief: Annotation<string>,
  committeeStructured: Annotation<AgentStructuredOutput | null>,
  status: Annotation<string>,
  error: Annotation<string | null>,
});

type CommitteeStateType = typeof CommitteeState.State;

// ─── Node: Run one specialist ───

function createSpecialistNode(agentName: AgentName) {
  const stateKey = `${agentName.toLowerCase()}Output` as 'markOutput' | 'niaOutput' | 'paulOutput' | 'rexOutput';

  return async (state: CommitteeStateType): Promise<Partial<CommitteeStateType>> => {
    const spec = AGENT_SPECS[agentName];
    const startTime = Date.now();
    const db = getAdminClient();

    try {
      const model = new ChatAnthropic({
        model: 'claude-sonnet-4-20250514',
        maxTokens: 512,
        temperature: 0.3,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await model.invoke([
        new SystemMessage(`${spec.systemPrompt}\n\n${spec.boundaryInstruction}\n\n${spec.outputInstruction}`),
        new HumanMessage(state.contextSummary),
      ]);

      const rawText = typeof response.content === 'string'
        ? response.content
        : (response.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');

      const tokensUsed = (response.usage_metadata?.input_tokens ?? 0) + (response.usage_metadata?.output_tokens ?? 0);
      const latencyMs = Date.now() - startTime;
      const structured = parseStructuredJSON(rawText);

      const output: SpecialistOutput = {
        agent: agentName,
        content: structured?.summary ?? rawText,
        structured,
        status: structured ? 'success' : 'fallback',
        tokensUsed,
        latencyMs,
      };

      // Persist node run
      try {
        await db.schema('trader').from('node_runs').insert({
          graph_run_id: state.graphRunId,
          node_name: `specialist_${agentName.toLowerCase()}`,
          agent_name: agentName,
          status: output.status,
          input_summary: state.contextSummary.substring(0, 500),
          output_text: output.content,
          structured_output: output.structured,
          tokens_used: output.tokensUsed,
          latency_ms: output.latencyMs,
        });
      } catch { /* non-critical */ }

      return { [stateKey]: output } as Partial<CommitteeStateType>;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const fallback: SpecialistOutput = {
        agent: agentName,
        content: `${agentName} could not complete analysis.`,
        structured: null,
        status: 'failed',
        tokensUsed: 0,
        latencyMs,
      };

      try {
        await db.schema('trader').from('node_runs').insert({
          graph_run_id: state.graphRunId,
          node_name: `specialist_${agentName.toLowerCase()}`,
          agent_name: agentName,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          latency_ms: latencyMs,
        });
      } catch { /* non-critical */ }

      return { [stateKey]: fallback } as Partial<CommitteeStateType>;
    }
  };
}

// ─── Node: Synthesize committee brief ───

async function synthesizeNode(state: CommitteeStateType): Promise<Partial<CommitteeStateType>> {
  const db = getAdminClient();
  const startTime = Date.now();

  const specialists = [
    { name: 'Mark', output: state.markOutput },
    { name: 'Nia', output: state.niaOutput },
    { name: 'Paul', output: state.paulOutput },
    { name: 'Rex', output: state.rexOutput },
  ].filter(s => s.output && s.output.status !== 'failed');

  const specialistSummaries = specialists.map(s => {
    const o = s.output!;
    const stanceStr = o.structured ? ` (${o.structured.stance}, ${Math.round(o.structured.confidence * 100)}% confidence)` : '';
    return `${s.name}${stanceStr}: ${o.content}`;
  }).join('\n\n');

  try {
    const model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      maxTokens: 768,
      temperature: 0.2,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await model.invoke([
      new SystemMessage(
        `You are the aiMATA committee synthesizer. You receive assessments from 4 specialist agents (Mark=opportunity, Nia=sentiment, Paul=basket/risk, Rex=tactics) and produce a unified committee brief.\n\n` +
        `Rules:\n` +
        `- Synthesize, don't just concatenate\n` +
        `- Highlight agreements and tensions between specialists\n` +
        `- Lead with what matters most right now\n` +
        `- Keep it actionable and concise (4-6 sentences)\n` +
        `- If specialists disagree, explain the tension\n\n` +
        `Respond with ONLY a JSON object: {"stance":"bullish|neutral|bearish|cautious|urgent","confidence":0.0-1.0,"topDrivers":["..."],"risks":["..."],"summary":"4-6 sentence synthesis"}`
      ),
      new HumanMessage(
        `Context:\n${state.contextSummary}\n\nSpecialist assessments:\n${specialistSummaries}`
      ),
    ]);

    const rawText = typeof response.content === 'string'
      ? response.content
      : (response.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');

    const tokensUsed = (response.usage_metadata?.input_tokens ?? 0) + (response.usage_metadata?.output_tokens ?? 0);
    const latencyMs = Date.now() - startTime;
    const structured = parseStructuredJSON(rawText);

    // Persist synthesis node
    try {
      await db.schema('trader').from('node_runs').insert({
        graph_run_id: state.graphRunId,
        node_name: 'synthesize',
        agent_name: 'committee',
        status: 'success',
        output_text: structured?.summary ?? rawText,
        structured_output: structured,
        tokens_used: tokensUsed,
        latency_ms: latencyMs,
      });
    } catch { /* non-critical */ }

    return {
      committeeBrief: structured?.summary ?? rawText,
      committeeStructured: structured,
      status: 'completed',
    };
  } catch (err) {
    // Synthesizer failed — fall back to concatenation
    const fallback = specialists.map(s => `**${s.name}:** ${s.output!.content}`).join('\n\n');
    const latencyMs = Date.now() - startTime;

    try {
      await db.schema('trader').from('node_runs').insert({
        graph_run_id: state.graphRunId,
        node_name: 'synthesize',
        agent_name: 'committee',
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown',
        latency_ms: latencyMs,
      });
    } catch { /* non-critical */ }

    return {
      committeeBrief: fallback,
      committeeStructured: null,
      status: 'completed_with_errors',
    };
  }
}

// ─── Build the graph ───

function buildCommitteeGraph() {
  const graph = new StateGraph(CommitteeState)
    // Specialist nodes (will run in parallel via fan-out)
    .addNode('mark', createSpecialistNode('Mark'))
    .addNode('nia', createSpecialistNode('Nia'))
    .addNode('paul', createSpecialistNode('Paul'))
    .addNode('rex', createSpecialistNode('Rex'))
    // Synthesis node
    .addNode('synthesize', synthesizeNode)
    // Edges: start → all specialists in parallel
    .addEdge('__start__', 'mark')
    .addEdge('__start__', 'nia')
    .addEdge('__start__', 'paul')
    .addEdge('__start__', 'rex')
    // All specialists → synthesize
    .addEdge('mark', 'synthesize')
    .addEdge('nia', 'synthesize')
    .addEdge('paul', 'synthesize')
    .addEdge('rex', 'synthesize')
    // synthesize → end
    .addEdge('synthesize', END);

  return graph.compile();
}

// ─── Public API ───

export interface CommitteeResult {
  graphRunId: string;
  committeeBrief: string;
  committeeStructured: AgentStructuredOutput | null;
  specialists: {
    agent: string;
    content: string;
    stance: string | null;
    confidence: number | null;
    status: string;
  }[];
  status: string;
  totalTokens: number;
  totalLatencyMs: number;
}

/**
 * Run the committee synthesis graph.
 *
 * Takes a pre-built context summary (from deterministic data) and
 * runs all 4 specialists + synthesis. Persists everything.
 */
export async function runCommitteeSynthesis(
  userId: string,
  subjectType: string,
  subjectId: string | null,
  contextSummary: string,
): Promise<CommitteeResult> {
  const db = getAdminClient();
  const startTime = Date.now();

  // Create graph run record
  const { data: runData, error: runError } = await db
    .schema('trader')
    .from('graph_runs')
    .insert({
      user_id: userId,
      graph_type: 'committee_synthesis',
      subject_type: subjectType,
      subject_id: subjectId,
      status: 'running',
      node_count: 5, // 4 specialists + 1 synthesis
    })
    .select('id')
    .single();

  if (runError || !runData) {
    throw new Error(`Failed to create graph run: ${runError?.message}`);
  }

  const graphRunId = runData.id as string;

  try {
    // Compile and run the graph
    const app = buildCommitteeGraph();

    const result = await app.invoke({
      userId,
      subjectType,
      subjectId,
      contextSummary,
      graphRunId,
      markOutput: null,
      niaOutput: null,
      paulOutput: null,
      rexOutput: null,
      committeeBrief: '',
      committeeStructured: null,
      status: 'pending',
      error: null,
    });

    const totalLatencyMs = Date.now() - startTime;

    // Compute totals from specialist outputs
    const specialistOutputs = [result.markOutput, result.niaOutput, result.paulOutput, result.rexOutput]
      .filter((o): o is SpecialistOutput => o !== null);

    const totalTokens = specialistOutputs.reduce((sum, o) => sum + o.tokensUsed, 0);

    // Update graph run record
    await db.schema('trader').from('graph_runs').update({
      status: result.status ?? 'completed',
      nodes_completed: specialistOutputs.length + 1,
      total_tokens: totalTokens,
      total_latency_ms: totalLatencyMs,
      completed_at: new Date().toISOString(),
    }).eq('id', graphRunId);

    // Persist the committee artifact
    try {
      await db.schema('trader').from('agent_briefs').insert({
        user_id: userId,
        agent_name: 'Paul', // Paul hosts committee briefs in the UI
        content: result.committeeBrief,
        brief_type: 'committee_brief',
        subject_type: subjectType,
        subject_id: subjectId,
        prompt_key: `committee.synthesis@${PROMPT_VERSION}`,
        model: 'claude-sonnet-4-20250514',
        structured_output: result.committeeStructured ? {
          ...result.committeeStructured,
          graph_run_id: graphRunId,
          status: result.status,
          total_latency_ms: totalLatencyMs,
        } : { status: result.status, graph_run_id: graphRunId },
        source_run_id: graphRunId,
        tokens_used: totalTokens,
        created_at: new Date().toISOString(),
      });
    } catch { /* non-critical */ }

    return {
      graphRunId,
      committeeBrief: result.committeeBrief,
      committeeStructured: result.committeeStructured,
      specialists: specialistOutputs.map(o => ({
        agent: o.agent,
        content: o.content,
        stance: o.structured?.stance ?? null,
        confidence: o.structured?.confidence ?? null,
        status: o.status,
      })),
      status: result.status ?? 'completed',
      totalTokens,
      totalLatencyMs,
    };
  } catch (err) {
    // Update graph run as failed
    await db.schema('trader').from('graph_runs').update({
      status: 'failed',
      error_message: err instanceof Error ? err.message : 'Unknown',
      completed_at: new Date().toISOString(),
    }).eq('id', graphRunId);

    throw err;
  }
}

// ─── Context Builder ───

/**
 * Build the deterministic context summary for the committee graph.
 * This reads from existing structured data — the graph doesn't query data itself.
 */
export { buildCommitteeContext } from '@/server/graphs/context';

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
