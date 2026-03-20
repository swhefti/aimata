-- Phase 6: Agent artifact storage
-- Structured, persisted agent outputs with provenance

-- Expand agent_briefs to support per-agent, per-subject artifacts
ALTER TABLE trader.agent_briefs
  ADD COLUMN IF NOT EXISTS subject_type TEXT DEFAULT 'market',
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS prompt_key TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS structured_output JSONB,
  ADD COLUMN IF NOT EXISTS source_run_id TEXT,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

-- Index for ticker-level lookups
CREATE INDEX IF NOT EXISTS idx_agent_briefs_subject
  ON trader.agent_briefs(subject_type, subject_id, agent_name, created_at DESC);
