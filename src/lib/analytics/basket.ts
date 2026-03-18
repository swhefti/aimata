import type {
  BasketPosition,
  BasketAnalytics,
  PriceHistory,
  ConcentrationRisk,
  CorrelationRisk,
  BasketQuality,
} from '@/types';
import type { RuntimeConfig } from '@/lib/config/runtime';
import { getConfigValue } from '@/lib/config/runtime';

/**
 * Compute comprehensive analytics for the current basket.
 */
export function computeBasketAnalytics(
  positions: BasketPosition[],
  priceHistory: PriceHistory[],
  config: RuntimeConfig
): BasketAnalytics {
  if (positions.length === 0) {
    return emptyAnalytics();
  }

  const maxCryptoPct = getConfigValue<number>(config, 'basket.max_crypto_pct');
  const maxSinglePct = getConfigValue<number>(config, 'basket.max_single_position_pct');
  const baseScore = getConfigValue<number>(config, 'probability.base_score');
  const divBonus = getConfigValue<number>(config, 'probability.diversification_bonus');
  const qualityBonus = getConfigValue<number>(config, 'probability.quality_bonus');

  // Effective weights (use manual_weight if set, otherwise target_weight)
  const effectiveWeights = positions.map(
    (p) => p.manual_weight ?? p.target_weight
  );
  const totalWeight = effectiveWeights.reduce((s, w) => s + w, 0);
  const normalizedWeights = totalWeight > 0
    ? effectiveWeights.map((w) => (w / totalWeight) * 100)
    : effectiveWeights;

  // ─── Concentration Risk (HHI-based) ───
  const hhi = computeHHI(normalizedWeights);
  const concentrationRisk = classifyConcentrationRisk(hhi, positions.length);

  // ─── Largest Position ───
  let largestIdx = 0;
  for (let i = 1; i < normalizedWeights.length; i++) {
    if (normalizedWeights[i] > normalizedWeights[largestIdx]) {
      largestIdx = i;
    }
  }
  const largestPositionPct = normalizedWeights[largestIdx];
  const largestPositionTicker = positions[largestIdx].ticker;

  // ─── Crypto Allocation ───
  const cryptoAllocation = positions.reduce((sum, p, i) => {
    return p.asset_type === 'crypto' ? sum + normalizedWeights[i] : sum;
  }, 0);

  // ─── Correlation Risk ───
  const priceMap = groupByTicker(priceHistory);
  const correlationRisk = computeCorrelationRisk(positions, priceMap);

  // ─── Horizon Mix ───
  const horizonMix = computeHorizonMix(positions);

  // ─── Setup Diversity ───
  const setupDiversity = computeSetupDiversity(positions);

  // ─── Expected Upside/Downside from Historical Volatility ───
  const { upsideMin, upsideMax, downside } = computeExpectedRange(
    positions,
    normalizedWeights,
    priceMap
  );

  // ─── Probability Score ───
  const probabilityScore = computeProbabilityScore(
    positions,
    normalizedWeights,
    concentrationRisk,
    correlationRisk,
    setupDiversity,
    baseScore,
    divBonus,
    qualityBonus
  );

  // ─── Basket Quality ───
  const basketQuality = classifyBasketQuality(probabilityScore);

  // ─── Warnings & Suggested Actions ───
  const warnings: string[] = [];
  const suggestedActions: string[] = [];

  if (largestPositionPct > maxSinglePct) {
    warnings.push(
      `${largestPositionTicker} is ${largestPositionPct.toFixed(1)}% of the basket, exceeding the ${maxSinglePct}% cap.`
    );
    suggestedActions.push(`Trim ${largestPositionTicker} to below ${maxSinglePct}%.`);
  }

  if (cryptoAllocation > maxCryptoPct) {
    warnings.push(
      `Crypto allocation is ${cryptoAllocation.toFixed(1)}%, exceeding the ${maxCryptoPct}% cap.`
    );
    suggestedActions.push(`Reduce crypto exposure by ${(cryptoAllocation - maxCryptoPct).toFixed(1)}%.`);
  }

  if (concentrationRisk === 'Critical' || concentrationRisk === 'High') {
    warnings.push(`Basket concentration is ${concentrationRisk.toLowerCase()} (HHI: ${hhi.toFixed(0)}).`);
    suggestedActions.push('Add more positions or rebalance to reduce concentration.');
  }

  if (correlationRisk === 'High') {
    warnings.push('Multiple positions are highly correlated, increasing tail risk.');
    suggestedActions.push('Diversify into uncorrelated sectors or asset types.');
  }

  const highRiskCount = positions.filter((p) => p.risk_label === 'High').length;
  if (highRiskCount > positions.length * 0.5) {
    warnings.push(`${highRiskCount} of ${positions.length} positions are high-risk.`);
    suggestedActions.push('Consider swapping some high-risk positions for lower-risk setups.');
  }

  const losers = positions.filter((p) => p.pnl_pct < -10);
  for (const loser of losers) {
    warnings.push(`${loser.ticker} is down ${Math.abs(loser.pnl_pct).toFixed(1)}%.`);
    suggestedActions.push(`Review ${loser.ticker} for potential exit or averaging down.`);
  }

  if (suggestedActions.length === 0 && positions.length > 0) {
    suggestedActions.push('Basket looks balanced. Monitor for score changes.');
  }

  return {
    probability_score: Math.round(probabilityScore),
    expected_upside_min: Number(upsideMin.toFixed(2)),
    expected_upside_max: Number(upsideMax.toFixed(2)),
    downside_risk: Number(downside.toFixed(2)),
    concentration_risk: concentrationRisk,
    correlation_risk: correlationRisk,
    crypto_allocation: Number(cryptoAllocation.toFixed(2)),
    largest_position_pct: Number(largestPositionPct.toFixed(2)),
    largest_position_ticker: largestPositionTicker,
    basket_quality: basketQuality,
    horizon_mix: horizonMix,
    setup_diversity: setupDiversity,
    warnings,
    suggested_actions: suggestedActions,
  };
}

