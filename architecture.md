# aiMATA Architecture

## Status

Target architecture for the aiMATA product.

This document is intended to work together with `vision.md`.

- `vision.md` defines the product vision, user outcome, tone, and experience.
- `architecture.md` defines the implementation architecture, data ownership, runtime responsibilities, agent behavior, and build strategy.

A coding agent should be able to use these two files to:
- build the product from scratch
- continue an existing codebase
- refactor toward the target architecture
- add features without breaking ownership boundaries

This document is standalone. It should not assume knowledge of any other repo or project.

---

## 1. Product Definition

aiMATA is a short-term trading intelligence platform for active retail traders.

Its purpose is to help users:
- find strong short-term opportunities
- build and manage baskets with more discipline
- understand why an opportunity or action is suggested
- interact with specialist market agents in a useful and entertaining way
- learn from transparent reasoning rather than opaque scores alone

aiMATA is not:
- a broker
- an execution venue
- a tax tool
- a passive long-term robo-advisor
- a generic finance chatbot
- a system that fabricates recommendations with no analytical basis

aiMATA is:
- a product with strong UX and agent identity
- a centralized market intelligence platform
- a recommendation and basket-discipline system
- an explainable multi-agent surface over a deterministic analytical core
- a system that should scale to many users at low marginal cost

---

## 2. Primary Design Principles

### 2.1 Deterministic core, agentic surface

The product should use deterministic code and structured analytics for:
- market data processing
- technical indicators
- score calculation
- basket and portfolio math
- recommendation generation
- risk metrics
- backtesting and calibration

The product should use LLMs and LangGraph for:
- explanation
- synthesis
- committee-style discussion
- daily briefs
- user chat
- follow-up Q&A
- translating structured outputs into natural language

Agents should explain, compare, challenge, and summarize. They should not replace core scoring math.

### 2.2 Shared market intelligence, low marginal cost

Market-wide analysis should be computed once and reused across all users.

Examples of shared platform intelligence:
- price history
- quotes
- fundamentals
- news and macro events
- technical scores
- sentiment scores
- fundamental scores
- market regime scores
- ticker-level conclusions

Per-user cost should come mainly from:
- basket or portfolio analysis
- user-specific recommendation generation
- on-demand agent chat
- personalized briefs

### 2.3 Single writer per table

Every mutable table must have one clear owner.

If multiple services need the same data:
- one service writes it
- the others read it

Do not allow two separate parts of the system to write to the same conceptual entity with different logic.

### 2.4 Read models are not source of truth

Fast product-facing tables may exist for UX, but they must be projections of canonical data.

Examples:
- dashboard opportunity feeds
- pre-computed basket snapshots
- cached agent briefs

They may be rebuilt at any time.

### 2.5 Real agents, not decorative chat skins

Mark, Nia, Paul, and Rex must be real product interfaces backed by:
- structured data
- deterministic analytics
- stored outputs
- agent workflows
- clear tool access

They should have distinct responsibilities, voice, and data scope.

### 2.6 Build for scale and traceability

The system must support:
- many concurrent users
- repeatable scoring
- historical audit trails
- reproducible recommendations
- inspectable agent outputs
- failure recovery for background jobs

---

## 3. High-Level System Overview

```text
                  +-------------------------+
                  | External Data Providers |
                  | prices/news/fundas/LLMs |
                  +------------+------------+
                               |
                               v
                     +----------------------+
                     | Pipeline + Scoring    |
                     | scheduled workers     |
                     +----------+-----------+
                                |
                                v
                     +----------------------+
                     | Shared Intelligence   |
                     | canonical DB layer    |
                     +----------+-----------+
                                |
                +---------------+----------------+
                |                                |
                v                                v
     +----------------------+        +-------------------------+
     | Advisor Engine       |        | LangGraph Agent Service |
     | recommendations/risk |        | chat/synthesis/briefs   |
     +----------+-----------+        +-----------+-------------+
                |                                |
                +---------------+----------------+
                                |
                                v
                     +----------------------+
                     | aiMATA Web App       |
                     | Next.js UI + API     |
                     +----------------------+
```

