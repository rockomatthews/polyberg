import { NextRequest, NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';
import { logger } from '@/lib/logger';
import type { Market } from '@/lib/api/types';

const clampLimit = (value: number) => Math.min(Math.max(value, 1), 25);

function normalize(text?: string | null) {
  return text?.toLowerCase().trim() ?? '';
}

type ClobToken = {
  token_id?: string;
  outcome?: string;
};

type ClobMarket = {
  question: string;
  tags?: string[];
  market_slug: string;
  tokens?: ClobToken[];
  enable_order_book: boolean;
  active: boolean;
  condition_id: string;
  icon?: string | null;
  image?: string | null;
  end_date_iso?: string | null;
};

function matchesQuery(query: string, market: ClobMarket) {
  if (!query.length) return true;
  const tokenOutcomes = (market.tokens ?? [])
    .map((token) => token.outcome ?? '')
    .filter(Boolean)
    .join(' ');
  const haystack = [
    market.question,
    market.tags?.join(' '),
    market.market_slug,
    tokenOutcomes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const rawLimit = Number(params.get('limit') ?? '8');
    const limit = clampLimit(Number.isNaN(rawLimit) ? 8 : rawLimit);
    const query = normalize(params.get('q'));

    const payload = await clobClient.getMarkets();
        const marketsResponse = payload.data as ClobMarket[];
        const eligible = marketsResponse.filter((market) => {
          // Polymarket currently reports enable_order_book = false for most markets,
          // so we only require that the market is active and exposes at least one token.
          return market.active && (market.tokens?.length ?? 0) > 0;
        });
    const filtered = eligible.filter((market) => matchesQuery(query, market));
    const selected = filtered.slice(0, limit);

    const markets: Market[] = [];
    for (const market of selected) {
      const primaryToken = market.tokens?.[0];
      let bestBid: number | null = null;
      let bestAsk: number | null = null;
      let liquidity: number | null = null;

      if (primaryToken?.token_id) {
        try {
          const summary = await clobClient.getOrderBook(primaryToken.token_id);
          bestBid = summary.bids?.length ? Number(summary.bids[0].price) * 100 : null;
          bestAsk = summary.asks?.length ? Number(summary.asks[0].price) * 100 : null;
          const bidDepth = (summary.bids ?? []).slice(0, 3).reduce((acc, level) => acc + Number(level.size), 0);
          const askDepth = (summary.asks ?? []).slice(0, 3).reduce((acc, level) => acc + Number(level.size), 0);
          liquidity = Number((bidDepth + askDepth).toFixed(2));
        } catch (error) {
          logger.warn('markets.orderbook.failed', {
            tokenId: primaryToken?.token_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      markets.push({
        conditionId: market.condition_id,
        question: market.question,
        slug: market.market_slug,
        icon: market.icon ?? market.image ?? null,
        tag: market.tags?.[0] ?? null,
        endDate: market.end_date_iso ?? null,
        primaryTokenId: primaryToken?.token_id ?? null,
        secondaryTokenId: market.tokens?.[1]?.token_id ?? null,
        primaryOutcome: primaryToken?.outcome ?? null,
        secondaryOutcome: market.tokens?.[1]?.outcome ?? null,
        bestBid,
        bestAsk,
        spread:
          bestBid != null && bestAsk != null
            ? Number((Math.abs(bestAsk - bestBid)).toFixed(2))
            : null,
        liquidity,
      });
    }

    return NextResponse.json({ markets });
  } catch (error) {
    logger.error('markets.fetch.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to load Polymarket markets' },
      { status: 500 },
    );
  }
}

