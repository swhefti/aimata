# Create aiMATA From Scratch

## Read This First

You are in a **new, empty project folder** for a brand-new product called **aiMATA**.

You should assume:

- there is **no existing MAIPA codebase** available in this folder
- you are building a **fresh standalone app** from scratch
- there is an **existing Supabase project** that already contains market data used by another product called MAIPA
- you may **reuse that Supabase project as a data source**
- you must **not interfere** with the original MAIPA product

Your job is to **create the entire aiMATA app in this folder**:

- app code
- file/folder structure
- DB migrations for aiMATA-owned tables
- prompts
- UI
- analytics
- admin/config
- verification

Do not stop at scaffolding. Build a working MVP end-to-end.

---

## Product Name

**aiMATA**

Meaning:

**Multi-Agent Trading Advisor**

This is a working title. Use it throughout the app unless a nicer display treatment naturally emerges.

---

## Product Goal

aiMATA is a **short-term opportunity and basket intelligence platform**.

It is for users who:

- already trade or have traded before
- are financially literate
- want an edge without reading everything deeply
- are closer to Robinhood/Coinbase users than traditional wealth clients

It is **not** a long-term portfolio advisor.

It is **not** a retirement planner.

It is **not** a bank-style product.

It is a fast, opinionated, fun trading workspace focused on:

1. finding promising short-term opportunities
2. letting users drag those into an active basket
3. instantly showing what that basket means
4. making risk and upside transparent

---

## Core Promise

The app should deliver:

- **short-term capital growth focus**
- **risk transparency**
- **speed**
- **fun / wow-effect through simplicity**

It should feel like:

- serious enough to trust
- playful enough to love

---

## Time Horizon

The MVP uses a **fixed 3-month portfolio horizon**.

This is not configurable in v1.

Inside that fixed 3-month context, opportunities should be labeled as:

- `Hot Now` = roughly 1-5 trading days
- `Swing` = roughly 1-4 weeks
- `Run` = roughly 1-3 months

These labels must appear in the UI and be grounded in signal logic.

---

## Universe

Use **all non-ETF assets** from the shared market universe.

For MVP this is expected to be roughly:

- ~60 stocks
- ~20 crypto

Ignore ETFs entirely.

If the source `assets` table contains ETFs, exclude them.

---

## Critical Architecture Constraint

The original MAIPA product must remain untouched.

### Therefore:

- you may **read** shared raw source data from the existing Supabase project
- you must **write only to a new schema**

## New schema name

`trader`

Everything aiMATA owns must live in `trader.*`.

Do not use MAIPA-specific product tables for aiMATA state.

Do not mutate MAIPA behavior.

Do not rely on MAIPA code.

---

## Existing External System

There is an existing Supabase project that already contains the raw/shared data.

### Existing Supabase project URL

`https://xrsyshxvrikfhwdsreqv.supabase.co`

### Important handling rule for credentials

Do **not** hardcode secrets into source files.

Create:

- `.env.example`
- `.env.local`

and wire the app to use these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The user has already supplied the real values out-of-band for this project. Use them to configure the local environment when building, but **do not print them into app source code** and **do not commit them into tracked files**.

If this workspace does not already contain `.env.local`, create it.

---

## Shared Source Tables You May Read

Assume these live in the shared Supabase `public` schema and are read-only inputs:

- `public.assets`
- `public.price_history`
- `public.market_quotes`
- `public.market_news`
- `public.fundamental_data` if available

You may inspect the live schema if needed using the service role key, but do not write aiMATA product state into `public`.

If some raw table names differ slightly, inspect and adapt pragmatically.

---

## Build Philosophy

Do **not** build “MAIPA but shorter-term.”

Build a **new product loop**:

1. scan
2. pick
3. drag into basket
4. see instant analytics
5. adjust
6. read daily brief

The app should feel:

- immediate
- visual
- kinetic
- editorial
- simple

Avoid:

- long onboarding
- heavy user profiling
- corporate fintech blandness
- too many toggles
- too much hidden AI magic

---

## Audience

Target users are:

- active short-term traders
- swing traders
- younger, mobile-native users
- finance-literate users who want speed and clarity

Not:

- bank/private-wealth clients
- passive ETF investors
- users who want academic research reports

---

## Product Positioning

Possible framing:

