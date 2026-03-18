import { NextResponse } from 'next/server'

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Use Supabase's internal pg-meta endpoint to execute SQL
  // This is available on all Supabase projects via the service role
  const sqlStatements = [
    `CREATE SCHEMA IF NOT EXISTS trader`,

    `CREATE TABLE IF NOT EXISTS trader.user_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      display_name TEXT,
      risk_tolerance TEXT DEFAULT 'medium' CHECK (risk_tolerance IN ('low', 'medium', 'high')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS trader.baskets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT DEFAULT 'My Basket',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS trader.basket_positions (
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
    )`,

    `CREATE TABLE IF NOT EXISTS trader.opportunity_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ran_at TIMESTAMPTZ DEFAULT now(),
      total_scored INTEGER DEFAULT 0
    )`,

    `CREATE TABLE IF NOT EXISTS trader.opportunity_scores (
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
    )`,

    `CREATE TABLE IF NOT EXISTS trader.opportunity_feed (
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
    )`,

    `CREATE TABLE IF NOT EXISTS trader.basket_risk_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      basket_id UUID REFERENCES trader.baskets(id) ON DELETE CASCADE,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      snapshot JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS trader.agent_briefs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      agent_name TEXT NOT NULL,
      content TEXT NOT NULL,
      brief_type TEXT DEFAULT 'daily',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS trader.position_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      basket_id UUID REFERENCES trader.baskets(id) ON DELETE CASCADE,
      ticker TEXT NOT NULL,
      action_type TEXT,
      reason TEXT,
      agent_name TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS trader.system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      "group" TEXT,
      label TEXT,
      description TEXT,
      type TEXT DEFAULT 'string',
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS trader.raw_llm_outputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prompt_key TEXT,
      input_data JSONB,
      output_text TEXT,
      model TEXT,
      tokens_used INTEGER,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS trader.user_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
  ]

  const results: { statement: string; success: boolean; error?: string }[] = []

  for (const sql of sqlStatements) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_text: sql }),
      })

      if (!res.ok) {
        const errText = await res.text()
        results.push({ statement: sql.substring(0, 60), success: false, error: errText })
      } else {
        results.push({ statement: sql.substring(0, 60), success: true })
      }
    } catch (err) {
      results.push({
        statement: sql.substring(0, 60),
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({ results })
}
