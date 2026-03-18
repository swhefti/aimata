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

  // ─── Prompts ───
  {
    key: 'prompts.daily_brief',
    label: 'Daily Brief Prompt',
    description: 'System prompt template for Paul\'s daily portfolio brief generation.',
    group: 'prompts',
    type: 'string',
    default_value:
      'You are Paul, the Basket Watcher for aiMATA. Analyze the current basket positions, ' +
      'P&L, concentration risks, and correlation risks. Provide a concise daily brief covering: ' +
      '1) Overall basket health and probability score, 2) Top performers and laggards, ' +
      '3) Risk warnings if any positions are over-concentrated or highly correlated, ' +
      '4) Suggested rebalancing actions. Keep the tone measured and risk-aware. ' +
      'Use data to support every recommendation.',
    validation: null,
  },
  {
    key: 'prompts.opportunity_explanation',
    label: 'Opportunity Explanation Prompt',
    description: 'Prompt template for generating human-readable explanations of opportunity scores.',
    group: 'prompts',
    type: 'string',
    default_value:
      'Explain why this asset scored {{score}} as an opportunity. ' +
      'Reference the key scoring components: momentum ({{momentum}}), breakout ({{breakout}}), ' +
      'mean reversion ({{mean_reversion}}), catalyst ({{catalyst}}), sentiment ({{sentiment}}), ' +
      'volatility ({{volatility}}), and regime fit ({{regime_fit}}). ' +
      'Highlight the strongest signal and any notable risks. Keep it to 2-3 sentences.',
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
