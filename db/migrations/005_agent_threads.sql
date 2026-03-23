-- Phase 7B: Agent thread and message persistence
-- Supports routed specialist interactions with context

CREATE TABLE IF NOT EXISTS trader.agent_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  routed_agent TEXT,
  routing_reason TEXT,
  graph_run_id UUID REFERENCES trader.graph_runs(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trader.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES trader.agent_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  agent_name TEXT,
  content TEXT NOT NULL,
  structured_output JSONB,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  prompt_key TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trader.agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own threads" ON trader.agent_threads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service full access threads" ON trader.agent_threads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users read own messages" ON trader.agent_messages
  FOR SELECT USING (
    thread_id IN (SELECT id FROM trader.agent_threads WHERE user_id = auth.uid())
  );
CREATE POLICY "Service full access messages" ON trader.agent_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_threads_user ON trader.agent_threads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_subject ON trader.agent_threads(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON trader.agent_messages(thread_id, created_at);

GRANT ALL ON trader.agent_threads TO service_role;
GRANT ALL ON trader.agent_messages TO service_role;
GRANT SELECT ON trader.agent_threads TO authenticated;
GRANT SELECT ON trader.agent_messages TO authenticated;
