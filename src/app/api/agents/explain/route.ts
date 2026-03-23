import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/server/db';
import * as agentService from '@/server/agents/service';
import * as trader from '@/server/domains/trader';
import * as market from '@/server/domains/market';
import type { AgentName } from '@/types';
import type { TickerContext, BasketContext, ActionContext } from '@/server/agents/contracts';

/**
 * POST /api/agents/explain
 * Generate an agent explanation for a specific subject.
 * Returns persisted artifact with structured output.
 *
 * Body: { type: 'ticker' | 'basket' | 'action', ticker?, agent? }
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { type, ticker, agent: agentName } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    if (type === 'ticker') {
      if (!ticker) {
        return NextResponse.json({ error: 'ticker is required for ticker explanation' }, { status: 400 });
      }

      // Build ticker context from existing data
      const opp = await trader.getOpportunityByTicker(ticker);
      if (!opp) {
        return NextResponse.json({ error: 'Ticker not found in feed' }, { status: 404 });
      }

      const [quotes, fundamentals] = await Promise.all([
        market.getLatestQuotes([ticker]),
        market.getFundamentals([ticker]),
      ]);
      const quote = quotes.get(ticker);
      const fund = fundamentals[0] ?? null;

      const ctx: TickerContext = {
        ticker: opp.ticker,
        name: opp.asset_name,
        assetType: opp.asset_type,
        sector: opp.sector ?? null,
        price: quote?.last_price ?? null,
        changePct: quote?.pct_change ?? null,
        scores: {
          opportunity: opp.opportunity_score,
          momentum: opp.momentum_score,
          breakout: opp.breakout_score,
          meanReversion: opp.mean_reversion_score,
          catalyst: opp.catalyst_score,
          sentiment: opp.sentiment_score,
          volatility: opp.volatility_score,
          regimeFit: opp.regime_fit_score,
        },
        label: opp.opportunity_label,
        riskLabel: opp.risk_label,
        setupType: opp.setup_type,
        horizonDays: opp.horizon_days,
        fundamentals: fund ? {
          peRatio: fund.pe_ratio,
          revenueGrowth: fund.revenue_growth_yoy,
          profitMargin: fund.profit_margin,
          roe: fund.roe,
          marketCap: fund.market_cap,
        } : null,
      };

      // Call the appropriate agent (default Mark for tickers, or specified)
      const targetAgent = (agentName as AgentName) ?? 'Mark';
      let artifact;
      if (targetAgent === 'Mark') {
        artifact = await agentService.markTickerCommentary(ctx, user.id);
      } else if (targetAgent === 'Nia') {
        artifact = await agentService.niaTickerCommentary(ctx, user.id);
      } else {
        artifact = await agentService.askAgent(targetAgent, `Analyze ${ticker}`, JSON.stringify(ctx), 'ticker', ticker, user.id);
      }

      return NextResponse.json({ artifact, context: ctx });

    } else if (type === 'basket') {
      const { basket, positions } = await trader.getUserBasket(user.id);
      if (!basket || positions.length === 0) {
        return NextResponse.json({ error: 'No active basket with positions' }, { status: 404 });
      }

      const analytics = await trader.computeAnalytics(user.id);

      const ctx: BasketContext = {
        positionCount: positions.length,
        totalValue: positions.reduce((s, p) => s + p.current_price * p.quantity, 0),
        totalCost: positions.reduce((s, p) => s + p.entry_price * p.quantity, 0),
        totalPnlPct: 0,
        winners: positions.filter((p) => p.pnl_pct > 0).length,
        losers: positions.filter((p) => p.pnl_pct < 0).length,
        positions: positions.map((p) => ({
          ticker: p.ticker,
          weight: p.manual_weight ?? p.target_weight,
          pnlPct: p.pnl_pct,
          score: p.opportunity_score,
          riskLabel: p.risk_label,
          setupType: p.setup_type,
        })),
        analytics: analytics ? {
          probabilityScore: analytics.probability_score,
          concentrationRisk: analytics.concentration_risk,
          correlationRisk: analytics.correlation_risk,
          cryptoAllocation: analytics.crypto_allocation,
          largestPosition: analytics.largest_position_ticker,
          largestPositionPct: analytics.largest_position_pct,
          basketQuality: analytics.basket_quality,
        } : null,
      };
      ctx.totalPnlPct = ctx.totalCost > 0 ? ((ctx.totalValue - ctx.totalCost) / ctx.totalCost) * 100 : 0;

      const artifact = await agentService.paulBasketBrief(ctx, user.id);

      return NextResponse.json({ artifact, context: ctx });

    } else if (type === 'action') {
      if (!ticker) {
        return NextResponse.json({ error: 'ticker is required for action explanation' }, { status: 400 });
      }

      const { basket, positions } = await trader.getUserBasket(user.id);
      if (!basket) {
        return NextResponse.json({ error: 'No active basket' }, { status: 404 });
      }

      const pos = positions.find((p) => p.ticker === ticker);
      if (!pos) {
        return NextResponse.json({ error: 'Position not found' }, { status: 404 });
      }

      // Get the persisted action for this position
      const actions = await trader.getPersistedActions(basket.id);
      const action = actions.find((a: { ticker: string }) => a.ticker === ticker);

      const ctx: ActionContext = {
        ticker: pos.ticker,
        action: action?.action_type ?? 'hold',
        urgency: action?.urgency ?? 'low',
        reason: action?.reason ?? 'Position within normal range.',
        pnlPct: pos.pnl_pct,
        opportunityScore: pos.opportunity_score,
        riskLabel: pos.risk_label,
        positionWeight: pos.manual_weight ?? pos.target_weight,
      };

      const basketCtx: BasketContext = {
        positionCount: positions.length,
        totalValue: positions.reduce((s, p) => s + p.current_price * p.quantity, 0),
        totalCost: positions.reduce((s, p) => s + p.entry_price * p.quantity, 0),
        totalPnlPct: 0,
        winners: positions.filter((p) => p.pnl_pct > 0).length,
        losers: positions.filter((p) => p.pnl_pct < 0).length,
        positions: positions.map((p) => ({
          ticker: p.ticker,
          weight: p.manual_weight ?? p.target_weight,
          pnlPct: p.pnl_pct,
          score: p.opportunity_score,
          riskLabel: p.risk_label,
          setupType: p.setup_type,
        })),
        analytics: null,
      };
      basketCtx.totalPnlPct = basketCtx.totalCost > 0 ? ((basketCtx.totalValue - basketCtx.totalCost) / basketCtx.totalCost) * 100 : 0;

      const artifact = await agentService.rexActionExplanation(ctx, basketCtx, user.id);

      return NextResponse.json({ artifact, context: ctx });
    }

    return NextResponse.json({ error: 'Unknown explanation type' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
