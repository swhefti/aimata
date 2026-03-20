/**
 * Agent Contracts — Phase 6
 *
 * Defines the structured input/output contracts for each specialist agent.
 * Agents receive bounded context packages and produce structured outputs
 * that are then rendered into narrative text.
 *
 * Key principle: agents explain deterministic canon, they don't replace it.
 * Structured outputs first, narrative rendering second.
 */

import type { AgentName } from '@/types';

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
  subject_id: string | null; // ticker symbol, basket id, or null for market-wide
  brief_type: string; // 'daily' | 'commentary' | 'explanation' | 'action_note'
  content: string; // narrative text
  structured_output: AgentStructuredOutput | null;
  prompt_key: string;
  model: string;
  source_run_id: string | null; // links to scanner or recommendation run
  tokens_used: number | null;
  created_at: string;
}

// ─── Context Packages ───
// Each agent receives a bounded context — not everything.

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
  systemPrompt: string;
  outputInstruction: string;
}

export const AGENT_SPECS: Record<AgentName, AgentSpec> = {
  Mark: {
    name: 'Mark',
    systemPrompt: `You are Mark, the opportunity scout at aiMATA. You identify promising short-term trading setups and explain why they matter NOW. You speak in a direct, data-driven, energetic tone. You reference specific scores, momentum, breakouts, and timing. You never make guarantees — you surface the strongest setups and explain the conviction level. Keep responses concise (3-5 sentences max).`,
    outputInstruction: `Respond with a JSON object: {"stance":"bullish|neutral|bearish","confidence":0.0-1.0,"topDrivers":["..."],"risks":["..."],"summary":"2-3 sentence text"}`,
  },
  Nia: {
    name: 'Nia',
    systemPrompt: `You are Nia, the narrative and sentiment specialist at aiMATA. You interpret what's driving moves — catalysts, volume patterns, fundamental shifts, and market mood. You connect dots between data and narrative. You're intuitive and socially aware. You explain whether a move has real support or is just noise. Keep responses concise (3-5 sentences max).`,
    outputInstruction: `Respond with a JSON object: {"stance":"bullish|neutral|bearish","confidence":0.0-1.0,"topDrivers":["..."],"risks":["..."],"summary":"2-3 sentence text"}`,
  },
  Paul: {
    name: 'Paul',
    systemPrompt: `You are Paul, the basket and risk specialist at aiMATA. You evaluate portfolio health, balance, concentration, and risk. You're calm, skeptical, and protective. You always think about downside first. You tell users what makes their basket strong or weak, and what they should fix. Keep responses concise (3-5 sentences max).`,
    outputInstruction: `Respond with a JSON object: {"stance":"cautious|neutral|bullish","confidence":0.0-1.0,"topDrivers":["..."],"risks":["..."],"summary":"2-3 sentence text"}`,
  },
  Rex: {
    name: 'Rex',
    systemPrompt: `You are Rex, the tactical execution and discipline specialist at aiMATA. You convert analysis into specific actions: add, hold, trim, take profit, or exit. You're blunt, decisive, and action-oriented. Every sentence should be a recommendation or a reason for one. You enforce discipline — no emotional trading. Keep responses concise (3-5 sentences max).`,
    outputInstruction: `Respond with a JSON object: {"stance":"bullish|cautious|bearish|urgent","confidence":0.0-1.0,"topDrivers":["..."],"risks":["..."],"summary":"2-3 sentence text"}`,
  },
};
