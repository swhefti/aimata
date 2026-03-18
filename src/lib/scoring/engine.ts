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
      explanation: buildExplanation(asset, opportunityScore, setupType, opportunityLabel, riskLabel, quote),
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
 * Volatility: inverse of realized volatility. Lower vol = higher score (risk adjusted).
 * Uses 20d close-to-close volatility.
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

  // Lower volatility = higher score
  // <20% annual vol = 80-100
  // 20-40% = 50-80
  // 40-80% = 20-50
  // >80% = 0-20
  if (annualizedVol < 0.20) {
    return clamp(80 + (0.20 - annualizedVol) * 100, 80, 100);
  } else if (annualizedVol < 0.40) {
    return 50 + ((0.40 - annualizedVol) / 0.20) * 30;
  } else if (annualizedVol < 0.80) {
    return 20 + ((0.80 - annualizedVol) / 0.40) * 30;
  } else {
    return clamp(20 - (annualizedVol - 0.80) * 25, 0, 20);
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
  // Hot Now: very recent spike (high 5d momentum + high sentiment)
  const ret5d = periodReturn(sorted, 5);
  if (ret5d > 0.03 && scores.sentiment > 65) {
    return 'Hot Now';
  }

  // Run: sustained uptrend (consistent momentum across timeframes)
  const ret20d = periodReturn(sorted, 20);
  if (ret20d > 0.05 && scores.momentum > 60 && scores.regimeFit > 55) {
    return 'Run';
  }

  // Swing: medium-term opportunity (mean reversion or moderate momentum)
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

  // Combine volatility score and drawdown for risk assessment
  if (volatilityScore < 30 || maxDrawdown > 0.15) return 'High';
  if (volatilityScore < 55 || maxDrawdown > 0.08) return 'Medium';
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
  quote: MarketQuote | undefined
): string {
  const priceInfo = quote ? ` at $${quote.last_price.toFixed(2)} (${quote.pct_change >= 0 ? '+' : ''}${quote.pct_change.toFixed(2)}%)` : '';
  return `${asset.name}${priceInfo} scores ${score}/100 as a ${label} ${setup} setup with ${risk} risk.`;
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
