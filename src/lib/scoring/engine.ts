import type {
  Asset,
  PriceHistory,
  MarketQuote,
  FundamentalData,
  OpportunityScore,
  OpportunityLabel,
  RiskLabel,
} from '@/types';
import type { RuntimeConfig } from '@/lib/config/runtime';
import { getConfigValue } from '@/lib/config/runtime';

/**
 * Compute opportunity scores for all eligible (non-ETF, active) assets.
 */
export function computeOpportunityScores(
  assets: Asset[],
  priceHistory: PriceHistory[],
  quotes: MarketQuote[],
  fundamentals: FundamentalData[],
  config: RuntimeConfig
): OpportunityScore[] {
  const eligible = assets.filter((a) => a.active && (a.asset_type === 'stock' || a.asset_type === 'crypto'));

  // Index data by ticker for fast lookup
  const priceMap = groupByTicker(priceHistory);
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));
  const fundMap = new Map(fundamentals.map((f) => [f.ticker, f]));

  // Load weights from config
  const weights = {
    momentum: getConfigValue<number>(config, 'scoring.momentum_weight'),
    breakout: getConfigValue<number>(config, 'scoring.breakout_weight'),
    mean_reversion: getConfigValue<number>(config, 'scoring.mean_reversion_weight'),
    catalyst: getConfigValue<number>(config, 'scoring.catalyst_weight'),
    sentiment: getConfigValue<number>(config, 'scoring.sentiment_weight'),
    volatility: getConfigValue<number>(config, 'scoring.volatility_weight'),
    regime_fit: getConfigValue<number>(config, 'scoring.regime_fit_weight'),
  };

  // Validate weights sum to ~1.0
  const weightSum = Object.values(weights).reduce((s, w) => s + w, 0);
  if (weightSum < 0.95 || weightSum > 1.05) {
    console.warn(`Scoring weights sum to ${weightSum.toFixed(3)}, expected ~1.0. Results may be skewed.`);
  }

  const scores: OpportunityScore[] = [];
  const now = new Date().toISOString();

  for (const asset of eligible) {
    const prices = priceMap.get(asset.ticker);
    if (!prices || prices.length < 5) continue; // need minimum history

    const quote = quoteMap.get(asset.ticker);
    const fund = fundMap.get(asset.ticker);

    // Sort prices by date descending (most recent first)
    const sorted = [...prices].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const momentum = computeMomentumScore(sorted);
    const breakout = computeBreakoutScore(sorted);
    const meanReversion = computeMeanReversionScore(sorted);
    const catalyst = computeCatalystScore(fund);
    const sentiment = computeSentimentScore(sorted);
    const volatility = computeVolatilityScore(sorted);
    const regimeFit = computeRegimeFitScore(sorted);

    const composite =
      momentum * weights.momentum +
      breakout * weights.breakout +
      meanReversion * weights.mean_reversion +
      catalyst * weights.catalyst +
      sentiment * weights.sentiment +
      volatility * weights.volatility +
      regimeFit * weights.regime_fit;

    const opportunityScore = clamp(Math.round(composite), 0, 100);

    const componentScores = { momentum, breakout, meanReversion, catalyst, sentiment, volatility, regimeFit };
    const opportunityLabel = deriveOpportunityLabel(componentScores, sorted);
    const riskLabel = deriveRiskLabel(sorted, volatility);
    const setupType = deriveDominantSetup(componentScores, weights);
    const horizonDays = deriveHorizonDays(opportunityLabel);

    scores.push({
      ticker: asset.ticker,
      asset_name: asset.name,
      asset_type: asset.asset_type,
      sector: asset.sector,
      opportunity_score: opportunityScore,
      momentum_score: Math.round(momentum),
      breakout_score: Math.round(breakout),
      mean_reversion_score: Math.round(meanReversion),
      catalyst_score: Math.round(catalyst),
      sentiment_score: Math.round(sentiment),
      volatility_score: Math.round(volatility),
      regime_fit_score: Math.round(regimeFit),
      opportunity_label: opportunityLabel,
      risk_label: riskLabel,
      setup_type: setupType,
      explanation: buildExplanation(asset, opportunityScore, setupType, opportunityLabel, riskLabel, quote, componentScores),
      agent_tag: 'Mark',
      scored_at: now,
      horizon_days: horizonDays,
    });
  }

  // Sort by opportunity score descending
  scores.sort((a, b) => b.opportunity_score - a.opportunity_score);

  return scores;
}

// ─── Score Component Calculators ───

/**
 * Momentum: based on 5d, 10d, 20d returns from price history.
 * Positive and accelerating recent returns yield higher scores.
 */