### Runtime components

1. **Web app**
   - Next.js application
   - authenticated user-facing UI
   - dashboard, scanner, ticker detail, basket, recommendation, chat

2. **Pipeline worker**
   - scheduled ingestion and scoring jobs
   - writes shared intelligence tables

3. **Advisor engine**
   - user-specific basket and recommendation logic
   - writes recommendation state and analytics

4. **LangGraph service**
   - powers specialist agents and committee workflows
   - reads canonical data and writes explanation artifacts and conversation state

5. **Supabase**
   - Postgres
   - Auth
   - optional Storage
   - RLS policies
   - realtime if useful

6. **External providers**
   - market data APIs
   - fundamentals provider
   - news provider
   - optional social/sentiment provider
   - LLM providers

---

## 4. Recommended Technology Stack

### 4.1 Core stack

- Frontend and app server: Next.js 14+ App Router
- Language: TypeScript
- Validation: Zod
- Database: Supabase Postgres
- Auth: Supabase Auth
- DB access: typed query layer using Supabase client plus SQL where needed
- Background workers: TypeScript worker processes
- Agent orchestration: LangGraph JS
- Durable job orchestration: Inngest or equivalent is recommended; cron is acceptable for MVP
- Caching: Redis optional for hot feeds and response caching

### 4.2 Why LangGraph JS

The app should remain one primary TypeScript system.

LangGraph JS is a good fit because it supports:
- stateful graphs
- long-running workflows
- checkpointed conversations
- structured tool usage
- multi-agent orchestration
- persistence and resumability

Do not introduce a second language/runtime unless there is a compelling reason.

### 4.3 Development tools

Coding agents may be used heavily for implementation. They are development tools, not runtime architecture.

---

## 5. Logical Architecture Layers

### 5.1 Layer A — Shared Market Intelligence

This is the canonical market-wide layer.

It contains:
- asset universe
- historical prices
- quote snapshots
- fundamentals
- news and macro events
- specialist scores
- ticker-level conclusions

This layer is written by pipeline jobs only.

### 5.2 Layer B — Advisor Engine

This is the user-specific decision-support layer.

It contains:
- user profile and preferences
- portfolios and positions
- basket and portfolio analytics
- recommendation runs and recommendation items
- user decisions
- outcomes and calibration data

This layer is written by the advisor engine only.

### 5.3 Layer C — Trader UX / Read Models

This is the fast product-facing layer for aiMATA.

It contains:
- baskets
n- basket positions
- dashboard opportunity feed
- opportunity runs
- brief caches
- action cards
- user events
- optional cached read models for speed

This layer is owned by the app and read-model refresh jobs.

It must not become a second analytics engine.

### 5.4 Layer D — Agent Layer

This is the LangGraph layer.

It contains:
- threads
- messages
- graph runs
- node outputs
- committee sessions
- tool calls
- stream events
- generated artifacts such as daily briefs or debate transcripts

This layer reads canonical data from shared intelligence and advisor state, then produces explanation artifacts and interactive conversations.

---

## 6. Target Database Architecture

Use four schemas.

### 6.1 `public` — shared intelligence

Purpose: canonical market-wide data reused across all users.

Typical tables:
- `assets`
- `price_history`
- `market_quotes`
- `news_data`
- `fundamental_data`
- `macro_events`
- `agent_scores`
- `ticker_conclusions`

Optional additional shared tables:
- provider ingestion status
- global scoring config if truly shared
- universe definitions

Rules:
- public read where appropriate
- written only by pipeline/scoring services
- no user-specific state here

### 6.2 `advisor` — recommendation and portfolio engine

Purpose: user-specific, decision-support state.

Typical tables:
- `user_profiles`
- `portfolios`
- `portfolio_positions`
- `portfolio_valuations`
- `portfolio_risk_metrics`
- `portfolio_risk_reports`
- `recommendation_runs`
- `recommendation_items`
- `user_decisions`
- `synthesis_inputs`
- `synthesis_runs`
- `synthesis_raw_outputs`
- `recommendation_outcomes`
- `score_outcomes`
- `score_calibration`
- `optimizer_backtest_runs`
- `pipeline_logs`
- `system_config`

