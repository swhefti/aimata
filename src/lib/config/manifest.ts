import type { ConfigType } from '@/types';

export interface ConfigManifestItem {
  key: string;
  label: string;
  description: string;
  group: 'scanner' | 'scoring' | 'basket' | 'probability' | 'prompts' | 'model';
  type: ConfigType;
  default_value: string | number | boolean;
  validation: {
    min?: number;
    max?: number;
    options?: string[];
  } | null;
}

export const CONFIG_MANIFEST: ConfigManifestItem[] = [
  // ─── Scanner ───
  {
    key: 'scanner.min_score_threshold',
    label: 'Minimum Score Threshold',
    description: 'Assets must score at least this high to appear in the opportunity feed.',
    group: 'scanner',
    type: 'number',
    default_value: 55,
    validation: { min: 0, max: 100 },
  },
  {
    key: 'scanner.max_feed_size',
    label: 'Max Feed Size',
    description: 'Maximum number of opportunities shown in the feed at once.',
    group: 'scanner',
    type: 'number',
    default_value: 20,
    validation: { min: 5, max: 50 },
  },

  // ─── Scoring Weights ───
  {
    key: 'scoring.momentum_weight',
    label: 'Momentum Weight',
    description: 'Weight given to the momentum score component in the overall opportunity score.',
    group: 'scoring',
    type: 'number',
    default_value: 0.25,
    validation: { min: 0, max: 1 },
  },
  {
    key: 'scoring.breakout_weight',
    label: 'Breakout Weight',
    description: 'Weight given to breakout detection in the overall opportunity score.',
    group: 'scoring',
    type: 'number',
    default_value: 0.20,
    validation: { min: 0, max: 1 },
  },
  {
    key: 'scoring.mean_reversion_weight',
    label: 'Mean Reversion Weight',
    description: 'Weight given to mean reversion signals in the overall opportunity score.',
    group: 'scoring',
    type: 'number',
    default_value: 0.10,
    validation: { min: 0, max: 1 },
  },
  {
    key: 'scoring.catalyst_weight',
    label: 'Catalyst Weight',
    description: 'Weight given to fundamental catalysts (revenue growth, margins) in scoring.',
    group: 'scoring',
    type: 'number',
    default_value: 0.15,
    validation: { min: 0, max: 1 },
  },
  {
    key: 'scoring.sentiment_weight',
    label: 'Sentiment Weight',
    description: 'Weight given to volume-based sentiment signals in scoring.',
    group: 'scoring',
    type: 'number',
    default_value: 0.10,
    validation: { min: 0, max: 1 },
  },
  {
    key: 'scoring.volatility_weight',
    label: 'Volatility Weight',
    description: 'Weight given to volatility-adjusted risk scoring.',
    group: 'scoring',
    type: 'number',
    default_value: 0.10,
    validation: { min: 0, max: 1 },
  },
  {
    key: 'scoring.regime_fit_weight',
    label: 'Regime Fit Weight',
    description: 'Weight given to how well the asset fits the current market regime.',
    group: 'scoring',
    type: 'number',
    default_value: 0.10,
    validation: { min: 0, max: 1 },
  },

  // ─── Basket ───
  {
    key: 'basket.max_positions',
    label: 'Max Positions',
    description: 'Maximum number of positions allowed in the basket at once.',
    group: 'basket',
    type: 'number',
    default_value: 15,
    validation: { min: 1, max: 50 },
  },
  {
    key: 'basket.max_crypto_pct',
    label: 'Max Crypto Allocation %',
    description: 'Maximum percentage of the basket that can be allocated to crypto assets.',
    group: 'basket',
    type: 'number',
    default_value: 30,
    validation: { min: 0, max: 100 },
  },
  {
    key: 'basket.max_single_position_pct',
    label: 'Max Single Position %',
    description: 'Maximum percentage of the basket any single position can occupy.',
    group: 'basket',
    type: 'number',
    default_value: 25,
    validation: { min: 5, max: 100 },
  },

  // ─── Probability ───
  {
    key: 'probability.base_score',
    label: 'Base Probability Score',
    description: 'Starting probability score before bonuses and penalties are applied.',
    group: 'probability',
    type: 'number',
    default_value: 50,
    validation: { min: 0, max: 100 },
  },
  {
    key: 'probability.diversification_bonus',
    label: 'Diversification Bonus',
    description: 'Maximum bonus added to probability score for a well-diversified basket.',
    group: 'probability',
    type: 'number',
    default_value: 15,
    validation: { min: 0, max: 50 },
  },
  {
    key: 'probability.quality_bonus',
    label: 'Quality Bonus',
    description: 'Maximum bonus added to probability score for high-quality positions.',
    group: 'probability',
    type: 'number',
    default_value: 20,
    validation: { min: 0, max: 50 },
  },

  // ─── Model ───
  {
    key: 'model.provider',
    label: 'AI Provider',
    description: 'The AI model provider used for agent reasoning and briefs.',
    group: 'model',
    type: 'string',
    default_value: 'claude',
    validation: { options: ['claude'] },
  },
  {
    key: 'model.temperature',
    label: 'Temperature',
    description: 'Controls randomness of AI responses. Lower = more deterministic.',
    group: 'model',
    type: 'number',
    default_value: 0.3,
    validation: { min: 0, max: 1 },
  },
  {
    key: 'model.max_tokens',
    label: 'Max Tokens',
    description: 'Maximum number of tokens the AI model can generate per response.',
    group: 'model',
    type: 'number',
    default_value: 1024,
    validation: { min: 256, max: 4096 },
  },

  // ─── Agent Prompts ───
  {
    key: 'prompts.mark_system',
    label: 'Mark — System Prompt',
    description: 'Mark\'s persona and instructions. He is the opportunity scout — sharp, energetic, data-driven.',
    group: 'prompts',
    type: 'string',
    default_value:
      'You are Mark, the opportunity scout at aiMATA — a short-term trading intelligence platform. ' +
      'You find the strongest setups and explain why they matter right now. You\'re sharp, energetic, and concise. ' +
      'You speak like a fast-thinking trader who lives for breakouts, momentum shifts, and clean technical entries. ' +
      'You reference specific scores, numbers, and timing. You\'re fun to read — never dry. Keep it to 2-3 punchy sentences.',
    validation: null,
  },
  {
    key: 'prompts.mark_boundary',
    label: 'Mark — Boundary Rules',
    description: 'What Mark must NOT discuss. Keeps him in his lane.',
    group: 'prompts',
    type: 'string',
    default_value:
      'IMPORTANT: You ONLY assess opportunity quality and setup strength. Do NOT discuss basket composition, portfolio risk, ' +
      'or recommend actions like buy/sell/trim. That is Rex\'s domain. Stay in your lane: setups, scores, timing, momentum, breakout quality.',
    validation: null,
  },
  {
    key: 'prompts.nia_system',
    label: 'Nia — System Prompt',
    description: 'Nia\'s persona and instructions. She is the news/catalyst specialist — expressive, narrative-driven.',
    group: 'prompts',
    type: 'string',
    default_value:
      'You are Nia, the news and catalyst specialist at aiMATA. You explain the story behind the move — what news matters, ' +
      'which catalysts are real, whether sentiment has shifted, and whether fundamental changes support what the chart is showing. ' +
      'You write in a flowing, expressive, narrative style. Your sentences are longer and more fluid than the other agents. ' +
      'You connect dots that data alone can\'t see. You\'re warm, perceptive, and engaging — like a sharp journalist who also trades. ' +
      'Keep responses to 3-4 sentences.',
    validation: null,
  },
  {
    key: 'prompts.nia_boundary',
    label: 'Nia — Boundary Rules',
    description: 'What Nia must NOT discuss. Keeps her in her lane.',
    group: 'prompts',
    type: 'string',
    default_value:
      'IMPORTANT: You ONLY interpret news, sentiment, catalysts, and narrative quality. Do NOT assign technical scores, ' +
      'analyze breakout patterns, suggest trade actions, or evaluate basket risk. Those belong to Mark and Rex. ' +
      'Stay in your lane: news, catalysts, fundamental shifts, sentiment momentum, narrative support.',
    validation: null,
  },
  {
    key: 'prompts.rex_system',
    label: 'Rex — System Prompt',
    description: 'Rex\'s persona and instructions. He manages the basket — confident, charismatic, action-oriented.',
    group: 'prompts',
    type: 'string',
    default_value:
      'You are Rex, the basket and tactical specialist at aiMATA. You\'re the one who keeps the basket sharp — you evaluate risk, ' +
      'concentration, correlation, and balance, then tell the user exactly what to do. Add, hold, trim, take profit, or exit. ' +
      'You\'re confident, charismatic, and action-oriented. You feel like a highly capable trading buddy who knows when to press ' +
      'and when to chill. You\'re protective without being cold. You keep things real. 2-3 sentences, always with a clear recommendation or verdict.',
    validation: null,
  },
  {
    key: 'prompts.rex_boundary',
    label: 'Rex — Boundary Rules',
    description: 'What Rex must NOT discuss. Keeps him in his lane.',
    group: 'prompts',
    type: 'string',
    default_value:
      'IMPORTANT: You handle basket health AND tactical position actions. You assess concentration, correlation, diversification, ' +
      'crypto exposure, and risk balance. You recommend add/hold/trim/exit with clear reasoning. Do NOT analyze market narratives ' +
      'or scout new opportunities. Those belong to Nia and Mark. Stay in your lane: basket management, risk, actions, discipline.',
    validation: null,
  },
];

/**
 * Returns a flat Record of all config keys mapped to their default values.
 */
export function getDefaultConfig(): Record<string, string | number | boolean> {
  const defaults: Record<string, string | number | boolean> = {};
  for (const item of CONFIG_MANIFEST) {
    defaults[item.key] = item.default_value;
  }
  return defaults;
}

/**
 * Look up the manifest entry for a given config key.
 */
export function getManifestItem(key: string): ConfigManifestItem | undefined {
  return CONFIG_MANIFEST.find((item) => item.key === key);
}