function computeMomentumScore(sorted: PriceHistory[]): number {
  const ret5d = periodReturn(sorted, 5);
  const ret10d = periodReturn(sorted, 10);
  const ret20d = periodReturn(sorted, 20);

  // Weight recent returns more heavily
  const rawMomentum = ret5d * 0.50 + ret10d * 0.30 + ret20d * 0.20;

  // Acceleration bonus: 5d return > 10d return means accelerating
  const acceleration = ret5d > ret10d ? 10 : 0;

  // Map to 0-100: returns of -10% to +10% map to 0-100
  const normalized = ((rawMomentum + 10) / 20) * 100 + acceleration;

  return clamp(normalized, 0, 100);
}

/**
 * Breakout: is the current price near the 20-day high?
 * Within 2% of high = strong breakout signal.
 */
function computeBreakoutScore(sorted: PriceHistory[]): number {
  const window = sorted.slice(0, Math.min(20, sorted.length));
  const currentPrice = sorted[0].close;
  const high20d = Math.max(...window.map((p) => p.high));

  if (high20d === 0) return 50;

  const distanceFromHigh = (high20d - currentPrice) / high20d;

  // Within 2% of high = score 90-100
  // 2-5% below = 70-90
  // 5-10% below = 40-70
  // >10% below = 10-40
  if (distanceFromHigh <= 0.02) {
    return 90 + (1 - distanceFromHigh / 0.02) * 10;
  } else if (distanceFromHigh <= 0.05) {
    return 70 + ((0.05 - distanceFromHigh) / 0.03) * 20;
  } else if (distanceFromHigh <= 0.10) {
    return 40 + ((0.10 - distanceFromHigh) / 0.05) * 30;
  } else {
    return clamp(40 - (distanceFromHigh - 0.10) * 200, 0, 40);
  }
}

/**
 * Mean Reversion: how far is the current price below its 20d SMA?
 * Significantly below SMA = higher reversion opportunity.
 */
function computeMeanReversionScore(sorted: PriceHistory[]): number {
  const window = sorted.slice(0, Math.min(20, sorted.length));
  const sma20 = window.reduce((sum, p) => sum + p.close, 0) / window.length;
  const currentPrice = sorted[0].close;

  if (sma20 === 0) return 50;

  const deviation = (currentPrice - sma20) / sma20;

  // Below SMA: reversion opportunity (negative deviation = higher score)
  // 5%+ below SMA = high score (80-100)
  // 2-5% below = moderate (60-80)
  // Near SMA = neutral (40-60)
  // Above SMA = low reversion opportunity (0-40)
  if (deviation <= -0.05) {
    return clamp(80 + Math.abs(deviation + 0.05) * 400, 80, 100);
  } else if (deviation <= -0.02) {
    return 60 + ((Math.abs(deviation) - 0.02) / 0.03) * 20;
  } else if (deviation <= 0.02) {
    return 40 + ((0.02 - deviation) / 0.04) * 20;
  } else {
    return clamp(40 - (deviation - 0.02) * 300, 0, 40);
  }
}

/**
 * Catalyst: derived from fundamental quality since we have no news table.
 * Strong revenue growth + high margins = catalyst potential.
 */
function computeCatalystScore(fund: FundamentalData | undefined): number {
  if (!fund) return 50; // neutral if no fundamentals (e.g., crypto)

  let score = 50;

  // Revenue growth contribution (up to +25)
  if (fund.revenue_growth_yoy !== null) {
    if (fund.revenue_growth_yoy > 0.30) score += 25;
    else if (fund.revenue_growth_yoy > 0.15) score += 18;
    else if (fund.revenue_growth_yoy > 0.05) score += 10;
    else if (fund.revenue_growth_yoy > 0) score += 5;
    else score -= 10;
  }

  // Profit margin contribution (up to +15)
  if (fund.profit_margin !== null) {
    if (fund.profit_margin > 0.20) score += 15;
    else if (fund.profit_margin > 0.10) score += 10;
    else if (fund.profit_margin > 0) score += 5;
    else score -= 10;
  }

  // ROE contribution (up to +10)
  if (fund.roe !== null) {
    if (fund.roe > 0.20) score += 10;
    else if (fund.roe > 0.10) score += 5;
    else if (fund.roe < 0) score -= 10;
  }

  return clamp(score, 0, 100);
}

/**
 * Sentiment: based on recent volume relative to average volume.
 * Volume spike = high sentiment activity = higher score.
 */
function computeSentimentScore(sorted: PriceHistory[]): number {
  if (sorted.length < 10) return 50;

  const recentVol = average(sorted.slice(0, 3).map((p) => p.volume));
  const avgVol = average(sorted.slice(0, Math.min(20, sorted.length)).map((p) => p.volume));

  if (avgVol === 0) return 50;

  const volumeRatio = recentVol / avgVol;

  // Volume ratio 1.0 = normal (50), 2.0+ = high activity (80-100), <0.5 = low (20-40)
  if (volumeRatio >= 2.0) {
    return clamp(80 + (volumeRatio - 2.0) * 10, 80, 100);
  } else if (volumeRatio >= 1.0) {
    return 50 + (volumeRatio - 1.0) * 30;
  } else {
    return clamp(50 * volumeRatio, 10, 50);
  }
}