- “Trade the move. See the risk. Build the basket.”
- “Short-term opportunities, instant basket intelligence.”

Do not overpromise.

Do not market guaranteed profits.

Be transparent that this is a short-term intelligence tool, not certainty.

---

## Agent System

The MVP uses **4 branded agents**.

They should be visible in the UI as distinct personalities with distinct roles.

### 1. Mark

- role: market scanner
- job: identify short-term opportunities
- tone: sharp, energetic, fast
- domain: momentum, breakout, ranking

### 2. Paul

- role: basket watcher
- job: monitor the user’s basket and portfolio balance
- tone: calm, skeptical, protective
- domain: concentration, correlation, balance, daily brief

### 3. Nia

- role: news and sentiment radar
- job: explain whether the move has narrative support
- tone: intuitive, socially aware, quick
- domain: catalysts, sentiment acceleration, news relevance

### 4. Rex

- role: tactical execution and discipline
- job: explain watch / trim / remove / hold logic
- tone: blunt, tactical, disciplined
- domain: overbought/oversold, risk control, trade management

### MVP AI scope

Use the agents primarily for:

- explanations
- daily briefing
- opportunity commentary
- basket commentary

Do **not** build full multi-agent chat or debate as a core v1 feature.

The product may hint at that future, but MVP should stay lean.

---

## Visual Direction

Brand direction:

- semi-bright
- playful
- kinetic
- retro-futuristic
- not dark
- grayscale base
- orange accent

Reference direction:

- loosely inspired by ChainGPT’s energy and polish
- but do **not** copy it

Avoid:

- default purple AI look
- generic SaaS white dashboards
- generic dark-mode fintech clones

Use:

- expressive typography
- bold cards/panels
- motion with purpose
- memorable agent treatment

The interface should feel potentially viral because it is:

- simple
- sharp
- visually distinctive

---

## Main MVP Screens

Build these routes and make them feel finished:

1. `/login`
2. `/dashboard`
3. `/opportunity/[ticker]`
4. `/basket` if needed as a dedicated route
5. `/settings`
6. `/admin`

It is acceptable if `/dashboard` contains the basket and is the main product home.

---

## Login

Use the **same Supabase auth style** as the existing MAIPA ecosystem.

Use standard Supabase auth patterns with the env vars above.

Keep the UX clean and branded.

No long onboarding in MVP.

---

## Main Dashboard

This is the most important screen.

It should combine:

1. Mark’s scanner feed
2. the active basket
3. instant basket analytics
4. Paul’s daily brief

### Scanner feed

Show only **curated opportunities**, not the full universe.

Target feed size:

- around **10 to 20 positions**

Each opportunity card should show:

- ticker
- asset name
- asset type
- opportunity score
- `Hot Now` / `Swing` / `Run`
- risk label
- setup type
- one-line explanation
- agent tag / owner

### Basket interaction

User can:

- drag a card into the basket
- remove it again
- optionally adjust weight manually

### Analytics behavior

Whenever basket contents change, recalculate immediately:

- basket probability over 3 months
- expected upside range
- downside risk
- concentration risk
- correlation/crowding risk
- crypto allocation
- largest position
- suggested watch / exit signals

The recalculation should feel immediate and product-defining.

---

## Opportunity Detail Page

Each opportunity detail page should explain:

- why it surfaced
- what the setup is
- whether it is overbought or oversold
- what recent news/catalysts matter
- what horizon it fits
- what risk makes it fragile
- what Mark/Nia/Rex think

Suggested modules:

- price snapshot
- setup summary
- signal breakdown
- catalyst summary
- risk notes
- hold-horizon suggestion
- add-to-basket CTA

---

## Basket View / Basket Panel

The user’s active basket should support both:

- **target allocation logic**
- **pseudo-portfolio tracking**

That means each position may track:

- ticker
- target weight
- manual override weight if any
- entry price
- quantity
- current price
- P&L

### Auto-weighting

When assets are added, assign weights automatically using a simple, coherent weighting engine.

Then let the user override weights manually.

### Weighting behavior

The default weighting engine should consider:

- opportunity score
- risk
- setup horizon
- concentration
- crypto cap

Keep it simple and defensible.

---

## Core Outputs Required

When the user adds/removes/edits positions, show:

