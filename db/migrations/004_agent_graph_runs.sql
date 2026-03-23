-- Phase 7A: Agent graph run persistence
-- First real LangGraph orchestration storage

-- Graph runs — one record per committee synthesis invocation
CREATE TABLE IF NOT EXISTS trader.graph_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_type TEXT NOT NULL DEFAULT 'committee_synthesis',
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  node_count INTEGER DEFAULT 0,
  nodes_completed INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Node runs — one record per specialist node execution within a graph
CREATE TABLE IF NOT EXISTS trader.node_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_run_id UUID NOT NULL REFERENCES trader.graph_runs(id) ON DELETE CASCADE,
  node_name TEXT NOT NULL,
  agent_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_summary TEXT,
  output_text TEXT,
  structured_output JSONB,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE trader.graph_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trader.node_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own graph runs" ON trader.graph_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service full access graph_runs" ON trader.graph_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users read own node runs" ON trader.node_runs
  FOR SELECT USING (
    graph_run_id IN (SELECT id FROM trader.graph_runs WHERE user_id = auth.uid())
  );
CREATE POLICY "Service full access node_runs" ON trader.node_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_graph_runs_user ON trader.graph_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_runs_type ON trader.graph_runs(graph_type, subject_type);
CREATE INDEX IF NOT EXISTS idx_node_runs_graph ON trader.node_runs(graph_run_id);

-- Grant access
GRANT ALL ON trader.graph_runs TO service_role;
GRANT ALL ON trader.node_runs TO service_role;
GRANT SELECT ON trader.graph_runs TO authenticated;
GRANT SELECT ON trader.node_runs TO authenticated;