/**
 * Volatility: risk-adjusted volatility score.
 * Rewards controlled volatility (sweet spot), penalizes both extremes.
 * Very low vol = boring (score 40-60). Moderate vol = opportunity (60-90).
 * Very high vol = dangerous (20-40). Extreme vol = reckless (0-20).
 *
 * This avoids penalizing momentum setups that have healthy vol,
 * while still flagging truly dangerous whipsaw assets.
 */
function computeVolatilityScore(sorted: PriceHistory[]): number {
  const window = sorted.slice(0, Math.min(20, sorted.length));
  if (window.length < 3) return 50;

  const returns: number[] = [];
  for (let i = 0; i < window.length - 1; i++) {
    if (window[i + 1].close > 0) {
      returns.push((window[i].close - window[i + 1].close) / window[i + 1].close);
    }
  }

  if (returns.length === 0) return 50;

  const mean = average(returns);
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252);

  // Sweet spot model: moderate vol (20-50%) = best for short-term trading
  // <15% = too boring (40-55)
  // 15-30% = good controlled vol (70-90)
  // 30-50% = acceptable, higher reward potential (50-70)
  // 50-80% = risky (25-50)
  // >80% = dangerous (0-25)
  if (annualizedVol < 0.15) {
    return clamp(40 + annualizedVol * 100, 40, 55);
  } else if (annualizedVol < 0.30) {
    return clamp(70 + ((annualizedVol - 0.15) / 0.15) * 20, 70, 90);
  } else if (annualizedVol < 0.50) {
    return clamp(70 - ((annualizedVol - 0.30) / 0.20) * 20, 50, 70);
  } else if (annualizedVol < 0.80) {
    return clamp(50 - ((annualizedVol - 0.50) / 0.30) * 25, 25, 50);
  } else {
    return clamp(25 - (annualizedVol - 0.80) * 50, 0, 25);
  }
}

/**
 * Regime Fit: does the asset's trend direction match the broader trend?
 * Uses the 50d trend direction. Assets moving with trend score higher.
 */
function computeRegimeFitScore(sorted: PriceHistory[]): number {
  const window50 = sorted.slice(0, Math.min(50, sorted.length));
  const window20 = sorted.slice(0, Math.min(20, sorted.length));

  if (window50.length < 10 || window20.length < 5) return 50;

  // Macro trend: 50d direction
  const trend50 = (window50[0].close - window50[window50.length - 1].close) / window50[window50.length - 1].close;
  // Asset's 20d trend
  const trend20 = (window20[0].close - window20[window20.length - 1].close) / window20[window20.length - 1].close;

  // Same direction = good regime fit
  const sameDirection = (trend50 > 0 && trend20 > 0) || (trend50 < 0 && trend20 < 0);

  // Trend strength amplifies score
  const trendStrength = Math.abs(trend20);

  if (sameDirection) {
    // Moving with macro: 60-100 based on strength
    return clamp(60 + trendStrength * 200, 60, 100);
  } else {
    // Counter-trend: 20-50, slightly lower but not terrible (contrarian)
    return clamp(50 - trendStrength * 150, 20, 50);
  }
}

// ─── Label Derivation ───

interface ComponentScores {
  momentum: number;
  breakout: number;
  meanReversion: number;
  catalyst: number;
  sentiment: number;
  volatility: number;
  regimeFit: number;
}

function deriveOpportunityLabel(
  scores: ComponentScores,
  sorted: PriceHistory[]
): OpportunityLabel {
  // Hot Now: strong short-term momentum + breakout near highs
  // Uses momentum and breakout scores which are more reliable than raw sentiment
  if (scores.momentum >= 80 && scores.breakout >= 70) {
    return 'Hot Now';
  }
  // Also Hot Now if extremely strong momentum alone
  if (scores.momentum >= 90) {
    return 'Hot Now';
  }

  // Run: sustained trend with regime fit
  // Good momentum + strong regime alignment = sustained move
  if (scores.momentum >= 60 && scores.regimeFit >= 65 && scores.breakout >= 50) {
    return 'Run';
  }
  // Also Run if strong regime fit with decent catalyst
  if (scores.regimeFit >= 70 && scores.catalyst >= 60 && scores.momentum >= 50) {
    return 'Run';
  }

  // Everything else is Swing
  return 'Swing';
}

