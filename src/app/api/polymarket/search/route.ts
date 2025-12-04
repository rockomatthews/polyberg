import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  convertGammaMarketsToMarkets,
  type GammaMarket,
  loadMarketSnapshots,
} from '@/lib/polymarket/marketService';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ markets: [] });
  }
  const limitParam = Number(searchParams.get('limit')) || 25;
  const limit = Math.min(Math.max(limitParam, 1), 50);

  try {
    const url = new URL('/public-search', env.gammaApiHost);
    url.searchParams.set('q', query);
    url.searchParams.set('limit_per_type', String(limit * 2));
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'polyberg-search/1.0',
      },
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      logger.warn('search.gamma.unauthorized', { status: response.status });
      const fallbackMarkets = await loadMarketSnapshots({
        limit,
        query,
        mode: 'search',
      });
      return NextResponse.json({ markets: fallbackMarkets });
    }
    if (!response.ok) {
      throw new Error(`Gamma search failed with ${response.status}`);
    }
    const payload = (await response.json()) as {
      events?: Array<{ markets?: GammaMarket[] }>;
    };
    const markets =
      payload.events
        ?.flatMap((event) => event.markets ?? [])
        .filter((market): market is GammaMarket => Boolean(market)) ?? [];
    const pairs = await convertGammaMarketsToMarkets(markets);
    const normalized = pairs.map((pair) => pair.market);
    return NextResponse.json({ markets: normalized.slice(0, limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('search.gamma.failed', { error: message });
    const fallbackMarkets = await loadMarketSnapshots({
      limit,
      query,
      mode: 'search',
    });
    return NextResponse.json(
      { error: message, markets: fallbackMarkets },
      { status: 200 },
    );
  }
}