1. **3-month probability score**
2. **expected upside range**
3. **downside risk**
4. **concentration risk**
5. **correlation/crowding risk**
6. **crypto allocation**
7. **largest position**
8. **basket quality summary**
9. **suggested watch/exit notes**

Be transparent that probability is model-based, not certainty.

---

## Opportunity Engine

aiMATA must derive **its own short-term opportunity scores** from the shared raw data.

Do not reuse MAIPA’s long-term logic as the core engine.

### Inputs

Use the shared raw tables as inputs:

- price history
- latest quotes
- market news
- fundamentals if useful

### The scoring engine must explicitly consider

- short-term momentum
- breakout / continuation strength
- overbought / oversold conditions
- recent catalyst/news quality
- sentiment acceleration
- volatility/risk
- regime fit

### Suggested scoring components

Implement an opportunity model with explicit component scores such as:

1. `momentum_score`
2. `breakout_score`
3. `mean_reversion_score`
4. `catalyst_score`
5. `sentiment_acceleration_score`
6. `volatility_adjusted_score`
7. `regime_fit_score`
8. `liquidity_score` if the data supports it

### Derived labels

For each opportunity, also derive:

- `opportunity_label`: `Hot Now` | `Swing` | `Run`
- `risk_label`: `Low` | `Medium` | `High`
- `setup_type`: e.g. `breakout`, `momentum`, `rebound`, `catalyst`, `trend`

### Important

The scoring must be:

- coherent
- explainable
- transparent in the UI

This is not an academic quant platform. Build a practical v1 engine.

---

## How opportunity priorities should differ by horizon

### Hot Now

Prioritize:

- momentum
- breakout quality
- short-term continuation
- fresh catalyst relevance

### Swing

Prioritize:

- sentiment acceleration
- catalyst persistence
- recovery / continuation setups
- volatility-adjusted upside

### Run

Prioritize:

- sustained trend quality
- multi-week narrative support
- regime fit
- less fragile momentum

These differences should be visible in explanations.

---

## Basket Risk Model

This is not a classic long-term optimizer.

It is an **active basket risk and opportunity engine**.

### Compute basket metrics such as

- position concentration
- average pairwise correlation / crowding proxy
- crypto concentration
- setup diversity
- horizon mix
- downside fragility

### Use this to produce

- basket score
- probability score
- risk labels
- warnings
- suggested basket actions

Keep the math practical and transparent.

---

## Probability Model

Show a **3-month basket probability estimate**.

Frame it as something like:

**Probability this basket is well-positioned for the next 3 months**

or

**Probability of a favorable 3-month basket outcome**

### Probability inputs

Use:

- opportunity quality of held assets
- diversification/correlation quality
- concentration risk
- volatility/risk
- catalyst support
- regime fit

Always pair the probability with:

- downside risk
- a short explanation
- warnings when basket quality is weak

---

## Daily Brief

The dashboard should include a concise daily brief mainly voiced by **Paul**.

It should summarize:

- what changed in the basket
- what strengthened
- what weakened
- where concentration has become dangerous
- what deserves attention
- whether the basket quality improved or deteriorated

Keep it short, useful, and stylistically distinct.

---

## AI Use

Use LLMs for:

- daily briefs
- opportunity explanations
- basket commentary
- tactical notes

Do **not** use LLMs for:

- raw score generation
- raw probability computation
- core basket math

Those should be system-computed.

LLMs should interpret structured evidence, not invent unsupported outputs.

---

## Database Schema

Create the schema:

`trader`

### Create aiMATA-owned tables there

At minimum:

1. `trader.user_profiles`
2. `trader.baskets`
3. `trader.basket_positions`
4. `trader.opportunity_runs`
5. `trader.opportunity_scores`
6. `trader.opportunity_feed`
7. `trader.basket_risk_snapshots`
8. `trader.agent_briefs`
9. `trader.position_actions`
10. `trader.system_config`
11. `trader.raw_llm_outputs`
12. `trader.user_events`

### Table purpose

#### `trader.user_profiles`
aiMATA-specific user profile/settings

#### `trader.baskets`
one active basket per user

#### `trader.basket_positions`
positions currently in the basket

#### `trader.opportunity_runs`
metadata for each scanner run

#### `trader.opportunity_scores`
per-ticker scored snapshot by date