// ─── HHI & Concentration ───

function computeHHI(weights: number[]): number {
  // Herfindahl-Hirschman Index: sum of squared weights
  // Equal weight across N positions: HHI = 10000/N
  // Single position: HHI = 10000
  return weights.reduce((sum, w) => sum + w * w, 0);
}

function classifyConcentrationRisk(hhi: number, positionCount: number): ConcentrationRisk {
  // HHI thresholds calibrated for typical portfolio sizes
  if (positionCount <= 1 || hhi > 4000) return 'Critical';
  if (hhi > 2500) return 'High';
  if (hhi > 1500) return 'Medium';
  return 'Low';
}

// ─── Correlation Risk ───

function computeCorrelationRisk(
  positions: BasketPosition[],
  priceMap: Map<string, PriceHistory[]>
): CorrelationRisk {
  if (positions.length < 2) return 'Low';

  // Compute pairwise correlations using daily returns
  const returnsByTicker = new Map<string, number[]>();

  for (const pos of positions) {
    const prices = priceMap.get(pos.ticker);
    if (!prices || prices.length < 10) continue;

    const sorted = [...prices].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const returns: number[] = [];
    for (let i = 0; i < sorted.length - 1 && i < 20; i++) {
      if (sorted[i + 1].close > 0) {
        returns.push((sorted[i].close - sorted[i + 1].close) / sorted[i + 1].close);
      }
    }
    if (returns.length > 0) {
      returnsByTicker.set(pos.ticker, returns);
    }
  }

  const tickers = Array.from(returnsByTicker.keys());
  let highCorrelationPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const a = returnsByTicker.get(tickers[i])!;
      const b = returnsByTicker.get(tickers[j])!;
      const minLen = Math.min(a.length, b.length);
      if (minLen < 5) continue;

      const corr = pearsonCorrelation(a.slice(0, minLen), b.slice(0, minLen));
      totalPairs++;
      if (Math.abs(corr) > 0.7) {
        highCorrelationPairs++;
      }
    }
  }

  if (totalPairs === 0) return 'Low';

  const highCorrRatio = highCorrelationPairs / totalPairs;
  if (highCorrRatio > 0.5) return 'High';
  if (highCorrRatio > 0.25) return 'Medium';
  return 'Low';
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;

  return numerator / denom;
}

// ─── Horizon Mix ───

function computeHorizonMix(positions: BasketPosition[]): {
  hot_now: number;
  swing: number;
  run: number;
} {
  const counts = { hot_now: 0, swing: 0, run: 0 };
  // Infer from setup_type and opportunity_score patterns
  for (const p of positions) {
    if (p.setup_type.includes('Momentum') && p.opportunity_score > 75) {
      counts.hot_now++;
    } else if (
      p.setup_type.includes('Trend') ||
      (p.setup_type.includes('Momentum') && p.opportunity_score > 60)
    ) {
      counts.run++;
    } else {
      counts.swing++;
    }
  }
  return counts;
}

// ─── Setup Diversity ───

function computeSetupDiversity(positions: BasketPosition[]): number {
  if (positions.length === 0) return 0;
  const uniqueSetups = new Set(positions.map((p) => p.setup_type));
  // Diversity as a count of unique setups, capped at number of possible types
  return uniqueSetups.size;
}

