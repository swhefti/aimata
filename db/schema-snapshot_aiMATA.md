# Supabase Database Schema
## Project: xrsyshxvrikfhwdsreqv
## Generated: 2026-03-20

---

## SCHEMA: `public` (MAIPA-owned, shared data)

### public.assets (105 rows)
| Column | Type | Notes |
|---|---|---|
| ticker | text | Primary key |
| name | text | e.g. "Apple Inc." |
| asset_type | text | stock (65), etf (20), crypto (20) |
| sector | text | e.g. "Technology" |
| active | boolean | |
| created_at | timestamptz | |

### public.price_history (4,174 rows)
| Column | Type | Notes |
|---|---|---|
| ticker | text | FK → assets |
| date | date | Range: 2026-01-21 to 2026-03-20 |
| open | numeric | |
| high | numeric | |
| low | numeric | |
| close | numeric | |
| volume | integer | |
| ingested_at | timestamptz | |

### public.market_quotes (1,192 rows)
| Column | Type | Notes |
|---|---|---|
| ticker | text | FK → assets |
| date | date | Range: 2026-03-04 to 2026-03-20 |
| last_price | numeric | |
| daily_change | numeric | |
| pct_change | numeric | |
| ingested_at | timestamptz | |

### public.fundamental_data (74 rows)
| Column | Type | Notes |
|---|---|---|
| ticker | text | FK → assets, stocks only |
| date | date | Single snapshot: 2026-03-05 |
| pe_ratio | numeric | |
| ps_ratio | numeric | |
| revenue_growth_yoy | numeric | |
| profit_margin | numeric | |
| roe | numeric | |
| market_cap | bigint | |
| debt_to_equity | numeric | Nullable, mostly null |
| ingested_at | timestamptz | |

### public.portfolios (21 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| name | text | Usually "My Portfolio" |
| status | text | active / archived |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| cash_balance | numeric | Nullable |
| strategy_mode | text | e.g. "pro" |
| strategy_version | text | e.g. "1.0" |

### public.portfolio_positions (67 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| portfolio_id | uuid | FK → portfolios |
| ticker | text | |
| quantity | numeric | |
| avg_purchase_price | numeric | |
| opened_at | timestamptz | |
| closed_at | timestamptz | Nullable |
| is_active | boolean | |

### public.user_profiles (6 rows)
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | PK, FK → auth.users |
| display_name | text | |
| investment_capital | numeric | |
| time_horizon_months | integer | |
| risk_profile | text | conservative / balanced / aggressive |
| goal_return_pct | numeric | |
| max_drawdown_limit_pct | numeric | |
| volatility_tolerance | text | |
| asset_types | jsonb | e.g. ["stock", "crypto"] |
| max_positions | integer | |
| rebalancing_preference | text | |
| onboarding_completed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### public.system_config (69 rows)
| Column | Type | Notes |
|---|---|---|
| key | text | PK |
| value | text | |
| type | text | |
| label | text | |
| group_name | text | models (6), prompts (6), scoring_weights (8) |
| description | text | |
| updated_at | timestamptz | |

### Empty tables in public
These tables exist but contain no data:
- market_news
- news
- news_articles
- analyst_ratings
- watchlists
- watchlist_items
- ai_outputs
- recommendations
- rebalance_history
- signals
- alerts
- backtests
- model_outputs
- chat_messages
- agent_outputs
- sentiment_data
- economic_data
- sector_data
- risk_scores
- optimization_runs
- trade_signals

---

## SCHEMA: `trader` (aiMATA-owned)

### trader.baskets (1 row)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| name | text | Default "My Basket" |
| status | text | "active" |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### trader.basket_positions (7 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| basket_id | uuid | FK → baskets |
| ticker | text | |
| asset_name | text | |
| asset_type | text | stock / crypto |
| target_weight | numeric | Auto-computed |
| manual_weight | numeric | Nullable, user override |
| entry_price | numeric | |
| quantity | numeric | |
| opportunity_score | numeric | Score at time of adding |
| risk_label | text | Low / Medium / High |
| setup_type | text | Momentum / Breakout / etc. |
| added_at | timestamptz | |

### trader.opportunity_runs (3 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| ran_at | timestamptz | |
| total_scored | integer | |

### trader.opportunity_scores (195 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| run_id | uuid | FK → opportunity_runs |
| ticker | text | |
| asset_name | text | |
| asset_type | text | |
| sector | text | |
| opportunity_score | numeric | 0-100 composite |
| momentum_score | numeric | 0-100 |
| breakout_score | numeric | 0-100 |
| mean_reversion_score | numeric | 0-100 |
| catalyst_score | numeric | 0-100 |
| sentiment_score | numeric | 0-100 |
| volatility_score | numeric | 0-100 |
| regime_fit_score | numeric | 0-100 |
| opportunity_label | text | Hot Now / Swing / Run |
| risk_label | text | Low / Medium / High |
| setup_type | text | Momentum / Breakout / etc. |
| explanation | text | One-line summary |
| agent_tag | text | "Mark" |
| horizon_days | integer | 3 / 10 / 30 |
| scored_at | timestamptz | |

### trader.opportunity_feed (37 rows)
Same columns as opportunity_scores plus:
| Column | Type | Notes |
|---|---|---|
| updated_at | timestamptz | |

This is the curated top-N feed shown on the dashboard.

### trader.basket_risk_snapshots (41 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| basket_id | uuid | FK → baskets |
| user_id | uuid | FK → auth.users |
| snapshot | jsonb | Full BasketAnalytics object |
| created_at | timestamptz | |

### trader.agent_briefs (0 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| agent_name | text | Mark / Paul / Nia / Rex |
| content | text | Brief text content |
| brief_type | text | "daily" |
| metadata | jsonb | |
| created_at | timestamptz | |

### trader.position_actions (0 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| basket_id | uuid | FK → baskets |
| ticker | text | |
| action_type | text | hold / watch / trim / remove / add |
| reason | text | |
| agent_name | text | |
| created_at | timestamptz | |

### trader.system_config (0 rows)
| Column | Type | Notes |
|---|---|---|
| key | text | PK |
| value | text | |
| group | text | |
| label | text | |
| description | text | |
| type | text | string / number / boolean |
| updated_at | timestamptz | |

### trader.raw_llm_outputs (0 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| prompt_key | text | |
| input_data | jsonb | |
| output_text | text | |
| model | text | |
| tokens_used | integer | |
| duration_ms | integer | |
| created_at | timestamptz | |

### trader.user_events (0 rows)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| event_type | text | |
| payload | jsonb | |
| created_at | timestamptz | |

---

## Users (auth.users → profiles)

| display_name | risk_profile | capital | horizon | max_positions |
|---|---|---|---|---|
| Samuel Hefti | balanced | $20,000 | 12 months | 8 |
| Shefti | balanced | $90,000 | 12 months | 7 |
| Nadia | aggressive | $88,200 | 2 months | 13 |
| HWZ2 | conservative | $70,000 | 12 months | 5 |
| MERAKII Trader | balanced | $65,000 | 24 months | 5 |
| Codex Verify | balanced | $0 | 12 months | 8 |
