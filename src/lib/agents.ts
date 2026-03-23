import type { Agent, AgentName } from '@/types';

export const AGENTS: Record<AgentName, Agent> = {
  Mark: {
    name: 'Mark',
    role: 'Scanner',
    job: 'Scans the full universe, scores opportunities, and surfaces the best short-term setups.',
    tone: 'Direct, data-driven, concise. Speaks in numbers and conviction levels.',
    domain: 'Momentum, breakouts, mean reversion, technical scoring',
    color: '#ff6b2b',
    icon: '\u26A1', // lightning
  },
  Paul: {
    // Legacy — kept for backend compatibility. Not shown on dashboard.
    name: 'Paul',
    role: 'Internal',
    job: 'Legacy basket watcher. Responsibilities absorbed by Rex.',
    tone: 'Measured, protective, risk-aware.',
    domain: 'Portfolio analytics (legacy)',
    color: '#3b82f6',
    icon: '\uD83D\uDEE1\uFE0F',
  },
  Nia: {
    name: 'Nia',
    role: 'News & Catalysts',
    job: 'Interprets news, sentiment, catalysts, and narrative momentum. Explains whether a move has real support or is just noise.',
    tone: 'Intuitive, narrative-driven, socially aware.',
    domain: 'News, sentiment, catalysts, fundamental shifts, narrative support',
    color: '#8b5cf6',
    icon: '\uD83D\uDCE1',
  },
  Rex: {
    name: 'Rex',
    role: 'Basket & Tactics',
    job: 'Manages the basket: evaluates risk, concentration, and balance. Recommends what to add, hold, trim, or exit. Enforces discipline.',
    tone: 'Sharp, decisive, protective. Blunt about risk, clear about actions.',
    domain: 'Basket health, risk management, position actions, trade discipline, concentration, correlation',
    color: '#ef4444',
    icon: '\uD83C\uDFAF',
  },
} as const;

/** Active agents shown on the dashboard (excludes legacy Paul) */
export const ACTIVE_AGENTS: AgentName[] = ['Mark', 'Nia', 'Rex'];

export const AGENT_LIST: Agent[] = Object.values(AGENTS);

export function getAgent(name: AgentName): Agent {
  return AGENTS[name];
}
