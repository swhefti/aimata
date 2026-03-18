// ─── Public Schema Types (read-only from aiMATA's perspective) ───

export interface Asset {
  ticker: string;
  name: string;
  asset_type: 'stock' | 'crypto';
  sector: string | null;
  active: boolean;
}

export interface PriceHistory {
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketQuote {
  ticker: string;
  date: string;
  last_price: number;
  daily_change: number;
  pct_change: number;
}

export interface FundamentalData {
  ticker: string;
  date: string;
  pe_ratio: number | null;
  ps_ratio: number | null;
  revenue_growth_yoy: number | null;
  profit_margin: number | null;
  roe: number | null;
  market_cap: number | null;
  debt_to_equity: number | null;
}

// ─── Trader Schema Types ───

export type OpportunityLabel = 'Hot Now' | 'Swing' | 'Run';
export type RiskLabel = 'Low' | 'Medium' | 'High';

export interface OpportunityScore {
  ticker: string;
  asset_name: string;
  asset_type: 'stock' | 'crypto';
  sector: string | null;
  opportunity_score: number; // 0-100
  momentum_score: number;
  breakout_score: number;
  mean_reversion_score: number;
  catalyst_score: number;
  sentiment_score: number;
  volatility_score: number;
  regime_fit_score: number;
  opportunity_label: OpportunityLabel;
  risk_label: RiskLabel;
  setup_type: string;
  explanation: string;
  agent_tag: string;
  scored_at: string;
  horizon_days: number;
}

export interface BasketPosition {
  ticker: string;
  asset_name: string;
  asset_type: 'stock' | 'crypto';
  target_weight: number;
  manual_weight: number | null;
  entry_price: number;
  quantity: number;
  current_price: number;
  pnl: number;
  pnl_pct: number;
  opportunity_score: number;
  risk_label: RiskLabel;
  setup_type: string;
  added_at: string;
}

export type ConcentrationRisk = 'Low' | 'Medium' | 'High' | 'Critical';
export type CorrelationRisk = 'Low' | 'Medium' | 'High';
export type BasketQuality = 'Strong' | 'Good' | 'Fair' | 'Weak';

export interface BasketAnalytics {
  probability_score: number;
  expected_upside_min: number;
  expected_upside_max: number;
  downside_risk: number;
  concentration_risk: ConcentrationRisk;
  correlation_risk: CorrelationRisk;
  crypto_allocation: number;
  largest_position_pct: number;
  largest_position_ticker: string;
  basket_quality: BasketQuality;
  horizon_mix: {
    hot_now: number;
    swing: number;
    run: number;
  };
  setup_diversity: number;
  warnings: string[];
  suggested_actions: string[];
}

export type AgentName = 'Mark' | 'Paul' | 'Nia' | 'Rex';

export interface AgentBrief {
  id: string;
  agent_name: AgentName;
  content: string;
  brief_type: string;
  created_at: string;
}

export interface Agent {
  name: AgentName;
  role: string;
  job: string;
  tone: string;
  domain: string;
  color: string;
  icon: string;
}

export type ConfigType = 'string' | 'number' | 'boolean' | 'json';

export interface SystemConfig {
  key: string;
  value: string;
  group: string;
  label: string;
  description: string;
  type: ConfigType;
  validation: string | null;
  updated_at: string;
}

export interface UserEvent {
  id: string;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
