import { NextRequest, NextResponse } from 'next/server';

import type { Market, MarketCategory } from '@/lib/api/types';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

type GammaSearchMarket = {
  conditionId?: string;
  condition_id?: string;
  id?: string;
  slug?: string;
  question?: string;
  tags?: string[];
  categories?: string[];
  startDate?: string;
  endDate?: string;
  closeDate?: string;
  bestBid?: number | string | null;
  bestAsk?: number | string | null;
  tokens?: Array<{
    tokenId?: string;
    id?: string;
    outcome?: string;
    bestBid?: number | string | null;
    bestAsk?: number | string | null;
  }>;
  outcomes?: Array<{
    tokenId?: string;
    id?: string;
    outcome?: string;
    bestBid?: number | string | null;
    bestAsk?: number | string | null;
  }>;
  liquidity?: number | string | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q')?.trim();
  if (!query) {
    return NextResponse.json({ markets: [] });
  }
  const limitParam = Number(searchParams.get('limit')) || 25;
  const limit = Math.min(Math.max(limitParam, 1), 50);

  try {
    const url = new URL('/search', env.gammaApiHost);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit * 2));
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'polyberg-search/1.0',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Gamma search failed with ${response.status}`);
    }
    const payload = (await response.json()) as
      | { markets?: GammaSearchMarket[]; data?: GammaSearchMarket[] }
      | GammaSearchMarket[];
    const markets = Array.isArray(payload)
      ? payload
      : payload.markets ?? payload.data ?? [];
    const normalized = markets
      .map(normalizeGammaMarket)
      .filter((market): market is Market => Boolean(market));
    return NextResponse.json({ markets: normalized.slice(0, limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('search.gamma.failed', { error: message });
    return NextResponse.json({ error: message, markets: [] }, { status: 502 });
  }
}

function normalizeGammaMarket(market: GammaSearchMarket): Market | null {
  const conditionId =
    market.conditionId ?? market.condition_id ?? market.id ?? market.slug ?? null;
  if (!conditionId) {
    return null;
  }
  const tokens = market.tokens ?? market.outcomes ?? [];
  const primaryToken = tokens[0];
  const secondaryToken = tokens[1];
  const tag = market.tags?.[0] ?? market.categories?.[0] ?? null;
  return {
    conditionId,
    question: market.question ?? conditionId,
    slug: market.slug ?? conditionId,
    icon: null,
    tag,
    endDate: market.endDate ?? market.closeDate ?? null,
    primaryTokenId: primaryToken?.tokenId ?? primaryToken?.id ?? null,
    secondaryTokenId: secondaryToken?.tokenId ?? secondaryToken?.id ?? null,
    primaryOutcome: primaryToken?.outcome ?? null,
    secondaryOutcome: secondaryToken?.outcome ?? null,
    bestBid: normalizePrice(primaryToken?.bestBid ?? market.bestBid),
    bestAsk: normalizePrice(primaryToken?.bestAsk ?? market.bestAsk),
    spread: null,
    liquidity:
      typeof market.liquidity === 'string'
        ? Number(market.liquidity)
        : market.liquidity ?? null,
    outcomes: [
      {
        tokenId: primaryToken?.tokenId ?? primaryToken?.id ?? null,
        label: primaryToken?.outcome ?? null,
        price: normalizePrice(primaryToken?.bestAsk ?? market.bestAsk),
      },
      {
        tokenId: secondaryToken?.tokenId ?? secondaryToken?.id ?? null,
        label: secondaryToken?.outcome ?? null,
        price: normalizePrice(secondaryToken?.bestAsk),
      },
    ].filter((outcome) => outcome.tokenId || outcome.label),
    category: resolveCategoryFromTag(tag),
  };
}

function normalizePrice(value?: number | string | null) {
  if (value == null) return null;
  const numeric = typeof value === 'string' ? Number(value) : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const asPercent = numeric > 1 ? numeric : numeric * 100;
  return Number(asPercent.toFixed(2));
}

function resolveCategoryFromTag(tag: string | null): MarketCategory {
  const value = tag?.toLowerCase() ?? '';
  if (
    ['sports', 'nfl', 'nba', 'nhl', 'mlb', 'soccer', 'ufc', 'mma', 'golf', 'tennis'].some((key) =>
      value.includes(key),
    )
  ) {
    return 'sports';
  }
  if (['entertainment', 'awards', 'culture', 'music'].some((key) => value.includes(key))) {
    return 'entertainment';
  }
  if (['crypto', 'bitcoin', 'ethereum'].some((key) => value.includes(key))) {
    return 'crypto';
  }
  if (['politics', 'election', 'senate', 'primary'].some((key) => value.includes(key))) {
    return 'politics';
  }
  if (['macro', 'economy', 'inflation', 'rate'].some((key) => value.includes(key))) {
    return 'macro';
  }
  return 'other';
}


