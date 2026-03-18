-- aiMATA Trader Schema Migration
-- Run this in the Supabase SQL Editor to create all aiMATA-owned tables
-- This does NOT touch any existing MAIPA / public schema tables

CREATE SCHEMA IF NOT EXISTS trader;

-- 1. User profiles (aiMATA-specific)
CREATE TABLE IF NOT EXISTS trader.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  risk_tolerance TEXT DEFAULT 'medium' CHECK (risk_tolerance IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Baskets (one active basket per user)
CREATE TABLE IF NOT EXISTS trader.baskets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'My Basket',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Basket positions
CREATE TABLE IF NOT EXISTS trader.basket_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id UUID NOT NULL REFERENCES trader.baskets(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  asset_name TEXT,
  asset_type TEXT,
  target_weight NUMERIC DEFAULT 0,
  manual_weight NUMERIC,
  entry_price NUMERIC,
  quantity NUMERIC DEFAULT 0,
  opportunity_score NUMERIC DEFAULT 0,
  risk_label TEXT DEFAULT 'Medium',
  setup_type TEXT DEFAULT 'Unknown',
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(basket_id, ticker)
);

-- 4. Opportunity scanner runs
CREATE TABLE IF NOT EXISTS trader.opportunity_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ DEFAULT now(),
  total_scored INTEGER DEFAULT 0
);

-- 5. Opportunity scores (historical per-run)
CREATE TABLE IF NOT EXISTS trader.opportunity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES trader.opportunity_runs(id),
  ticker TEXT NOT NULL,
  asset_name TEXT,
  asset_type TEXT,
  sector TEXT,
  opportunity_score NUMERIC,
  momentum_score NUMERIC,
  breakout_score NUMERIC,
  mean_reversion_score NUMERIC,
  catalyst_score NUMERIC,
  sentiment_score NUMERIC,
  volatility_score NUMERIC,
  regime_fit_score NUMERIC,
  opportunity_label TEXT,
  risk_label TEXT,
  setup_type TEXT,
  explanation TEXT,
  agent_tag TEXT DEFAULT 'Mark',
  horizon_days INTEGER,
  scored_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Opportunity feed (current surfaced opportunities for dashboard)
CREATE TABLE IF NOT EXISTS trader.opportunity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  run_id UUID REFERENCES trader.opportunity_runs(id),
  asset_name TEXT,
  asset_type TEXT,
  sector TEXT,
  opportunity_score NUMERIC,
  momentum_score NUMERIC,
  breakout_score NUMERIC,
  mean_reversion_score NUMERIC,
  catalyst_score NUMERIC,
  sentiment_score NUMERIC,
  volatility_score NUMERIC,
  regime_fit_score NUMERIC,
  opportunity_label TEXT,
  risk_label TEXT,
  setup_type TEXT,
  explanation TEXT,
  agent_tag TEXT DEFAULT 'Mark',
  horizon_days INTEGER,
  scored_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Basket risk snapshots
CREATE TABLE IF NOT EXISTS trader.basket_risk_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id UUID REFERENCES trader.baskets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Agent briefs (daily briefings and commentary)
CREATE TABLE IF NOT EXISTS trader.agent_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  content TEXT NOT NULL,
  brief_type TEXT DEFAULT 'daily',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Position actions (hold/watch/trim/remove)
CREATE TABLE IF NOT EXISTS trader.position_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id UUID REFERENCES trader.baskets(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  action_type TEXT,
  reason TEXT,
  agent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. System config (aiMATA-owned, not shared with MAIPA)
CREATE TABLE IF NOT EXISTS trader.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  "group" TEXT,
  label TEXT,
  description TEXT,
  type TEXT DEFAULT 'string',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Raw LLM outputs (audit/debug)
CREATE TABLE IF NOT EXISTS trader.raw_llm_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT,
  input_data JSONB,
  output_text TEXT,
  model TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. User events (interaction tracking)
CREATE TABLE IF NOT EXISTS trader.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE trader.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.baskets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.basket_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.opportunity_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.opportunity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.opportunity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.basket_risk_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.agent_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.position_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.raw_llm_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.user_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: user-owned tables
CREATE POLICY "Users manage own profile" ON trader.user_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own baskets" ON trader.baskets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own basket positions" ON trader.basket_positions
  FOR ALL USING (basket_id IN (SELECT id FROM trader.baskets WHERE user_id = auth.uid()))
  WITH CHECK (basket_id IN (SELECT id FROM trader.baskets WHERE user_id = auth.uid()));

CREATE POLICY "Users read opportunity feed" ON trader.opportunity_feed
  FOR SELECT USING (true);

CREATE POLICY "Users read opportunity scores" ON trader.opportunity_scores
  FOR SELECT USING (true);

CREATE POLICY "Users read opportunity runs" ON trader.opportunity_runs
  FOR SELECT USING (true);

CREATE POLICY "Users manage own risk snapshots" ON trader.basket_risk_snapshots
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own briefs" ON trader.agent_briefs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own position actions" ON trader.position_actions
  FOR ALL USING (basket_id IN (SELECT id FROM trader.baskets WHERE user_id = auth.uid()))
  WITH CHECK (basket_id IN (SELECT id FROM trader.baskets WHERE user_id = auth.uid()));

CREATE POLICY "Anyone read system config" ON trader.system_config
  FOR SELECT USING (true);

CREATE POLICY "Users manage own events" ON trader.user_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role policies (bypass RLS for admin/scanner)
CREATE POLICY "Service full access opportunity_feed" ON trader.opportunity_feed
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access opportunity_scores" ON trader.opportunity_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access opportunity_runs" ON trader.opportunity_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access system_config" ON trader.system_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access agent_briefs" ON trader.agent_briefs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access raw_llm_outputs" ON trader.raw_llm_outputs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access baskets" ON trader.baskets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access basket_positions" ON trader.basket_positions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service full access basket_risk_snapshots" ON trader.basket_risk_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opp_scores_ticker ON trader.opportunity_scores(ticker);
CREATE INDEX IF NOT EXISTS idx_opp_scores_scored_at ON trader.opportunity_scores(scored_at);
CREATE INDEX IF NOT EXISTS idx_opp_feed_score ON trader.opportunity_feed(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_basket_pos_basket ON trader.basket_positions(basket_id);
CREATE INDEX IF NOT EXISTS idx_agent_briefs_user ON trader.agent_briefs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON trader.user_events(user_id, created_at DESC);

-- Expose trader schema to PostgREST (required for Supabase client .schema('trader') to work)
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, trader';
NOTIFY pgrst, 'reload config';