#### `trader.opportunity_feed`
current surfaced opportunities for the dashboard

#### `trader.basket_risk_snapshots`
stored analytics over time

#### `trader.agent_briefs`
daily brief / explanation records

#### `trader.position_actions`
hold / watch / trim / remove style actions

#### `trader.system_config`
aiMATA-owned config and prompt settings

#### `trader.raw_llm_outputs`
optional debugging/audit storage

#### `trader.user_events`
drag/add/remove/edit interactions

### Important

Do not use MAIPA’s `system_config`.
Build aiMATA’s own config table and runtime.

---

## Config System

Build a coherent aiMATA-specific config system from the beginning.

Requirements:

- manifest-driven config
- validation on save
- runtime actually uses the settings shown in admin
- clear grouping
- no fake config controls

This is important because the MAIPA admin had drift issues. Do not reproduce them.

---

## Admin Page

Create an aiMATA admin page that manages:

- prompts
- model settings
- token limits
- scanner thresholds
- score component weights
- basket constraints
- probability tuning

If a setting appears in the admin UI, it must truly be used at runtime.

Validation must be enforced in:

- UI inputs
- save route

---

## Suggested Folder Structure

Create a clean structure such as:

- `app/`
- `components/`
- `lib/`
- `types/`
- `db/`
- `jobs/`
- `public/`

Recommended subareas:

- `app/login`
- `app/dashboard`
- `app/opportunity/[ticker]`
- `app/settings`
- `app/admin`
- `components/dashboard`
- `components/opportunity`
- `components/basket`
- `components/agents`
- `lib/supabase`
- `lib/scoring`
- `lib/analytics`
- `lib/config`
- `db/migrations`
- `jobs/scanner`
- `jobs/briefs`

Use a clean, modern Next.js App Router structure.

---

## Technical Stack

Use:

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- Supabase

You may use small supporting libraries if justified, such as:

- drag-and-drop support
- animation/motion support
- schema validation

Keep dependencies purposeful.

---

## Build Requirements

Build the MVP in this order internally:

1. project scaffold
2. env wiring
3. Supabase client/server setup
4. DB migrations for `trader`
5. auth
6. opportunity scoring engine
7. dashboard
8. basket logic
9. analytics
10. opportunity detail
11. daily brief generation
12. admin/config
13. polish and verification

Do not stop after step 3 or 4.

---

## Verification Requirements

After building, verify the app.

Run at minimum:

- `npm run typecheck`
- `npm run build`

Also verify these flows logically and, where possible, by running them:

1. login works
2. dashboard loads
3. opportunities render from shared data
4. basket add/remove works
5. manual weight override works
6. analytics update immediately
7. opportunity detail page works
8. daily brief renders
9. admin saves and loads config correctly

### If something does not match the concept

If after implementation the product:

- feels too much like MAIPA
- has generic boring design
- lacks immediate basket intelligence
- has vague or fake analytics
- exposes config that runtime ignores

then iterate and fix it in the same run.

Do not stop at “it compiles.”

---

## Acceptance Criteria

The build is only done if all are true:

### Product

- it is clearly a short-term opportunity product
- it does not behave like a long-term advisor
- the 4-agent concept is visible and coherent
- the interface is visually intentional and brand-distinct

### UX

- dashboard is the main product surface
- curated opportunities are shown
- basket interaction is central and smooth
- analytics are immediate and useful

### Data

- the app reads from shared `public` source tables
- the app writes only to `trader.*`
- the original MAIPA product is not interfered with

### Intelligence

- opportunities are ranked coherently
- basket analytics are computed, not hand-waved
- explanations are grounded

### Admin

- settings are validated
- runtime actually uses them

### Technical

- typecheck passes
- build passes

---

## Deliverables At The End

When finished, provide:

1. short architecture summary
2. DB schema/tables created
3. opportunity scoring approach
4. basket analytics logic
5. the 4-agent prompt strategy
6. key screens built
7. verification results
8. residual risks / recommended next steps

---

## Final Instruction

Build **aiMATA** as a fresh standalone product in this folder.

It may reuse the same Supabase project and shared market/news source data, but it must:

- stand on its own
- write only to `trader.*`
- avoid interfering with MAIPA
- feel new
- feel fast
- feel fun
- feel useful immediately

Do not ask whether to implement the app.
Implement it.

