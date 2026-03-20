# Refactor Inventory

Maps current codebase against the target architecture (Phases 1-3 only).

## Keep

These are structurally correct and should remain as-is.

| File | Reason |
|---|---|
| `src/lib/scoring/engine.ts` | Pure scoring logic, no DB awareness. Belongs to future advisor engine but is correctly isolated. |
| `src/lib/scoring/weighting.ts` | Pure portfolio allocation logic, no DB awareness. |
| `src/lib/scoring/actions.ts` | Pure signal generation, no DB awareness. |
| `src/lib/analytics/basket.ts` | Pure analytics computation, no DB awareness. |
| `src/lib/briefs/local.ts` | Deterministic brief generation from structured data. |
| `src/lib/agents.ts` | Agent metadata constants. Correct as-is. |
| `src/lib/config/manifest.ts` | Config manifest with defaults and validation. |
| `src/lib/config/runtime.ts` | Config load/save abstraction. Already a thin service. |
| `src/lib/supabase/admin.ts` | Admin client factory. Keep but centralize usage. |
| `src/lib/supabase/server.ts` | Server client factory. Keep. |
| `src/lib/supabase/client.ts` | Browser client factory. Keep. |
| `src/types/index.ts` | Type definitions. Will extend, not replace. |
| `src/middleware.ts` | Auth middleware. Correct. |
| `src/components/**` | All UI components. No structural changes in this phase. |
| `src/app/(app)/layout.tsx` | Auth-gated layout. Correct. |
| `src/app/login/page.tsx` | Login page. Correct. |
| `src/app/auth/callback/route.ts` | Auth callback. Correct. |
| `db/migrations/001_trader_schema.sql` | Trader schema DDL. Keep as reference. |

## Refactor

These exist but have structural problems that this phase fixes.

| File | Problem | Fix |
|---|---|---|
| `src/app/api/basket/route.ts` | 3 handlers (GET/POST/DELETE) each with inline Supabase queries, P&L computation, basket resolution, auto-weighting. ~340 lines. | Extract to `server/domains/trader.ts` service functions: `getActiveBasket()`, `getEnrichedPositions()`, `addPositionToBasket()`, `removePositionFromBasket()`. Route becomes thin dispatcher. |
| `src/app/api/basket/weight/route.ts` | Inline Supabase + autoWeight call. | Route calls `trader.updatePositionWeight()`. |
| `src/app/api/basket/analytics/route.ts` | Inline data fetch + analytics computation + snapshot write. | Route calls `trader.computeAndSnapshotAnalytics()`. |
| `src/app/api/scanner/run/route.ts` | Inline config load + 4 data fetches + scoring + 3 writes. | Route calls `advisor.runScanner()` (or `market.runScanner()` as adapter). |
| `src/app/api/opportunities/route.ts` | Inline feed fetch + quote enrichment + price history enrichment. | Route calls `market.getEnrichedFeed()`. |
| `src/app/api/market/route.ts` | Inline latest-run fetch + score fetch + quote/price enrichment + feed membership check. | Route calls `market.getFullScoredUniverse()`. |
| `src/app/api/opportunity/[ticker]/route.ts` | Data fetch + 3 parallel Claude calls inline. | Route calls `market.getTickerDetail()` for data, `agents.getTickerCommentary()` for AI (adapter, Phase 4+ target). |
| `src/app/api/brief/route.ts` | GET is fine. POST has inline basket aggregation + analytics + Claude call. | POST calls `agents.generateDailyBrief()` adapter. |
| `src/app/api/config/route.ts` | Already uses runtime.ts but could be thinner. | Minor cleanup — already mostly correct. |

## Replace

These should be replaced with proper abstractions.

| Current pattern | Replacement |
|---|---|
| Every route doing `const admin = createAdminClient(); const { data } = await admin.schema('trader').from('baskets')...` | Domain service functions that encapsulate the schema/table/query details. Routes import services, not Supabase clients. |
| `fetchAndReweight()` helper inside basket route file | Move to `server/domains/trader.ts` as a proper service function. |
| Inline P&L enrichment (repeated 3+ times) | `enrichPositionsWithQuotes(positions)` in market domain. |

## Delete

| File | Reason |
|---|---|
| `src/app/api/setup/route.ts` | One-time setup endpoint that calls Supabase REST API to execute DDL. Migration was run manually. Not part of the target architecture. Can be removed or moved to a script. |
| `src/app/api/auth/route.ts` | Returns current user info. Redundant — middleware handles auth, and the Supabase client on the frontend can call `getUser()` directly. Low priority — can keep if used. |

## Postpone (Phase 4+)

| Item | Reason |
|---|---|
| `advisor` schema creation | Requires recommendation engine design. Mark as future in code. |
| `agent` schema creation | Requires LangGraph integration design. |
| `public.agent_scores` table | Requires pipeline worker design. Current scoring writes to trader as interim. |
| `public.ticker_conclusions` table | Depends on agent_scores existing. |
| LangGraph graph implementations | Phase 5 in architecture.md. |
| Committee mode | Phase 5. |
| Structured agent output contracts | Phase 5. |
| Scanner re-ranking from canonical scores | Depends on advisor engine existing. |
| Recommendation runs/items tables | Phase 3 of architecture.md build order, but needs advisor engine design first. |
| Outcome tracking and calibration | Phase 6. |

## Domain service module plan

Create `src/server/` with the following structure:

```
src/server/
  db.ts                    — centralized Supabase client creation
  domains/
    market.ts              — Layer A reads: assets, prices, quotes, fundamentals
    trader.ts              — Layer C: baskets, positions, opportunity feed, briefs, events
    advisor.ts             — Layer B adapter: scoring engine wrapper (interim, writes to trader)
    agents.ts              — Layer D adapter: AI commentary/brief generation (interim)
```

Each domain module exports typed async functions that:
1. Accept only domain-relevant parameters (userId, ticker, etc.)
2. Handle all Supabase interaction internally
3. Return typed domain objects
4. Contain no HTTP/request concerns
5. Are independently testable

Route handlers become:
```typescript
export async function GET(request: Request) {
  const user = await requireAuth(request);
  const positions = await trader.getEnrichedPositions(user.id);
  return NextResponse.json({ positions });
}
```
