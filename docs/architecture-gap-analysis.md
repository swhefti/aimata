# Architecture Gap Analysis

## Source of truth
- Product: `vision.md`
- Implementation: `architecture.md`

## Target architecture (4 layers)

| Layer | Schema | Owner | Purpose |
|---|---|---|---|
| A — Shared Market Intelligence | `public` | Pipeline workers | Canonical market-wide data: assets, prices, quotes, fundamentals, specialist scores, ticker conclusions |
| B — Advisor Engine | `advisor` | Advisor service | User-specific decision support: profiles, portfolios, recommendation runs/items, user decisions, calibration |
| C — Trader UX / Read Models | `trader` | App + refresh jobs | Fast product-facing projections: baskets, opportunity feed, brief caches, action cards, user events |
| D — Agent Layer | `agent` | LangGraph service | Agent state: threads, messages, graph runs, committee sessions, artifacts |

## What already matches the target

1. **Pure scoring/analytics functions are separated from Supabase** — `lib/scoring/engine.ts`, `lib/analytics/basket.ts`, `lib/scoring/weighting.ts`, `lib/scoring/actions.ts` are pure computation with no DB awareness. This is correct.
2. **`trader` schema exists** with the right tables for Layer C (baskets, basket_positions, opportunity_feed, opportunity_scores, opportunity_runs, basket_risk_snapshots, agent_briefs, position_actions).
3. **`public` schema is treated as read-only** — aiMATA reads assets, price_history, market_quotes, fundamental_data but never writes to them.
4. **Config system has a manifest + runtime pattern** — `lib/config/manifest.ts` defines defaults with validation, `lib/config/runtime.ts` loads/saves from `trader.system_config`.
5. **Local brief generator** (`lib/briefs/local.ts`) is deterministic and always available, consistent with "deterministic core, agentic surface."

## What is structurally wrong

### 1. No data access layer — routes call Supabase directly
Every API route creates a Supabase client and runs ad hoc queries inline. There is no repository, no service layer, no domain boundary. The same `supabase.schema('trader').from('basket_positions').select(...)` pattern is copy-pasted across 6+ route files with slightly different enrichment logic.

**Impact:** Impossible to reason about which layer owns which query. Business logic is tangled with HTTP handling and data fetching.

### 2. API route handlers mix 3-4 concerns in one function
- `/api/scanner/run`: auth + config load + data fetch (4 tables) + scoring computation + write opportunity_runs + write opportunity_scores + write opportunity_feed
- `/api/brief POST`: auth + basket fetch + analytics computation + Claude API call + write agent_briefs
- `/api/opportunity/[ticker]`: data fetch + 3 parallel Claude API calls + response assembly
- `/api/basket POST`: auth + basket create-if-needed + asset lookup + opportunity lookup + quote lookup + position upsert + reweight + persist weights

**Impact:** Routes are untestable, un-auditable, and will fragment further as features grow.

### 3. Layer B (Advisor Engine) does not exist
The target architecture calls for `advisor` schema owning recommendation runs, recommendation items, user decisions, portfolio risk metrics, calibration, and outcomes. None of this exists. The scoring engine writes directly to `trader` (Layer C) instead of flowing through a canonical advisor layer.

**Impact:** Opportunity scores in `trader` are currently the source of truth instead of a projection. This violates principle 2.4 ("read models are not source of truth").

### 4. Layer D (Agent Layer) does not exist
Agents are metadata constants (`lib/agents.ts`). There is no LangGraph, no thread persistence, no structured agent outputs, no committee sessions. Claude API calls happen inline in route handlers with no structured output contract.

**Impact:** Agent responses are ephemeral — not stored, not versioned, not traceable.

### 5. `trader.opportunity_scores` is a source of truth pretending to be a read model
The scanner writes scores directly into `trader.opportunity_scores` and `trader.opportunity_feed`. Per the target architecture, these should be projections derived from `public.agent_scores` and `public.ticker_conclusions`. Currently there is no canonical shared scoring layer — the trader schema IS the scoring layer.

**Impact:** If a second product needed the same scores, they'd have to duplicate the scoring engine. The canonical specialist scores belong in `public.agent_scores`.

## What is duplicated

1. **P&L enrichment logic** — The same "fetch quotes, compute (current - entry) * quantity" code appears in GET `/api/basket`, POST `/api/basket` (via `fetchAndReweight`), and GET `/api/basket/analytics`. Should be a single function.
2. **Position enrichment with quotes** — Same quoteMap pattern in 4+ routes.
3. **"Get or create active basket"** — Repeated in POST `/api/basket` and implicitly in other basket routes.

## What is missing

1. **Domain service modules** — No `server/domains/market.ts`, `server/domains/trader.ts`, `server/domains/advisor.ts` etc.
2. **Typed repository functions** — No `getActiveBasket(userId)`, `getEnrichedPositions(basketId)`, `getOpportunityFeed()` etc.
3. **`advisor` schema and tables** — The entire advisor engine layer.
4. **`agent` schema and tables** — The entire agent persistence layer.
5. **`public.agent_scores`** — The canonical specialist score table that the target architecture centers on.
6. **`public.ticker_conclusions`** — The canonical conclusion table.
7. **Structured agent output contracts** — Agents produce free-text strings, not structured stance/confidence/drivers objects.

## Migration direction

### Phase 1-3 scope (this refactor)
1. Create domain-oriented data access modules that route handlers call instead of raw Supabase
2. Centralize shared patterns (P&L enrichment, quote lookup, basket resolution)
3. Make route handlers thin — delegate to domain services
4. Introduce adapter interfaces where current tables don't match the target model
5. Do NOT create the `advisor` or `agent` schemas yet — mark their future location in code

### Phase 4+ (future)
1. Create `public.agent_scores` and `public.ticker_conclusions` tables
2. Create `advisor` schema with recommendation tables
3. Migrate scoring to write canonical tables, then project to trader
4. Implement LangGraph with `agent` schema
5. Wire agents to structured tool-based data access
