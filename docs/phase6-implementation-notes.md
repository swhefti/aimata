# Phase 6 Implementation Notes

## Summary

Added the first real agent layer. Agents are now backed by structured
contracts, persisted outputs, and inspectable reasoning — not decorative
chat skins. They explain the deterministic canon; they don't replace it.

## A. Agent Contracts (`src/server/agents/contracts.ts`)

Each agent has a defined spec:

| Agent | Role | Data Scope | Prompt Key |
|---|---|---|---|
| Mark | Opportunity scout | Scores, quotes, technicals | `mark.ticker_commentary`, `mark.market_brief` |
| Nia | Narrative/sentiment | Catalyst, sentiment, fundamentals | `nia.ticker_commentary` |
| Paul | Basket/risk watcher | Positions, analytics, concentration | `paul.basket_brief` |
| Rex | Tactical execution | Actions, P&L, risk, urgency | `rex.action_explanation` |

Structured output contract (every agent produces):
```typescript
{
  stance: 'bullish' | 'neutral' | 'bearish' | 'cautious' | 'urgent',
  confidence: 0.0-1.0,
  topDrivers: string[],
  risks: string[],
  summary: string
}
```

Bounded context packages prevent agents from reading everything:
- `TickerContext` — for Mark/Nia (scores, fundamentals, price)
- `BasketContext` — for Paul (positions, analytics, weights)
- `ActionContext` — for Rex (action, P&L, score, weight)
- `MarketContext` — for Mark market briefs (universe stats, top picks)

## B. Agent Service (`src/server/agents/service.ts`)

Core `callAgent()` function:
1. Builds system prompt from agent spec
2. Calls Claude with structured output instruction
3. Parses JSON response into `AgentStructuredOutput`
4. Persists artifact to `trader.agent_briefs` (with provenance)
5. Logs raw call to `trader.raw_llm_outputs` (audit trail)
6. Falls back gracefully if LLM unavailable

Specialist functions:
- `markTickerCommentary(ctx)` — Mark explains a ticker
- `niaTickerCommentary(ctx)` — Nia explains sentiment/catalysts
- `paulBasketBrief(ctx)` — Paul reviews a basket
- `rexActionExplanation(ctx)` — Rex explains an action
- `markMarketBrief(ctx)` — Mark's market overview
- `askAgent(agent, question, context)` — minimal interaction entry point

Artifact retrieval:
- `getLatestArtifact(agent, type, id)` — get cached artifact
- `getArtifactsForSubject(type, id)` — get all artifacts for a subject

## C. Storage Model

Every agent call persists to `trader.agent_briefs` with:
- `agent_name` — which agent
- `subject_type` — market / ticker / basket / recommendation
- `subject_id` — ticker symbol, basket id, or null
- `content` — narrative text (summary from structured output)
- `structured_output` — JSONB with stance, confidence, drivers, risks
- `prompt_key` — which prompt template was used
- `model` — which LLM model
- `source_run_id` — links to scanner/recommendation run
- `tokens_used` — cost tracking

Every agent call also logs to `trader.raw_llm_outputs`:
- `prompt_key` — prompt identifier
- `input_data` — truncated system + user prompts
- `output_text` — raw response
- `model`, `tokens_used`, `duration_ms`

## D. API Endpoints

### POST /api/agents/ask
Minimal interaction entry point. User asks a specific agent a question.
```json
{ "agent": "Mark", "question": "Why is XRP hot?", "subjectType": "ticker", "subjectId": "XRP" }
```
Returns persisted artifact with structured output.

### POST /api/agents/explain
Generate agent explanation for a subject.
```json
{ "type": "ticker", "ticker": "AVAX", "agent": "Mark" }
{ "type": "basket" }
{ "type": "action", "ticker": "PLTR" }
```
Builds context from existing structured data, calls the right agent,
returns artifact + context.

## E. UI Surfaces

### ExplainDrawer (`components/agents/ExplainDrawer.tsx`)
Inline explanation panel that:
- Shows a "Why?" trigger button with agent avatar
- Calls `/api/agents/explain` on click
- Renders structured output: stance badge, confidence, drivers, risks
- Shows deterministic system data separately from agent narrative
- Displays provenance footer (model, tokens, timestamp)

Integrated in:
- **Basket positions**: "Ask Rex why" button in expanded action row,
  with system data (score, P&L, risk, action) shown alongside
- **Basket narrative**: "Ask Paul for deeper review" with system data
  (quality, probability, concentration)

### AskAgent (`components/agents/AskAgent.tsx`)
Contextual question input for a specific agent. Single question → single
grounded response. Not a full chat system.

## F. Three-Layer Separation in UI

Users can now distinguish:
1. **System data** — scores, P&L, analytics (shown in "System Data" box)
2. **Deterministic actions** — Rex's signals from `computePositionActions()`
3. **Agent narrative** — Claude-generated explanation with stance/confidence

The ExplainDrawer renders all three in separate visual regions within
the same panel.

## G. Schema Changes

Migration `003_agent_artifacts.sql`:
- `trader.agent_briefs` expanded with: `subject_type`, `subject_id`,
  `prompt_key`, `model`, `structured_output` (JSONB), `source_run_id`,
  `tokens_used`
- New index: `idx_agent_briefs_subject`

## What remains for Phase 7+

1. **LangGraph orchestration** — Replace direct Claude calls with graph-based workflows
2. **Committee mode** — Multi-agent parallel graph for daily briefs and ticker reviews
3. **Agent chat** — Persistent threaded conversations with tool access
4. **`agent` schema** — Dedicated schema for threads, messages, graph runs
5. **Streaming** — Stream agent responses to UI
6. **Prompt versioning** — Track prompt changes and their effect on outputs
7. **Outcome tracking** — Did the agent's assessment play out?
8. **Cost optimization** — Cache frequently-asked questions, batch similar calls