Rules:
- owner-only RLS for user-specific tables
- written by advisor engine only
- no UI-specific caches here

### 6.3 `trader` — aiMATA product state and read models

Purpose: app-facing product objects and fast UX projections.

Typical tables:
- `baskets`
- `basket_positions`
- `opportunity_runs`
- `opportunity_scores`
- `opportunity_feed`
- `basket_risk_snapshots`
- `agent_briefs`
- `position_actions`
- `raw_llm_outputs`
- `user_events`

Rules:
- written by app or read-model refresh jobs
- can be rebuilt from canonical sources
- optimized for UX, not canonical truth

### 6.4 `agent` — LangGraph persistence

Purpose: real agent state, graph runs, and artifacts.

Typical tables:
- `threads`
- `messages`
- `graph_runs`
- `node_runs`
- `committee_sessions`
- `committee_votes`
- `artifacts`
- `tool_calls`
- `stream_events`

Rules:
- written only by the agent service
- references users, tickers, baskets, and recommendation runs as needed
- preserves traceability of what each agent said and why

---

## 7. Canonical Data Rules

### 7.1 `public.agent_scores` is the specialist source of truth

This is the key shared analytical table.

Each row represents one specialist assessment for one ticker on one date.

Required conceptual fields:
- `ticker`
- `date`
- `agent_type`
- `score` in canonical range `[-1.0, +1.0]`
- `confidence` in `[0.0, 1.0]`
- `component_scores` JSON
- `explanation`
- `data_freshness`
- `agent_version`

Representative `agent_type` values:
- `technical`
- `sentiment`
- `fundamental`
- `market_regime`

The visible personas in the product can map to these specialist outputs.

### 7.2 Dashboard opportunity tables are projections

`trader.opportunity_scores` and `trader.opportunity_feed` should be generated from:
- shared market intelligence
- latest `agent_scores`
- recommendation engine outputs
- optional ranking functions

They must not become a separate scoring universe with disconnected logic.

### 7.3 Recommendation history belongs to `advisor`

Anything with lasting recommendation semantics belongs in `advisor`.

Examples:
- recommendation runs
- recommendation items
- user decisions
- outcomes and later realized performance
- calibration history

### 7.4 Basket UX belongs to `trader`

Product-native interaction objects stay in `trader`.

Examples:
- temporary baskets
- basket-level snapshots
- feed cards
- brief caches

### 7.5 Agents explain canon, not redefine facts

Agents should read:
- shared market intelligence
- advisor recommendation state
- product state if relevant

Then they can:
- summarize
- debate
- compare
- explain
- answer questions
- generate action narratives

They should not write primary scores back into the canonical market tables unless that is explicitly a pipeline function.

---

## 8. Agent Model

The product has four visible specialist agents.

### 8.1 Mark — opportunity scout

Primary role:
- identifies promising short-term setups
- explains why something is interesting now

Primary data sources:
- technical scores
- market regime context
- quotes and price history
- opportunity feed and ranking data

Typical user questions:
- what is hot now?
- what is moving with real momentum?
- which setups look strongest in the next 3 to 10 days?

### 8.2 Nia — narrative and sentiment specialist

Primary role:
- explains news, mood, catalysts, and narrative momentum

Primary data sources:
- sentiment scores
- news_data
- macro_events
- ticker_conclusions

Typical user questions:
- why is sentiment improving?
- what happened today?
- which names have narrative momentum?

### 8.3 Paul — basket and risk specialist

Primary role:
- evaluates basket health, balance, concentration, and risk

Primary data sources:
- baskets and basket positions
- portfolio and risk metrics
- user profile and constraints
- recommendation runs

Typical user questions:
- is my basket too concentrated?
- what should I reduce?
- what would improve balance?

### 8.4 Rex — action and discipline specialist

Primary role:
- converts analysis into actionable suggestions
- explains add/reduce/hold/exit decisions

