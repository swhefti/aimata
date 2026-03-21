# Phase 8 Implementation Notes

## Summary

Built a real internal Admin / Ops / Evaluation console that provides
transparency into runtime behavior, costs, agent execution, and
opportunity outcomes. Backed entirely by existing persisted data —
no mock metrics.

## Console Structure

### Tabs (at `/admin`)

| Tab | Purpose | Data Source |
|---|---|---|
| **Overview** | Health dashboard with key metrics | `opportunity_runs`, `graph_runs`, `raw_llm_outputs`, `node_runs`, `baskets`, `opportunity_feed` |
| **Runs** | Graph execution explorer with node drill-down | `graph_runs` + `node_runs` per run |
| **Agents** | Per-agent token/latency/cost metrics | Aggregated from `node_runs` |
| **Evaluation** | Opportunity outcome tracking (score → return) | `opportunity_feed` + `market_quotes` + `price_history` |
| **Config** | Live config editing (existing ConfigEditor) | `trader.system_config` |
| **LLM Log** | Raw LLM call audit trail | `raw_llm_outputs` |

### Routes Added

| Route | Purpose |
|---|---|
| `GET /api/admin/overview` | Aggregated ops metrics |
| `GET /api/admin/runs` | Graph run list (paginated) |
| `GET /api/admin/runs/[id]` | Node runs for a specific graph run |
| `GET /api/admin/agents` | Per-agent metrics |
| `GET /api/admin/evaluation` | Opportunity outcome data |
| `GET /api/admin/llm-log` | Raw LLM output audit log |

## Section Details

### 8A — Admin (Config tab)
- Preserved existing ConfigEditor with manifest-driven validation
- Prompts, model settings, scoring weights, basket constraints all editable
- Config keys display with group, label, type, and validation rules
- Save validation enforced

### 8B — Ops (Overview + Runs + Agents + LLM Log tabs)

**Overview** shows 6 metric cards:
- Scanner Runs: total, today, last run timestamp
- Graph Runs: total, today, failed count, average latency
- Agent Calls: total, today, total tokens, estimated cost ($)
- Active Users: basket count
- Feed Size: current opportunity feed count
- Errors: total failed nodes, failed today

**Runs Explorer**:
- Filterable table of graph runs (committee_synthesis, specialist_routing)
- Expandable: click any run to see node-level breakdown
- Per node: name, agent, status badge, output preview, tokens, latency, error
- Status badges: green (completed), red (failed), yellow (running), gray (pending)

**Agent Metrics**:
- Per-agent breakdown: Mark (orange), Nia (purple), Paul (blue), Rex (red)
- Metrics: call count, total tokens, average latency, failure count, estimated cost
- Agent names color-coded to match brand identity

**LLM Log**:
- Audit trail of every Claude API call
- Shows: prompt key, model, tokens, duration, timestamp
- Expandable to see full input data (JSON) and output text

### 8C — Evaluation (Evaluation tab)

**Opportunity Outcome Tracking**:
- Summary cards: average return by score bucket (≥70, 50-69, <50), by label, by risk
- Color-coded returns (green positive, red negative)
- Full table: ticker, score, label, risk, setup, price at score, current price, return %
- Answers: "Did high-scoring opportunities actually perform better?"

### 8D — Storage / Data Model

No new tables needed. The console queries existing tables:
- `trader.opportunity_runs` — scanner run history
- `trader.graph_runs` — LangGraph execution records
- `trader.node_runs` — per-node execution details
- `trader.raw_llm_outputs` — LLM call audit trail
- `trader.opportunity_feed` — current scored feed
- `trader.baskets` — active user count
- `public.market_quotes` + `public.price_history` — for outcome evaluation

Cost estimation uses blended rate: ~$9 per 1M tokens.

### 8E — Security

- All admin API routes require authentication via `requireUser()`
- Admin link added to NavBar for all authenticated users
- Future: add admin role gating (e.g., check user metadata for admin flag)
- No public exposure — routes are behind the auth middleware

### 8F — UX

- Tab-based navigation with active state highlighting
- Loading skeletons per tab
- Error states with messages
- Empty states where no data exists yet
- Expandable rows for detailed inspection
- Color-coded status badges and agent names
- Responsive grid layout for metric cards

## What Remains

1. **Role-based admin access** — gate admin routes to admin-role users only
2. **Config change history** — track who changed what config and when
3. **Feedback collection** — user feedback on briefs/explanations/recommendations
4. **Prompt A/B testing** — compare prompt version performance
5. **Cost alerts** — notify when daily spend exceeds threshold
6. **Automated evaluation** — scheduled jobs to compute outcome metrics
7. **LangSmith integration** — optional external tracing alongside product-owned ops