function deriveRiskLabel(sorted: PriceHistory[], volatilityScore: number): RiskLabel {
  // Check max drawdown in recent 20 days
  const window = sorted.slice(0, Math.min(20, sorted.length));
  let peak = window[window.length - 1].close;
  let maxDrawdown = 0;

  for (let i = window.length - 2; i >= 0; i--) {
    peak = Math.max(peak, window[i].close);
    const drawdown = (peak - window[i].close) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Both high volatility AND significant drawdown = High risk
  // Either one alone = Medium. Neither = Low.
  if (volatilityScore < 30 && maxDrawdown > 0.10) return 'High';
  if (maxDrawdown > 0.15) return 'High'; // severe drawdown alone is high risk
  if (volatilityScore < 40 || maxDrawdown > 0.08) return 'Medium';
  return 'Low';
}

function deriveDominantSetup(
  scores: ComponentScores,
  weights: Record<string, number>
): string {
  const weighted: [string, number][] = [
    ['Momentum', scores.momentum * (weights.momentum || 0.25)],
    ['Breakout', scores.breakout * (weights.breakout || 0.20)],
    ['Mean Reversion', scores.meanReversion * (weights.mean_reversion || 0.10)],
    ['Catalyst', scores.catalyst * (weights.catalyst || 0.15)],
    ['Sentiment', scores.sentiment * (weights.sentiment || 0.10)],
    ['Low Vol', scores.volatility * (weights.volatility || 0.10)],
    ['Trend', scores.regimeFit * (weights.regime_fit || 0.10)],
  ];

  weighted.sort((a, b) => b[1] - a[1]);
  return weighted[0][0];
}

function deriveHorizonDays(label: OpportunityLabel): number {
  switch (label) {
    case 'Hot Now':
      return 3;
    case 'Swing':
      return 10;
    case 'Run':
      return 30;
  }
}

function buildExplanation(
  asset: Asset,
  score: number,
  setup: string,
  label: OpportunityLabel,
  risk: RiskLabel,
  quote: MarketQuote | undefined,
  components: ComponentScores
): string {
  const parts: string[] = [];

  // Lead with price context
  if (quote) {
    const dir = quote.pct_change >= 0 ? 'up' : 'down';
    parts.push(`${asset.name} is ${dir} ${Math.abs(quote.pct_change * 100).toFixed(1)}% at $${quote.last_price.toFixed(2)}.`);
  }

  // Explain the dominant driver
  if (setup === 'Momentum' && components.momentum >= 70) {
    parts.push(`Strong momentum across multiple timeframes — the move is accelerating.`);
  } else if (setup === 'Breakout' && components.breakout >= 70) {
    parts.push(`Trading near the 20-day high with breakout structure forming.`);
  } else if (setup === 'Mean Reversion' && components.meanReversion >= 65) {
    parts.push(`Well below the 20-day average — potential reversion opportunity.`);
  } else if (setup === 'Catalyst' && components.catalyst >= 65) {
    parts.push(`Backed by strong fundamentals — revenue growth and margins support the move.`);
  } else if (setup === 'Trend' && components.regimeFit >= 65) {
    parts.push(`Aligned with the broader market trend — regime fit is strong.`);
  } else {
    parts.push(`${setup} setup with balanced scoring across components.`);
  }

  // Add secondary signal if notable
  const sorted = [
    { name: 'momentum', val: components.momentum },
    { name: 'breakout', val: components.breakout },
    { name: 'catalyst', val: components.catalyst },
    { name: 'sentiment', val: components.sentiment },
  ].sort((a, b) => b.val - a.val);

  if (sorted[1].val >= 65 && sorted[1].name !== setup.toLowerCase()) {
    const secondary = sorted[1].name;
    if (secondary === 'momentum') parts.push(`Momentum is also strong (${sorted[1].val}).`);
    else if (secondary === 'breakout') parts.push(`Near breakout levels too (${sorted[1].val}).`);
    else if (secondary === 'catalyst') parts.push(`Fundamentals add support (${sorted[1].val}).`);
    else if (secondary === 'sentiment') parts.push(`Volume confirms market attention (${sorted[1].val}).`);
  }

  // Risk context
  if (risk === 'Low') parts.push(`Risk is contained — controlled volatility.`);
  else if (risk === 'High') parts.push(`Elevated risk — manage position size.`);

  return parts.join(' ');
}

// ─── Helpers ───

function groupByTicker(prices: PriceHistory[]): Map<string, PriceHistory[]> {
  const map = new Map<string, PriceHistory[]>();
  for (const p of prices) {
    const list = map.get(p.ticker);
    if (list) {
      list.push(p);
    } else {
      map.set(p.ticker, [p]);
    }
  }
  return map;
}

function periodReturn(sorted: PriceHistory[], days: number): number {
  if (sorted.length < days) return 0;
  const current = sorted[0].close;
  const past = sorted[Math.min(days - 1, sorted.length - 1)].close;
  if (past === 0) return 0;
  return (current - past) / past;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