Primary data sources:
- recommendation_items
- recommendation_runs
- position_actions
- user decisions
- basket and portfolio state

Typical user questions:
- what should I do next?
- why are you suggesting reduce instead of buy?
- what changed since yesterday?

### 8.5 Committee mode

The four agents can participate in a structured committee discussion.

Committee mode is useful for:
- daily brief generation
- ticker review
- basket review
- compare-assets workflows
- user-invoked debate view

Committee behavior must be structured, not open-ended chaos.

Each agent should:
- receive a bounded context package
- produce structured output
- optionally challenge one other agent
- emit a final vote or stance

The orchestrator then summarizes the result.

---

## 9. LangGraph Architecture

LangGraph is the agent interaction layer, not the core scoring engine.

### 9.1 Required graph types

#### Graph A — specialist chat router

Purpose:
- route a user message to the right specialist
- answer using grounded tools and canonical data

Flow:
1. classify user intent
2. identify target specialist
3. gather context package
4. run specialist response node
5. optionally store summary artifact
6. stream answer back to UI

#### Graph B — committee synthesis

Purpose:
- ask multiple specialists in parallel for a bounded task
- produce a final structured conclusion

Flow:
1. create committee session
2. gather shared context package
3. run specialist nodes in parallel
4. optional challenge/rebuttal round
5. orchestrator summary
6. save transcript and summary artifact

#### Graph C — daily brief generation

Purpose:
- create user-facing market and basket briefs

Flow:
1. gather latest market and user context
2. run Mark/Nia/Paul/Rex nodes
3. generate concise final brief
4. write `trader.agent_briefs`

#### Graph D — action explanation

Purpose:
- explain a specific recommendation or position action

Flow:
1. load recommendation item or position action
2. load supporting technical/sentiment/risk context
3. generate explanation grounded in facts
4. save artifact

### 9.2 LangGraph tool boundary

LangGraph tools should be explicit and narrow.

Examples:
- `get_latest_agent_scores(ticker)`
- `get_price_context(ticker, lookback_days)`
- `get_news_context(ticker, limit)`
- `get_macro_context(scope)`
- `get_user_basket(user_id)`
- `get_basket_risk_snapshot(basket_id)`
- `get_recommendation_context(user_id)`
- `compare_assets(tickers)`

Do not give agents raw unrestricted SQL.

### 9.3 Agent outputs should be structured first

Each agent node should first produce structured output, for example:
- stance
- confidence
- top drivers
- risks
- summary sentence

Natural language rendering can then be applied after the structured output is available.

### 9.4 Persistence

Each graph run should persist:
- user id
- thread id
- graph id
- target entity ids such as ticker, basket, recommendation run
- input context hash
- final output
- intermediate node outputs when useful
- timestamps and versions

---

## 10. Core Data Flows

### 10.1 Market-wide ingest and scoring

This is the foundation of the platform.

1. refresh supported assets
2. ingest latest quotes
3. append price history
4. refresh fundamentals
5. ingest news and macro events
6. compute specialist scores
7. write `public.agent_scores`
8. write `public.ticker_conclusions`
9. refresh derived ranking views if needed

This flow is scheduled and market-wide.

### 10.2 Opportunity feed refresh

Purpose: build a fast scanner/dashboard feed.

1. read latest canonical scores and conclusions
2. apply ranking and filtering rules
3. write `trader.opportunity_runs`
4. write `trader.opportunity_scores`
5. select top N into `trader.opportunity_feed`

This is a projection flow only.

### 10.3 Basket analysis flow

1. read basket composition
2. join current quotes and latest scores
3. calculate basket concentration, diversification, and risk metrics
4. write `trader.basket_risk_snapshots`
5. optionally trigger recommendations

### 10.4 Recommendation generation flow

1. load user profile and active portfolio or basket
2. load latest shared intelligence and relevant specialist scores
3. compute deterministic recommendation candidates
4. write `advisor.recommendation_runs`
5. write `advisor.recommendation_items`
6. optionally create `trader.position_actions` as UX read model
7. optionally trigger LangGraph explanation flow

### 10.5 User decision flow

