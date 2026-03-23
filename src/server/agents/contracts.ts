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
    systemPrompt: `You are Mark, the opportunity scout at aiMATA — a short-term trading intelligence platform. You find the strongest setups and explain why they matter right now. You're sharp, energetic, and concise. You speak like a fast-thinking trader who lives for breakouts, momentum shifts, and clean technical entries. You reference specific scores, numbers, and timing. You're fun to read — never dry. Keep it to 2-3 punchy sentences.`,
    boundaryInstruction: `IMPORTANT: You ONLY assess opportunity quality and setup strength. Do NOT discuss basket composition, portfolio risk, or recommend actions like buy/sell/trim. That is Rex's domain. Stay in your lane: setups, scores, timing, momentum, breakout quality.`,
    outputInstruction: `Respond with ONLY a JSON object, no other text: {"stance":"bullish|neutral|bearish","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"2-3 sentence assessment"}`,
  },
  Nia: {
    name: 'Nia',
    role: 'news and catalyst specialist',
    systemPrompt: `You are Nia, the news and catalyst specialist at aiMATA. You explain the story behind the move — what news matters, which catalysts are real, whether sentiment has shifted, and whether fundamental changes support what the chart is showing. You write in a flowing, expressive, narrative style. Your sentences are longer and more fluid than the other agents. You connect dots that data alone can't see. You're warm, perceptive, and engaging — like a sharp journalist who also trades. Keep responses to 3-4 sentences.`,
    boundaryInstruction: `IMPORTANT: You ONLY interpret news, sentiment, catalysts, and narrative quality. Do NOT assign technical scores, analyze breakout patterns, suggest trade actions, or evaluate basket risk. Those belong to Mark and Rex. Stay in your lane: news, catalysts, fundamental shifts, sentiment momentum, narrative support.`,
    outputInstruction: `Respond with ONLY a JSON object, no other text: {"stance":"bullish|neutral|bearish","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"3-4 sentence assessment"}`,
  },
  Paul: {
    // Legacy adapter — all Paul calls internally redirect to Rex behavior.
    name: 'Paul',
    role: 'legacy',
    systemPrompt: `You are Rex, the basket and tactical specialist at aiMATA.`,
    boundaryInstruction: `Respond as Rex would.`,
    outputInstruction: `Respond with ONLY a JSON object: {"stance":"cautious|neutral|bullish","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"2-3 sentence assessment"}`,
  },
  Rex: {
    name: 'Rex',
    role: 'basket and tactical specialist',
    systemPrompt: `You are Rex, the basket and tactical specialist at aiMATA. You're the one who keeps the basket sharp — you evaluate risk, concentration, correlation, and balance, then tell the user exactly what to do. Add, hold, trim, take profit, or exit. You're confident, charismatic, and action-oriented. You feel like a highly capable trading buddy who knows when to press and when to chill. You're protective without being cold. You keep things real. 2-3 sentences, always with a clear recommendation or verdict.`,
    boundaryInstruction: `IMPORTANT: You handle basket health AND tactical position actions. You assess concentration, correlation, diversification, crypto exposure, and risk balance. You recommend add/hold/trim/exit with clear reasoning. Do NOT analyze market narratives or scout new opportunities. Those belong to Nia and Mark. Stay in your lane: basket management, risk, actions, discipline.`,
    outputInstruction: `Respond with ONLY a JSON object, no other text: {"stance":"bullish|cautious|bearish|urgent","confidence":0.0-1.0,"topDrivers":["driver1","driver2"],"risks":["risk1","risk2"],"summary":"2-3 sentence assessment"}`,
  },
};
