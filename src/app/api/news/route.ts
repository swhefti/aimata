import { NextResponse } from 'next/server';
import * as market from '@/server/domains/market';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const news = await market.getLatestNews(limit);
    return NextResponse.json(news);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch news', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