1. user approves, dismisses, or defers a recommendation
2. write `advisor.user_decisions`
3. update product state if needed
4. create event for future outcome tracking

### 10.6 Daily brief flow

1. fetch latest market context
2. fetch user basket and recommendation state
3. run daily brief graph
4. write `trader.agent_briefs`
5. optionally notify user

### 10.7 Agent chat flow

1. user opens a specialist or committee thread
2. router graph determines target specialist or graph
3. tools fetch bounded context
4. agent responds
5. graph state is persisted in `agent`
6. response is streamed to UI

---

## 11. API Surface

The API should be thin and explicit.

### 11.1 User and basket endpoints

Examples:
- `GET /api/me`
- `GET /api/baskets`
- `POST /api/baskets`
- `GET /api/baskets/:id`
- `POST /api/baskets/:id/positions`
- `DELETE /api/baskets/:id/positions/:positionId`
- `GET /api/baskets/:id/risk`

### 11.2 Scanner and market endpoints

Examples:
- `GET /api/opportunities`
- `GET /api/opportunities/:ticker`
- `GET /api/tickers/:ticker`
- `GET /api/tickers/:ticker/conclusion`
- `GET /api/tickers/:ticker/news`

### 11.3 Recommendation endpoints

Examples:
- `POST /api/recommendations/run`
- `GET /api/recommendations`
- `GET /api/recommendations/:id`
- `POST /api/recommendations/:id/decision`

### 11.4 Agent endpoints

Examples:
- `POST /api/agents/chat`
- `POST /api/agents/committee`
- `GET /api/agents/threads/:id`
- `GET /api/agents/briefs`
- `POST /api/agents/briefs/generate`

### 11.5 Admin/internal job endpoints

Examples:
- `POST /api/internal/pipeline/run`
- `POST /api/internal/feed/refresh`
- `POST /api/internal/recommendations/refresh`

These must be protected and not exposed publicly.

---

## 12. Frontend Information Architecture

### 12.1 Core routes

Recommended app routes:
- `/dashboard`
- `/scanner`
- `/basket`
- `/basket/[id]`
- `/ticker/[ticker]`
- `/recommendations`
- `/agents`
- `/agents/mark`
- `/agents/nia`
- `/agents/paul`
- `/agents/rex`
- `/committee`
- `/settings`

### 12.2 Dashboard

Purpose:
- show top opportunities
- show agent highlights
- show basket health
- show recommended actions

Reads mostly from:
- `trader.opportunity_feed`
- `trader.agent_briefs`
- `trader.basket_risk_snapshots`
- `advisor.recommendation_items`

### 12.3 Ticker detail

Purpose:
- explain one ticker clearly

Shows:
- price context
- specialist scores
- conclusion summary
- recent news and macro context
- agent-specific explanations
- compare or add-to-basket actions

### 12.4 Basket view

Purpose:
- manage a basket as the core product interaction

Shows:
- positions
- weights
- opportunity context
- basket risk snapshot
- what to add, trim, or drop
- agent commentary

### 12.5 Agent views

Purpose:
- make agents feel real and useful

Each agent page should show:
- latest brief
- current stance on watched names
- chat interface
- relevant evidence panels

---

## 13. Background Jobs and Scheduling

### 13.1 Required jobs

1. assets refresh
2. quotes ingest
3. price history ingest
4. fundamentals ingest
5. news ingest
6. macro event ingest
7. score computation
8. ticker conclusion generation
9. opportunity feed refresh
10. basket risk refresh
11. recommendation refresh
12. daily brief generation
13. outcome evaluation and calibration

### 13.2 Job rules

- jobs must be idempotent where possible
- jobs must log their status
- failures must not corrupt canonical tables
- projections can be rebuilt
- recommendation generation should be versioned

### 13.3 Recommended cadence

Example cadences:
- quotes: intraday
- news: frequent intraday
- fundamentals: daily or less often depending on provider
- market scores: daily plus intraday refresh for technical/sentiment if needed
- opportunity feed: after score refresh
- briefs: daily or user-triggered

---

