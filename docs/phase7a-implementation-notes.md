# Phase 7A Implementation Notes

## Summary

First real LangGraph integration: a committee synthesis graph that runs
all 4 specialist agents in parallel, then synthesizes their perspectives
into a unified committee brief. The graph reads from existing deterministic
data and persists graph runs, node outputs, and the final artifact.

## LangGraph Integration Approach

Uses `@langchain/langgraph` StateGraph with `@langchain/anthropic` for LLM nodes.

The graph is narrow and purpose-built:
- One graph type: `committee_synthesis`
- One use case: synthesize 4 specialist perspectives into a unified brief
- One clear output: a committee brief artifact with structured stance/confidence

The graph does NOT:
- Replace deterministic scoring or recommendation logic
- Query data directly (receives pre-built context)
- Autonomously decide what to do next
- Run open-ended conversations

## Graph State + Node Design

### State (typed via LangGraph Annotation)

```
userId, subjectType, subjectId, contextSummary, graphRunId
markOutput, niaOutput, paulOutput, rexOutput     (specialist outputs)
committeeBrief, committeeStructured               (synthesis output)
status, error
```

### Nodes (5 total)

```
__start__ ──┬── mark ──┐
            ├── nia  ──┤
            ├── paul ──├── synthesize ── __end__
            └── rex  ──┘
```

- **mark**: Calls Claude with Mark's spec + boundary instruction. Produces opportunity assessment.
- **nia**: Calls Claude with Nia's spec. Produces narrative/catalyst assessment.
- **paul**: Calls Claude with Paul's spec. Produces basket health assessment.
- **rex**: Calls Claude with Rex's spec. Produces tactical action assessment.
- **synthesize**: Takes all 4 specialist outputs, calls Claude as committee synthesizer.
  Highlights agreements, tensions, and what matters most. Produces unified brief.

Specialists run **in parallel** (LangGraph fan-out from __start__).
Synthesis runs after all specialists complete (fan-in to synthesize).

### Context Input

`buildCommitteeContext()` in `src/server/graphs/context.ts` assembles deterministic data:
- Market overview (feed stats, top 5 by score)
- Basket state (positions, weights, P&L)
- Basket analytics (probability, concentration, correlation, quality)
- Recommended actions (from computePositionActions)

The graph receives this as a plain text string. Agents interpret it — they don't query data.

## Schema/Storage Changes

### New tables (migration `004_agent_graph_runs.sql`)

**`trader.graph_runs`**:
- id, user_id, graph_type, subject_type, subject_id
- status (pending/running/completed/completed_with_errors/failed)
- node_count, nodes_completed
- total_tokens, total_latency_ms
- error_message, created_at, completed_at

**`trader.node_runs`**:
- id, graph_run_id (FK)
- node_name (specialist_mark, specialist_nia, specialist_paul, specialist_rex, synthesize)
- agent_name, status
- input_summary, output_text, structured_output (JSONB)
- tokens_used, latency_ms, error_message, created_at

### Committee artifact

Persisted in `trader.agent_briefs` with:
- `brief_type = 'committee_brief'`
- `prompt_key = 'committee.synthesis@1.1'`
- `source_run_id = graph_run_id`
- `structured_output` includes `graph_run_id`, `status`, `total_latency_ms`

## UI Surface

**CommitteeBrief component** (`src/components/agents/CommitteeBrief.tsx`):
- Placed in the right column of the dashboard, above analytics
- Header: 4 overlapping agent avatars + "Committee Brief"
- Generate/Refresh button triggers `POST /api/agents/committee`
- Shows: committee stance badge, confidence %, narrative text
- Drivers/Risks in side-by-side colored cards
- Expandable specialist breakdown: each agent's assessment with stance/confidence
- Provenance footer: tokens, latency, graph run ID, status check

**Dashboard integration**: right column shows Committee Brief → Analytics Panel

## Traceability

After a committee run, you can answer:
- **Did the graph run?** → `trader.graph_runs` with status
- **Which nodes ran?** → `trader.node_runs` with per-node status
- **Which outputs were produced?** → `node_runs.output_text` + `structured_output`
- **Did any node fail?** → `node_runs.status = 'failed'` + error_message
- **What final artifact was emitted?** → `agent_briefs` with `brief_type = 'committee_brief'`
- **How long did it take?** → `graph_runs.total_latency_ms`
- **How much did it cost?** → `graph_runs.total_tokens`

## What Remains for Phase 7B

1. **Specialist routing graph** — route user questions to the right agent
2. **Ticker-level committee** — committee synthesis for a specific ticker
3. **Streaming** — stream specialist outputs to UI as they complete
4. **Agent chat** — persistent threaded conversations
5. **`agent` schema** — move graph/node tables to dedicated schema
6. **Graph checkpointing** — LangGraph persistence for resume/retry
7. **Rate limiting** — prevent excessive graph executions
