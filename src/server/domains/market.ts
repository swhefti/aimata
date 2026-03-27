/**
 * Domain: Market Intelligence (Layer A)
 *
 * Reads from public schema: assets, price_history, market_quotes, fundamental_data.
 * This is shared, canonical market data owned by pipeline workers.
 * aiMATA reads only — never writes to public schema.
 *
 * Also provides enrichment utilities used by other domains (quote lookup, price history).
 *
 * Target owner: Pipeline workers (external)
 * Current: MAIPA pipeline populates these tables
 * Future: public.agent_scores and public.ticker_conclusions will be added (Phase 4+)
 */

import { getAdminClient } from '@/server/db';
import type { Asset, PriceHistory, MarketQuote, FundamentalData } from '@/types';

// ─── Asset Universe ───

export async function getNonEtfAssets(): Promise<Asset[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from('assets')
    .select('*')
    .in('asset_type', ['stock', 'crypto'])
    .eq('active', true);

  if (error) throw new Error(`Failed to fetch assets: ${error.message}`);
  return (data ?? []) as Asset[];
}

// ─── Price History ───

export async function getPriceHistory(tickers: string[], lookbackDays: number = 60): Promise<PriceHistory[]> {
  const db = getAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const sinceDate = since.toISOString().split('T')[0];

  const { data, error } = await db
    .from('price_history')
    .select('*')
    .in('ticker', tickers)
    .gte('date', sinceDate)
    .limit(tickers.length * lookbackDays);

  if (error) throw new Error(`Failed to fetch price history: ${error.message}`);
  return (data ?? []) as PriceHistory[];
}

/**
 * Get recent closing prices for sparkline charts.
 * Returns a map of ticker → number[] (most recent last).
 */
export async function getSparklineData(tickers: string[], points: number = 20): Promise<Record<string, number[]>> {
  const db = getAdminClient();
  const { data } = await db
    .from('price_history')
    .select('ticker, close')
    .in('ticker', tickers)
    .order('date', { ascending: false })
    .limit(tickers.length * points);

  const map: Record<string, number[]> = {};
  for (const p of data ?? []) {
    const arr = map[p.ticker] ?? [];
    if (arr.length < points) arr.push(p.close as number);
    map[p.ticker] = arr;
  }
  // Reverse each array so oldest is first
  for (const ticker of Object.keys(map)) {
    map[ticker] = map[ticker].reverse();
  }
  return map;
}

// ─── Market Quotes ───

/**
 * Get the latest quote per ticker.
 * Returns a Map for fast lookup.
 */
export async function getLatestQuotes(tickers?: string[]): Promise<Map<string, MarketQuote>> {
  const db = getAdminClient();
  // Limit proportional to ticker count: at most 3 rows per ticker (to handle date duplicates)
  const rowLimit = tickers && tickers.length > 0 ? Math.max(tickers.length * 3, 30) : 500;
  let query = db
    .from('market_quotes')
    .select('*')
    .order('date', { ascending: false })
    .limit(rowLimit);

  if (tickers && tickers.length > 0) {
    query = query.in('ticker', tickers);
  }

  const { data } = await query;

  const map = new Map<string, MarketQuote>();
  for (const q of (data ?? []) as MarketQuote[]) {
    if (!map.has(q.ticker)) {
      map.set(q.ticker, q);
    }
  }
  return map;
}

// ─── Fundamentals ───

export async function getFundamentals(tickers?: string[]): Promise<FundamentalData[]> {
  const db = getAdminClient();
  let query = db.from('fundamental_data').select('*');

  if (tickers && tickers.length > 0) {
    query = query.in('ticker', tickers);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch fundamentals: ${error.message}`);
  return (data ?? []) as FundamentalData[];
}

// ─── Enrichment Utilities ───

/**
 * Enrich an array of objects that have a `ticker` field with latest quote data.
 * Returns the original objects with last_price, daily_change, pct_change appended.
 */
export async function enrichWithQuotes<T extends { ticker: string }>(
  items: T[]
): Promise<(T & { last_price: number | null; daily_change: number | null; pct_change: number | null })[]> {
  if (items.length === 0) return [];

  const tickers = items.map((i) => i.ticker);
  const quotes = await getLatestQuotes(tickers);

  return items.map((item) => {
    const q = quotes.get(item.ticker);
    return {
      ...item,
      last_price: q?.last_price ?? null,
      daily_change: q?.daily_change ?? null,
      pct_change: q?.pct_change ?? null,
    };
  });
}

/**
 * Enrich items with both quotes and sparkline price history.
 */
export async function enrichWithQuotesAndSparklines<T extends { ticker: string }>(
  items: T[]
): Promise<(T & { last_price: number | null; daily_change: number | null; pct_change: number | null; price_history: number[] })[]> {
  if (items.length === 0) return [];

  const tickers = items.map((i) => i.ticker);
  const [quotes, sparklines] = await Promise.all([
    getLatestQuotes(tickers),
    getSparklineData(tickers),
  ]);

  return items.map((item) => {
    const q = quotes.get(item.ticker);
    return {
      ...item,
      last_price: q?.last_price ?? null,
      daily_change: q?.daily_change ?? null,
      pct_change: q?.pct_change ?? null,
      price_history: sparklines[item.ticker] ?? [],
    };
  });
}

// ─── News Feed ───

export interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  summary: string;
  source: string;
  published_at: string;
  url: string;
}

export async function getLatestNews(limit: number = 20, tickers?: string[]): Promise<NewsItem[]> {
  const db = getAdminClient();
  let query = db
    .from('news_data')
    .select('id, ticker, headline, summary, source, published_at, url')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (tickers && tickers.length > 0) {
    query = query.in('ticker', tickers);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as NewsItem[];
}
