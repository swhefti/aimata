-- Phase 4-5: Recommendation state and provenance
-- Adds durable recommendation tracking and score provenance

-- ─── Expand opportunity_runs with provenance ───
ALTER TABLE trader.opportunity_runs
  ADD COLUMN IF NOT EXISTS config_hash TEXT,
  ADD COLUMN IF NOT EXISTS scoring_version TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS data_freshness JSONB,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ─── Expand opportunity_scores with provenance ───
ALTER TABLE trader.opportunity_scores
  ADD COLUMN IF NOT EXISTS scoring_version TEXT DEFAULT '1.0';

-- ─── Expand opportunity_feed with provenance ───
ALTER TABLE trader.opportunity_feed
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scoring_version TEXT DEFAULT '1.0';

-- ─── Recommendation runs (advisor-layer state, lives in trader for now) ───
-- Tracks each time recommendation actions are computed for a user's basket
CREATE TABLE IF NOT EXISTS trader.recommendation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  basket_id UUID REFERENCES trader.baskets(id) ON DELETE CASCADE,
  source_run_id UUID REFERENCES trader.opportunity_runs(id),
  total_positions INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  basket_quality TEXT,
  probability_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Recommendation items (individual position actions with lineage) ───
CREATE TABLE IF NOT EXISTS trader.recommendation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES trader.recommendation_runs(id) ON DELETE CASCADE,
  basket_id UUID REFERENCES trader.baskets(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  action TEXT NOT NULL,
  urgency TEXT DEFAULT 'low',
  reason TEXT,
  opportunity_score NUMERIC,
  pnl_pct NUMERIC,
  position_weight NUMERIC,
  risk_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE trader.recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.recommendation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own recommendation runs" ON trader.recommendation_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service full access recommendation_runs" ON trader.recommendation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users read own recommendation items" ON trader.recommendation_items
  FOR ALL USING (
    run_id IN (SELECT id FROM trader.recommendation_runs WHERE user_id = auth.uid())
  );
CREATE POLICY "Service full access recommendation_items" ON trader.recommendation_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rec_runs_user ON trader.recommendation_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_items_run ON trader.recommendation_items(run_id);
CREATE INDEX IF NOT EXISTS idx_rec_items_ticker ON trader.recommendation_items(ticker);

-- Update position_actions to reference recommendation runs for lineage
ALTER TABLE trader.position_actions
  ADD COLUMN IF NOT EXISTS recommendation_run_id UUID REFERENCES trader.recommendation_runs(id),
  ADD COLUMN IF NOT EXISTS opportunity_score NUMERIC,
  ADD COLUMN IF NOT EXISTS pnl_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'low';
