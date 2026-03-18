import type { BasketPosition } from '@/types';
import type { RuntimeConfig } from '@/lib/config/runtime';
import { getConfigValue } from '@/lib/config/runtime';

/**
 * Auto-weight basket positions based on opportunity scores.
 * Applies caps for crypto allocation and single position concentration,
 * then normalizes all weights to sum to 100%.
 *
 * Positions with a manual_weight set are left unchanged; only target_weight
 * is recalculated for auto-weighted positions.
 */
export function autoWeight(
  positions: BasketPosition[],
  config: RuntimeConfig
): BasketPosition[] {
  if (positions.length === 0) return [];

  const maxCryptoPct = getConfigValue<number>(config, 'basket.max_crypto_pct');
  const maxSinglePct = getConfigValue<number>(config, 'basket.max_single_position_pct');

  // Separate manual and auto positions
  const manualPositions = positions.filter((p) => p.manual_weight !== null);
  const autoPositions = positions.filter((p) => p.manual_weight === null);

  // Manual weights are fixed - compute how much weight is already claimed
  const manualWeightSum = manualPositions.reduce(
    (sum, p) => sum + (p.manual_weight ?? 0),
    0
  );
  const remainingWeight = Math.max(0, 100 - manualWeightSum);

  if (autoPositions.length === 0) {
    // All manual, just return with target_weight = manual_weight
    return positions.map((p) => ({
      ...p,
      target_weight: p.manual_weight ?? p.target_weight,
    }));
  }

  // ─── Step 1: Raw Score-Based Weights ───
  // Use opportunity_score as the raw weight signal.
  // Floor at 10 to ensure every position gets some allocation.
  const rawScores = autoPositions.map((p) => Math.max(p.opportunity_score, 10));
  const rawTotal = rawScores.reduce((s, v) => s + v, 0);

  let weights = rawScores.map((score) => (score / rawTotal) * remainingWeight);

  // ─── Step 2: Cap Single Position ───
  weights = capSinglePositions(weights, maxSinglePct);

  // ─── Step 3: Cap Crypto Allocation ───
  weights = capCryptoAllocation(autoPositions, weights, maxCryptoPct, manualPositions);

  // ─── Step 4: Normalize to Remaining Weight ───
  const autoWeightSum = weights.reduce((s, w) => s + w, 0);
  if (autoWeightSum > 0 && Math.abs(autoWeightSum - remainingWeight) > 0.01) {
    const scale = remainingWeight / autoWeightSum;
    weights = weights.map((w) => w * scale);
  }

  // Re-apply single position cap after normalization (iterative)
  weights = capSinglePositions(weights, maxSinglePct);

  // Final normalization pass
  const finalAutoSum = weights.reduce((s, w) => s + w, 0);
  if (finalAutoSum > 0 && Math.abs(finalAutoSum - remainingWeight) > 0.01) {
    const scale = remainingWeight / finalAutoSum;
    weights = weights.map((w) => w * scale);
  }

  // ─── Build Result ───
  const autoResult = autoPositions.map((p, i) => ({
    ...p,
    target_weight: Number(weights[i].toFixed(2)),
  }));

  const manualResult = manualPositions.map((p) => ({
    ...p,
    target_weight: Number((p.manual_weight ?? p.target_weight).toFixed(2)),
  }));

  // Return in original order
  const resultMap = new Map<string, BasketPosition>();
  for (const p of [...autoResult, ...manualResult]) {
    resultMap.set(p.ticker, p);
  }

  return positions.map((p) => resultMap.get(p.ticker)!);
}

/**
 * Cap any individual position at maxPct, redistributing excess
 * proportionally to uncapped positions.
 */
function capSinglePositions(weights: number[], maxPct: number): number[] {
  const result = [...weights];
  let redistributionNeeded = true;
  let iterations = 0;

  while (redistributionNeeded && iterations < 10) {
    redistributionNeeded = false;
    let excess = 0;
    let uncappedSum = 0;
    const capped = new Set<number>();

    for (let i = 0; i < result.length; i++) {
      if (result[i] > maxPct) {
        excess += result[i] - maxPct;
        result[i] = maxPct;
        capped.add(i);
        redistributionNeeded = true;
      } else {
        uncappedSum += result[i];
      }
    }

    if (excess > 0 && uncappedSum > 0) {
      for (let i = 0; i < result.length; i++) {
        if (!capped.has(i)) {
          result[i] += (result[i] / uncappedSum) * excess;
        }
      }
    }

    iterations++;
  }

  return result;
}

/**
 * Cap total crypto allocation, scaling down crypto positions proportionally
 * if they exceed the maximum allowed percentage.
 */
function capCryptoAllocation(
  autoPositions: BasketPosition[],
  weights: number[],
  maxCryptoPct: number,
  manualPositions: BasketPosition[]
): number[] {
  // Account for crypto already allocated via manual weights
  const manualCrypto = manualPositions
    .filter((p) => p.asset_type === 'crypto')
    .reduce((sum, p) => sum + (p.manual_weight ?? 0), 0);

  const effectiveMaxCrypto = Math.max(0, maxCryptoPct - manualCrypto);

  const result = [...weights];

  // Sum crypto allocation in auto positions
  let cryptoSum = 0;
  const cryptoIndices: number[] = [];
  const stockIndices: number[] = [];

  for (let i = 0; i < autoPositions.length; i++) {
    if (autoPositions[i].asset_type === 'crypto') {
      cryptoSum += result[i];
      cryptoIndices.push(i);
    } else {
      stockIndices.push(i);
    }
  }

  if (cryptoSum > effectiveMaxCrypto && cryptoIndices.length > 0) {
    const scaleFactor = effectiveMaxCrypto / cryptoSum;
    const excessWeight = cryptoSum - effectiveMaxCrypto;

    // Scale down crypto positions
    for (const idx of cryptoIndices) {
      result[idx] *= scaleFactor;
    }

    // Redistribute excess to stock positions proportionally
    if (stockIndices.length > 0) {
      const stockSum = stockIndices.reduce((sum, idx) => sum + result[idx], 0);
      if (stockSum > 0) {
        for (const idx of stockIndices) {
          result[idx] += (result[idx] / stockSum) * excessWeight;
        }
      }
    }
  }

  return result;
}
