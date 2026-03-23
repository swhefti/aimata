# Phase 7B Implementation Notes

## Summary

LangGraph-powered specialist routing graph. Users can ask a question
from any supported context, the system routes it to the right specialist
(Mark/Nia/Paul/Rex), and the specialist answers grounded in deterministic
data. The entire interaction is persisted: thread, messages, routing
decision, graph run.

## Routing Graph Design

### Graph: `specialist_routing`

```
__start__ → route → specialist → END
```

**Route node** (fast, cheap):
- Uses Claude Haiku 3.5 (cheap, fast) to classify the question
- Receives: question + subject type + context preview (300 chars)
- Returns: `{ agent: "Mark|Nia|Paul|Rex", reason: "..." }`
- Fallback: keyword + subject-type heuristic if LLM fails

**Specialist node** (grounded, bounded):
- Uses Claude Sonnet 4 with the agent's bounded prompt + role boundary
- Receives: full context summary + user question
- Returns: structured output (stance/confidence/drivers/risks/summary)
- Persists: node_runs + agent_messages

### Routing heuristics (fallback):

| Signal | Routes to |
|---|---|
| trim/sell/exit/hold/add action keywords | Rex |
| basket/risk/concentrated/diversif keywords | Paul |
| news/catalyst/sentiment/narrative keywords | Nia |
| ticker subject type | Mark |
| basket subject type | Paul |
| recommendation subject type | Rex |
| default | Mark |

## Supported Contexts

### 1. Ticker context (`buildTickerContext`)
Assembled from: opportunity feed, market quotes, fundamentals
Contains: score breakdown, label, risk, setup, price, fundamentals

### 2. Basket context (`buildBasketContext`)
Assembled from: basket positions, P&L, position actions
Contains: positions with weights/P&L, recommended actions

### 3. Action context (`buildActionContext`)
Assembled from: specific position + its action + basket overview
Contains: position detail, system action/urgency/reason, basket context

Context is built server-side from deterministic data before the graph runs.
The graph does NOT query data directly.

## Persistence / Storage

### New tables (migration `005_agent_threads.sql`)

**`trader.agent_threads`**: One per interaction
- id, user_id, subject_type, subject_id
- routed_agent, routing_reason (set after routing)
- graph_run_id (FK to graph_runs)
- status, created_at, updated_at

**`trader.agent_messages`**: User message + agent response
- id, thread_id (FK)
- role: 'user' | 'assistant'
- agent_name (set for assistant messages)
- content, structured_output (JSONB)
- tokens_used, latency_ms, prompt_key, model

### Existing tables used
- `trader.graph_runs`: tracks overall graph execution
- `trader.node_runs`: tracks route + specialist node outputs

## UI Entry Points

### Dashboard (basket context)
- "Ask the team" button below basket narrative
- Suggestions: "Is my basket too concentrated?", "Should I trim anything?", "What looks strongest right now?"
- Routes to appropriate specialist automatically

### Opportunity detail page (ticker context)
- "Ask about {TICKER}" below agent commentary section
- Suggestions: "Why is this setup strong?", "Is this supported by fundamentals?", "Should I add this to my basket?"

### Component: AskAgent (updated)
- Shows 4 mini agent avatars when no answer yet
- Shows single routed agent avatar + name after answer
- Displays routing reason ("Routed to Rex because action question")
- Shows stance badge + confidence
- Drivers/risks in grid
- Provenance: routed agent, tokens, latency, status
- Quick suggestion buttons for common questions

## Routing Inspectability

After an ask, you can trace:
1. **Thread**: `agent_threads` — who asked, what subject, which agent was routed to, why
2. **Messages**: `agent_messages` — user question + agent response with metadata
3. **Graph run**: `graph_runs` — status, latency, tokens
4. **Node runs**: `node_runs` — route decision + specialist output
5. **UI**: routing reason shown inline, agent name + stance visible

## What Remains for Phase 8

1. **Multi-turn conversation** — allow follow-up questions in the same thread
2. **Agent chat page** — dedicated page per agent with thread history
3. **`agent` schema** — move thread/message tables to dedicated schema
4. **Streaming** — stream responses as they generate
5. **Context window management** — include prior messages in context
6. **Thread history** — show past conversations in UI
7. **Committee integration** — allow routing to committee mode for complex questions
