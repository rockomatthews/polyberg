import { NextRequest, NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';
import { logger } from '@/lib/logger';

const clampLimit = (value: number) => Math.min(Math.max(value, 1), 25);

function normalize(text?: string | null) {
  return text?.toLowerCase().trim() ?? '';
}

function matchesQuery(query: string, market: any) {
  if (!query.length) return true;
  const haystack = [
    market.question,
    market.tags?.join(' '),
    market.market_slug,
    market.tokens?.map((token: any) => token.outcome).join(' '),
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
    const eligible = payload.data.filter((market) => market.enable_order_book && market.active);
    const filtered = eligible.filter((market) => matchesQuery(query, market));
    const selected = filtered.slice(0, limit);

    const markets = [];
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
        endDate: market.end_date_iso,
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

