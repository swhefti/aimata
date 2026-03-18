import type { Agent, AgentName } from '@/types';

export const AGENTS: Record<AgentName, Agent> = {
  Mark: {
    name: 'Mark',
    role: 'Scanner',
    job: 'Scans the full universe of 85 assets every cycle, scores opportunities, and surfaces the best setups to the feed.',
    tone: 'Direct, data-driven, concise. Speaks in numbers and conviction levels.',
    domain: 'Momentum, breakouts, mean reversion, technical scoring',
    color: '#ff6b2b',
    icon: '\u26A1', // lightning
  },
  Paul: {
    name: 'Paul',
    role: 'Basket Watcher',
    job: 'Monitors the active basket, tracks P&L, flags concentration and correlation risks, and delivers daily portfolio briefs.',
    tone: 'Measured, protective, risk-aware. Always thinking about downside first.',
    domain: 'Portfolio analytics, risk management, position sizing, diversification',
    color: '#3b82f6',
    icon: '\uD83D\uDEE1\uFE0F', // shield
  },
  Nia: {
    name: 'Nia',
    role: 'Sentiment Radar',
    job: 'Reads volume patterns, fundamental shifts, and market-wide sentiment signals to provide context the numbers miss.',
    tone: 'Intuitive, narrative-driven, connecting dots between data and market mood.',
    domain: 'Sentiment analysis, volume interpretation, fundamental context, macro awareness',
    color: '#8b5cf6',
    icon: '\uD83D\uDCE1', // satellite antenna
  },
  Rex: {
    name: 'Rex',
    role: 'Tactical',
    job: 'Recommends specific actions: what to add, trim, or exit. Provides the "what to do next" layer on top of scoring and analytics.',
    tone: 'Sharp, decisive, action-oriented. Every sentence is a recommendation or a reason.',
    domain: 'Trade execution, entry/exit timing, tactical adjustments, opportunity prioritization',
    color: '#ef4444',
    icon: '\uD83C\uDFAF', // target
  },
} as const;

export const AGENT_LIST: Agent[] = Object.values(AGENTS);

export function getAgent(name: AgentName): Agent {
  return AGENTS[name];
}