## 14. Security and Access Control

### 14.1 Auth model

Use Supabase Auth.

Each user may have:
- a profile
- zero or one active portfolio
- one or more baskets
- recommendations
- decisions
- agent threads

### 14.2 RLS principles

Shared public intelligence:
- read-only to app users where appropriate
- write access only to service roles or backend jobs

User-specific advisor and trader tables:
- owner-only RLS
- no client-side unrestricted writes

Agent tables:
- owner-only read where threads are user-specific
- service-only write where system artifacts are generated

### 14.3 Service boundaries

Never expose privileged provider logic or service-role capabilities directly to the browser.

The browser should talk to safe app APIs.

---

## 15. Observability and Auditability

The system must preserve:
- which version of a scoring algorithm produced a score
- which inputs were used
- which recommendation run produced an item
- which user decision followed
- what each agent said in a committee or chat flow
- why a recommendation existed at that moment

Minimum logging:
- pipeline job logs
- graph run logs
- recommendation run metadata
- user action events

---

## 16. Caching and Performance

### 16.1 Cache shared reads

Good cache candidates:
- latest opportunity feed
- ticker detail summaries
- latest agent briefs
- latest conclusion text

### 16.2 Do not cache user writes aggressively

Basket edits, user decisions, and recommendations should be treated carefully.

Prefer cache invalidation after writes rather than stale optimistic assumptions.

### 16.3 Stream agent responses

Agent chat and committee flows should stream to the UI.

This improves perceived speed even when the graph has multiple nodes.

---

## 17. Failure Handling

### 17.1 Shared intelligence failures

If one provider fails:
- keep previous good data
- mark freshness as stale
- do not write partial corrupt rows

### 17.2 Agent failures

If an agent graph fails:
- preserve the thread
- log the graph error
- allow retry from latest valid state
- do not break the rest of the app

### 17.3 Projection failures

If opportunity feed or brief refresh fails:
- keep last known good version
- retry asynchronously

---

## 18. Build Order

The product should be built in this order.

### Phase 1 — shared data foundation

Implement:
- assets
- quotes
- price history
- fundamentals
- news and macro events
- specialist score pipeline
- ticker conclusions

### Phase 2 — app shell

Implement:
- auth
- dashboard
- scanner
- ticker detail
- basket CRUD
- basic risk snapshot view

### Phase 3 — advisor engine

Implement:
- user profiles
- portfolio state
- deterministic recommendation runs
- recommendation items
- user decisions

### Phase 4 — product read models

Implement:
- opportunity feed projection
- action cards
- brief caches

### Phase 5 — LangGraph agents

Implement:
- specialist chat router
- Mark/Nia/Paul/Rex graphs
- committee mode
- daily brief generation
- explanation flows

### Phase 6 — calibration and learning layer

Implement:
- recommendation outcomes
- score outcomes
- calibration reports
- backtest and evaluation loops

---

## 19. Rules for Any Coding Agent Working on This Repo

1. Treat `vision.md` and `architecture.md` as the source documents for intent and implementation.
2. Preserve the boundary between canonical shared intelligence and product read models.
3. Do not create a second independent scoring system inside the UI layer.
4. Keep deterministic analytics separate from agent explanation logic.
5. Add new tables only with a clearly declared owning service and schema.
6. Prefer explicit typed contracts and structured outputs over free-form text blobs.
7. Preserve auditability of recommendations and agent outputs.
8. Optimize for low marginal user cost.
9. Prefer grounded, tool-using agents over open-ended unguided prompting.
10. If rebuilding from scratch, follow the target architecture in this document even if the existing code diverges.

---

## 20. Final Architecture Summary

aiMATA should be implemented as:
- a Next.js product frontend
- a shared market intelligence backbone in Supabase
- an advisor engine that owns recommendation and risk logic
- a trader-facing read-model layer for fast UX
- a LangGraph-powered agent layer for explanation, debate, briefs, and chat

The most important architectural idea is:

**deterministic market intelligence and recommendation logic first, agentic explanation and interaction on top.**

That gives the product both seriousness and personality.