// ─── Expected Range ───

function computeExpectedRange(
  positions: BasketPosition[],
  weights: number[],
  priceMap: Map<string, PriceHistory[]>
): { upsideMin: number; upsideMax: number; downside: number } {
  // Portfolio-weighted expected range based on historical volatility
  let weightedVolSum = 0;
  let weightedReturnSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < positions.length; i++) {
    const prices = priceMap.get(positions[i].ticker);
    if (!prices || prices.length < 5) continue;

    const sorted = [...prices].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const returns: number[] = [];
    for (let j = 0; j < sorted.length - 1 && j < 20; j++) {
      if (sorted[j + 1].close > 0) {
        returns.push((sorted[j].close - sorted[j + 1].close) / sorted[j + 1].close);
      }
    }

    if (returns.length < 3) continue;

    const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / returns.length;
    const dailyVol = Math.sqrt(variance);

    const w = weights[i] / 100;
    weightedVolSum += dailyVol * w;
    weightedReturnSum += meanReturn * w;
    totalWeight += w;
  }

  if (totalWeight === 0) {
    return { upsideMin: 0, upsideMax: 0, downside: 0 };
  }

  const portfolioVol = weightedVolSum; // simplified (ignores correlation reduction)
  const portfolioReturn = weightedReturnSum;

  // Project over ~20 trading days
  const horizon = 20;
  const expectedReturn = portfolioReturn * horizon;
  const expectedVol = portfolioVol * Math.sqrt(horizon);

  return {
    upsideMin: (expectedReturn + expectedVol * 0.5) * 100,    // 0.5 sigma upside (conservative)
    upsideMax: (expectedReturn + expectedVol * 1.5) * 100,    // 1.5 sigma upside (optimistic)
    downside: Math.abs(expectedReturn - expectedVol * 1.5) * 100, // 1.5 sigma downside
  };
}

// ─── Probability Score ───

function computeProbabilityScore(
  positions: BasketPosition[],
  weights: number[],
  concentrationRisk: ConcentrationRisk,
  correlationRisk: CorrelationRisk,
  setupDiversity: number,
  baseScore: number,
  divBonus: number,
  qualityBonus: number
): number {
  let score = baseScore;

  // Diversification bonus: more positions + more diverse setups = higher bonus
  const positionCountFactor = Math.min(positions.length / 10, 1); // max benefit at 10 positions
  const diversityFactor = Math.min(setupDiversity / 5, 1); // max benefit at 5 unique setups
  score += divBonus * ((positionCountFactor + diversityFactor) / 2);

  // Quality bonus: based on average opportunity score of positions
  const avgOpScore =
    positions.reduce((sum, p, i) => sum + p.opportunity_score * (weights[i] / 100), 0) /
    (weights.reduce((s, w) => s + w, 0) / 100 || 1);
  const qualityFactor = Math.max(0, (avgOpScore - 50) / 50); // only bonus if avg > 50
  score += qualityBonus * qualityFactor;

  // Penalties
  const concentrationPenalty: Record<ConcentrationRisk, number> = {
    Low: 0,
    Medium: -5,
    High: -12,
    Critical: -20,
  };
  score += concentrationPenalty[concentrationRisk];

  const correlationPenalty: Record<CorrelationRisk, number> = {
    Low: 0,
    Medium: -5,
    High: -12,
  };
  score += correlationPenalty[correlationRisk];

  // P&L penalty: drag score if basket is heavily in the red
  const avgPnlPct =
    positions.reduce((sum, p) => sum + p.pnl_pct, 0) / positions.length;
  if (avgPnlPct < -5) {
    score += Math.max(-15, avgPnlPct); // cap penalty at -15
  }

  return clamp(score, 0, 100);
}

// ─── Quality Classification ───

function classifyBasketQuality(probabilityScore: number): BasketQuality {
  if (probabilityScore >= 75) return 'Strong';
  if (probabilityScore >= 60) return 'Good';
  if (probabilityScore >= 40) return 'Fair';
  return 'Weak';
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

function emptyAnalytics(): BasketAnalytics {
  return {
    probability_score: 0,
    expected_upside_min: 0,
    expected_upside_max: 0,
    downside_risk: 0,
    concentration_risk: 'Critical',
    correlation_risk: 'Low',
    crypto_allocation: 0,
    largest_position_pct: 0,
    largest_position_ticker: '',
    basket_quality: 'Weak',
    horizon_mix: { hot_now: 0, swing: 0, run: 0 },
    setup_diversity: 0,
    warnings: ['Basket is empty.'],
    suggested_actions: ['Add positions to begin building the basket.'],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
