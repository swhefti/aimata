# Phase 4-5 Implementation Notes

## Phase 4: Scanner consumes canonical intelligence

### What changed

**1. Scanner provenance tracking**

`advisor.runScanner()` now records full provenance for every run:
- `scoring_version`: semantic version of the scoring algorithm ("1.0")
- `config_hash`: deterministic hash of scoring-relevant config values
- `data_freshness`: JSON object recording what data was available at scan time
  - `priceHistoryTo`: latest price date available
  - `quotesCount`: number of quote records used
  - `fundamentalsCount`: number of fundamental records used
  - `assetsScanned`: total assets in the universe
- `completed_at`: when the run finished

This makes every scanner run reproducible and inspectable. Given the same config hash and data freshness, the same scores will be produced.

**2. Feed is explicitly a projection**

`refreshFeedProjection()` is now a separate internal function that can be called independently of scoring. The feed (`trader.opportunity_feed`) is clearly documented and structured as a read-model projection from canonical scores — it includes `last_run_at` and `scoring_version` fields to trace its source.

**3. Scanner result type is richer**

The scanner API (`POST /api/scanner/run`) now returns:
```json
{
  "success": true,
  "run_id": "uuid",
  "total_scored": 65,
  "opportunities_surfaced": 20,
  "scoring_version": "1.0",
  "data_freshness": {
    "priceHistoryTo": "2026-03-20",
    "quotesCount": 102,
    "fundamentalsCount": 74,
    "assetsScanned": 85
  }
}
```

### Data lineage for scanner flow

```
public.assets + public.price_history + public.market_quotes + public.fundamental_data
  ↓ (Layer A reads)
computeOpportunityScores() — pure deterministic computation
  ↓
trader.opportunity_runs (with provenance: config_hash, scoring_version, data_freshness)
  ↓
trader.opportunity_scores (canonical scores, one row per asset per run)
  ↓ (projection via refreshFeedProjection)
trader.opportunity_feed (top-N read model for dashboard, includes run_id + last_run_at)
```

---

## Phase 5: Basket and recommendation flows

### What changed

**1. Recommendation engine**

New function `advisor.generateRecommendations(userId)`:
- Loads basket positions with current P&L
- Computes basket analytics (risk, concentration, quality)
- Computes deterministic position actions (Rex's signals)
- Persists everything with full lineage

This is the deterministic recommendation layer — no LLM needed. The agent layer can later explain these recommendations without recomputing them.

**2. Recommendation state model**

New tables (migration `002_recommendation_and_provenance.sql`):

`trader.recommendation_runs`:
- Links to user, basket, and source scanner run
- Records basket quality and probability score at time of recommendation
- Provides a durable audit trail

`trader.recommendation_items`:
- One row per position per recommendation run
- Records: action, urgency, reason, opportunity_score, pnl_pct, position_weight, risk_label
- Links back to the recommendation run for lineage

**3. Position actions have lineage**

`trader.position_actions` now includes:
- `recommendation_run_id`: which recommendation run generated this action
- `opportunity_score`: the score at time of recommendation
- `pnl_pct`: the P&L at time of recommendation
- `urgency`: low/medium/high

**4. Analytics snapshots have lineage**

`trader.basket_risk_snapshots.snapshot` JSONB now includes:
- `recommendation_run_id`: links to the recommendation run
- `source_run_id`: links to the scanner run that produced the scores

**5. New API endpoint**

`GET/POST /api/recommendations`:
- Generates recommendations for the authenticated user
- Returns: runId, basketQuality, probabilityScore, actions array, counts
- Fully deterministic — same basket state + same scores = same recommendations

### Data lineage for basket/recommendation flow

```
trader.basket_positions (user's holdings)
  + public.market_quotes (current prices → P&L computation)
  + public.price_history (for basket analytics)
  ↓
computeBasketAnalytics() — risk, concentration, correlation, quality
  ↓
computePositionActions() — Rex's deterministic signals
  ↓
trader.recommendation_runs (durable run record with lineage to scanner run)
  ↓
trader.recommendation_items (per-position action items with full context)
  ↓
trader.position_actions (UI-facing action cards, linked to recommendation run)
  ↓
trader.basket_risk_snapshots (analytics snapshot with lineage references)
```

### Three-layer separation

The architecture now cleanly separates:

1. **Signal layer** (scores): `computeOpportunityScores()` → `trader.opportunity_scores`
2. **Recommendation/action layer**: `computePositionActions()` + `computeBasketAnalytics()` → `trader.recommendation_runs/items` + `trader.position_actions`
3. **Explanation layer** (narrative): `generateLocalBrief()` + Claude API → `trader.agent_briefs`

The UI can consume each layer independently. An agent layer can later explain recommendations by reading the persisted recommendation items rather than recomputing them.

---

## What remains for Phase 6+

1. **`advisor` Postgres schema**: Move recommendation tables to their own schema for clean ownership
2. **`public.agent_scores`**: Canonical specialist scores table in the shared layer
3. **`public.ticker_conclusions`**: Canonical conclusion table
4. **LangGraph agent graphs**: Replace direct Claude calls with structured graph workflows
5. **`agent` Postgres schema**: Thread/message/graph persistence
6. **Committee mode**: Multi-agent parallel graph
7. **Outcome tracking**: Track recommendation outcomes for calibration
8. **User decisions**: Persist approve/dismiss/defer actions
9. **Calibration reports**: Score accuracy and recommendation quality metrics

---

## Schema changes in this phase

New tables:
- `trader.recommendation_runs` (user_id, basket_id, source_run_id, total_positions, total_actions, basket_quality, probability_score)
- `trader.recommendation_items` (run_id, basket_id, ticker, action, urgency, reason, opportunity_score, pnl_pct, position_weight, risk_label)

Expanded columns:
- `trader.opportunity_runs`: + config_hash, scoring_version, data_freshness (JSONB), completed_at
- `trader.opportunity_scores`: + scoring_version
- `trader.opportunity_feed`: + last_run_at, scoring_version
- `trader.position_actions`: + recommendation_run_id, opportunity_score, pnl_pct, urgency
