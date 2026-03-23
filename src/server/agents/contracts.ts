/**
 * Agent Contracts — Phase 6.5 hardened
 *
 * Defines structured input/output contracts for each specialist agent.
 * Each agent has a clearly bounded role, data scope, and responsibility.
 *
 * Key principle: agents explain deterministic canon, they don't replace it.
 * Structured outputs first, narrative rendering second.
 *
 * Role boundaries:
 * - Mark: ONLY opportunity/setup assessment. Does NOT discuss basket risk or actions.
 * - Nia:  ONLY narrative/catalyst/sentiment. Does NOT suggest actions or score setups.
 * - Paul: ONLY basket health/risk/balance. Does NOT scout opportunities or suggest trades.
 * - Rex:  ONLY tactical actions (add/hold/trim/exit). Does NOT analyze sentiment or basket health.
 */

import type { AgentName } from '@/types';

// ─── Prompt Versioning ───

export const PROMPT_VERSION = '1.1'; // Increment when prompts change materially

// ─── Artifact Status ───

export type ArtifactStatus = 'success' | 'failed' | 'fallback';

// ─── Structured Agent Output ───

export interface AgentStructuredOutput {
  stance: 'bullish' | 'neutral' | 'bearish' | 'cautious' | 'urgent';
  confidence: number; // 0-1
  topDrivers: string[];
  risks: string[];
  summary: string;
}

// ─── Agent Artifact (persisted) ───

export interface AgentArtifact {
  id?: string;
  agent_name: AgentName;
  subject_type: 'market' | 'ticker' | 'basket' | 'recommendation';
  subject_id: string | null;
  brief_type: string;
  content: string;
  structured_output: AgentStructuredOutput | null;
  prompt_key: string;
  prompt_version: string;
  model: string;
  source_run_id: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
  status: ArtifactStatus;
  created_at: string;
}

// ─── Context Packages ───

export interface MarketContext {
  totalAssets: number;
  hotNowCount: number;
  swingCount: number;
  runCount: number;
  topOpportunities: {
    ticker: string;
    name: string;
    score: number;
    label: string;
    setupType: string;
    riskLabel: string;
    momentumScore: number;
    breakoutScore: number;
  }[];
  lastScanAt: string | null;
}

export interface TickerContext {
  ticker: string;
  name: string;
  assetType: string;
  sector: string | null;
  price: number | null;
  changePct: number | null;
  scores: {
    opportunity: number;
    momentum: number;
    breakout: number;
    meanReversion: number;
    catalyst: number;
    sentiment: number;
    volatility: number;
    regimeFit: number;
  };
  label: string;
  riskLabel: string;
  setupType: string;
  horizonDays: number;
  fundamentals: {
    peRatio: number | null;
    revenueGrowth: number | null;
    profitMargin: number | null;
    roe: number | null;
    marketCap: number | null;
  } | null;
}

export interface BasketContext {
  positionCount: number;
  totalValue: number;
  totalCost: number;
  totalPnlPct: number;
  winners: number;
  losers: number;
  positions: {
    ticker: string;
    weight: number;
    pnlPct: number;
    score: number;
    riskLabel: string;
    setupType: string;
  }[];
  analytics: {
    probabilityScore: number;
    concentrationRisk: string;
    correlationRisk: string;
    cryptoAllocation: number;
    largestPosition: string;
    largestPositionPct: number;
    basketQuality: string;
  } | null;
}

export interface ActionContext {
  ticker: string;
  action: string;
  urgency: string;
  reason: string;
  pnlPct: number;
  opportunityScore: number;
  riskLabel: string;
  positionWeight: number;
}

// ─── Agent Prompt Specs ───

export interface AgentSpec {
  name: AgentName;
  role: string;
  systemPrompt: string;
  boundaryInstruction: string;
  outputInstruction: string;
}

export const AGENT_SPECS: Record<AgentName, AgentSpec> = {
  Mark: {
    name: 'Mark',
    role: 'opportunity scout',
    systemPrompt: `You are Mark, the opportunity scout at aiMATA. You identify promising short-term trading setups and explain why they matter NOW. You speak in a direct, data-driven, energetic tone. You reference specific scores, momentum, breakouts, and timing. You never make guarantees — you surface the strongest setups and explain the conviction level.`,
    boundaryInstruction: `IMPORTANT: You ONLY assess opportunity quality and setup strength. Do NOT discuss basket composition, portfolio risk, or recommend specific actions like buy/sell/trim. That is Rex's job. Stay in your lane: setups, scores, timing, momentum.`,
    outputInstruction: `Respond with ONLY a JSON object, no other text: {"stance":"bullish|neutral|bearish","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"2-3 sentence assessment"}`,
  },
  Nia: {
    name: 'Nia',
    role: 'news and catalyst specialist',
    systemPrompt: `You are Nia, the news and catalyst specialist at aiMATA. You interpret what's driving moves — news events, catalysts, fundamental shifts, and market sentiment. You explain whether a move has real narrative support or is just noise. You focus strictly on the story behind the numbers.`,
    boundaryInstruction: `IMPORTANT: You ONLY interpret news, sentiment, catalysts, and narrative quality. Do NOT assign opportunity scores, analyze technical patterns, suggest trade actions, or evaluate basket risk. That belongs to Mark and Rex. Stay in your lane: news, catalysts, sentiment, narrative momentum.`,
    outputInstruction: `Respond with ONLY a JSON object, no other text: {"stance":"bullish|neutral|bearish","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"2-3 sentence assessment"}`,
  },
  Paul: {
    // Legacy — kept for backend compatibility. Responsibilities absorbed by Rex.
    name: 'Paul',
    role: 'legacy basket specialist',
    systemPrompt: `You are Rex, the basket and tactical specialist at aiMATA. You evaluate basket health, concentration, and risk, then recommend specific actions.`,
    boundaryInstruction: `Respond as Rex would. Assess basket health and recommend actions.`,
    outputInstruction: `Respond with ONLY a JSON object, no other text: {"stance":"cautious|neutral|bullish","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"2-3 sentence assessment"}`,
  },
  Rex: {
    name: 'Rex',
    role: 'basket and tactical specialist',
    systemPrompt: `You are Rex, the basket and tactical specialist at aiMATA. You manage the basket: evaluate portfolio health, concentration, correlation, and risk balance. You also recommend specific actions — add, hold, trim, take profit, or exit. You're blunt, decisive, and protective. You enforce discipline and always think about downside.`,
    boundaryInstruction: `IMPORTANT: You handle BOTH basket health assessment AND tactical position actions. You evaluate concentration, correlation, diversification, and risk. You recommend add/hold/trim/exit with clear reasons. Do NOT analyze market narratives or scout new opportunities. That belongs to Nia and Mark. Stay in your lane: basket health, risk, actions, discipline.`,
    outputInstruction: `Respond with ONLY a JSON object, no other text: {"stance":"bullish|cautious|bearish|urgent","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"2-3 sentence assessment"}`,
  },
};
