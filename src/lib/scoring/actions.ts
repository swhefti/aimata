import type { BasketPosition } from '@/types';

export type PositionAction = 'Strong Buy' | 'Add' | 'Hold' | 'Watch' | 'Trim' | 'Take Profit' | 'Exit';

export interface PositionSignal {
  ticker: string;
  action: PositionAction;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Compute Rex's action signal for each basket position.
 * Based on P&L, opportunity score, risk, and position characteristics.
 */
export function computePositionActions(positions: BasketPosition[]): PositionSignal[] {
  return positions.map((p) => {
    const pnlPct = p.pnl_pct;
    const score = p.opportunity_score;
    const risk = p.risk_label;

    // Exit signals
    if (pnlPct < -15) {
      return { ticker: p.ticker, action: 'Exit' as PositionAction, reason: `Down ${Math.abs(pnlPct).toFixed(1)}%. Cut the loss.`, urgency: 'high' as const };
    }
    if (pnlPct < -8 && risk === 'High') {
      return { ticker: p.ticker, action: 'Exit' as PositionAction, reason: `High-risk position down ${Math.abs(pnlPct).toFixed(1)}%. Don't hold losers.`, urgency: 'high' as const };
    }

    // Take Profit signals
    if (pnlPct > 25) {
      return { ticker: p.ticker, action: 'Take Profit' as PositionAction, reason: `Up ${pnlPct.toFixed(1)}%. Lock in gains before it fades.`, urgency: 'high' as const };
    }
    if (pnlPct > 15 && risk === 'High') {
      return { ticker: p.ticker, action: 'Take Profit' as PositionAction, reason: `+${pnlPct.toFixed(1)}% on a high-risk setup. Take some off the table.`, urgency: 'medium' as const };
    }
    if (pnlPct > 10) {
      return { ticker: p.ticker, action: 'Trim' as PositionAction, reason: `+${pnlPct.toFixed(1)}%. Consider trimming to lock partial gains.`, urgency: 'medium' as const };
    }

    // Watch signals
    if (pnlPct < -5) {
      return { ticker: p.ticker, action: 'Watch' as PositionAction, reason: `Down ${Math.abs(pnlPct).toFixed(1)}%. Weakening — watch for further decline.`, urgency: 'medium' as const };
    }
    if (score < 45) {
      return { ticker: p.ticker, action: 'Watch' as PositionAction, reason: `Score dropped to ${score}. Setup may be deteriorating.`, urgency: 'medium' as const };
    }

    // Add signals
    if (pnlPct > 2 && pnlPct < 8 && score >= 70 && risk !== 'High') {
      return { ticker: p.ticker, action: 'Add' as PositionAction, reason: `Strong score (${score}) and trending. Could add to winner.`, urgency: 'low' as const };
    }
    if (score >= 80 && pnlPct >= 0) {
      return { ticker: p.ticker, action: 'Strong Buy' as PositionAction, reason: `Exceptional score (${score}). Setup is firing on all cylinders.`, urgency: 'low' as const };
    }

    // Default: Hold
    return { ticker: p.ticker, action: 'Hold' as PositionAction, reason: `Position is within normal range. Stay patient.`, urgency: 'low' as const };
  });
}

/**
 * Get the color and icon for a position action.
 */
export function getActionStyle(action: PositionAction): { color: string; bg: string; icon: string } {
  switch (action) {
    case 'Strong Buy': return { color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: '⬆⬆' };
    case 'Add': return { color: 'text-green-600', bg: 'bg-green-500/10', icon: '➕' };
    case 'Hold': return { color: 'text-blue-600', bg: 'bg-blue-500/10', icon: '✊' };
    case 'Watch': return { color: 'text-amber-600', bg: 'bg-amber-500/10', icon: '👀' };
    case 'Trim': return { color: 'text-orange-600', bg: 'bg-orange-500/10', icon: '✂️' };
    case 'Take Profit': return { color: 'text-purple-600', bg: 'bg-purple-500/10', icon: '💰' };
    case 'Exit': return { color: 'text-red-600', bg: 'bg-red-500/10', icon: '🚪' };
  }
}
