'use client';

import AgentAvatar from '@/components/ui/AgentAvatar';
import type { BasketPosition, BasketAnalytics } from '@/types';

interface BasketNarrativeProps {
  positions: BasketPosition[];
  analytics: BasketAnalytics | null;
}

export default function BasketNarrative({ positions, analytics }: BasketNarrativeProps) {
  if (positions.length === 0 || !analytics) return null;

  const narratives = generateNarratives(positions, analytics);
  if (narratives.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <AgentAvatar agentName="Paul" size="xs" />
        <span className="text-[10px] font-black text-blue-900/60 uppercase tracking-wider">Paul&apos;s Basket Review</span>
      </div>
      <div className="space-y-1.5">
        {narratives.map((n, i) => (
          <p key={i} className="text-[11px] text-blue-900/80 leading-snug">
            {n}
          </p>
        ))}
      </div>
    </div>
  );
}

function generateNarratives(positions: BasketPosition[], a: BasketAnalytics): string[] {
  const lines: string[] = [];

  // Concentration narrative
  if (a.concentration_risk === 'Critical') {
    if (positions.length === 1) {
      lines.push(`You're all-in on ${positions[0].ticker}. That's not a basket, that's a bet.`);
    } else {
      lines.push(`${a.largest_position_ticker} is ${a.largest_position_pct.toFixed(0)}% of your basket. One bad day there and the whole thing bleeds.`);
    }
  } else if (a.concentration_risk === 'High') {
    lines.push(`Your basket leans heavy on ${a.largest_position_ticker} at ${a.largest_position_pct.toFixed(0)}%. I'd feel better with that under 25%.`);
  }

  // Correlation narrative
  if (a.correlation_risk === 'High') {
    const sectors = [...new Set(positions.map(p => p.asset_type))];
    if (sectors.length === 1) {
      lines.push(`Everything in here is ${sectors[0]}. When it sells off, they'll all sell off together. Diversify.`);
    } else {
      lines.push(`Several of these positions move together. You think you're diversified, but you're basically running the same trade multiple times.`);
    }
  }

  // Crypto narrative
  if (a.crypto_allocation > 35) {
    lines.push(`${a.crypto_allocation.toFixed(0)}% crypto is aggressive. These are the most volatile names in the basket — make sure you can stomach the swings.`);
  }

  // Quality narrative
  if (a.basket_quality === 'Strong') {
    lines.push(`Overall, this is a well-constructed basket. Good mix of setups, reasonable risk. Keep managing it.`);
  } else if (a.basket_quality === 'Weak') {
    lines.push(`This basket needs work. The quality score is low — consider swapping weaker positions for stronger setups.`);
  }

  // Horizon mix
  const total = a.horizon_mix.hot_now + a.horizon_mix.swing + a.horizon_mix.run;
  if (total > 0) {
    if (a.horizon_mix.hot_now > total * 0.6) {
      lines.push(`Most of your basket is Hot Now plays. These burn fast — make sure you're watching them closely.`);
    }
    if (a.horizon_mix.run > total * 0.6) {
      lines.push(`Heavy on Run positions. That's fine for a patient approach, but don't expect fireworks this week.`);
    }
  }

  // P&L narrative
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const winners = positions.filter(p => p.pnl_pct > 5).length;
  const losers = positions.filter(p => p.pnl_pct < -5).length;
  if (winners > 0 && losers > 0) {
    lines.push(`${winners} winner${winners > 1 ? 's' : ''} and ${losers} loser${losers > 1 ? 's' : ''} in the basket. Don't let the losers eat the gains.`);
  } else if (totalPnl > 0 && positions.length >= 3) {
    lines.push(`Basket is in the green. Good. Now the question is: are you managing it, or just hoping?`);
  }

  return lines.slice(0, 3); // Max 3 narratives
}
