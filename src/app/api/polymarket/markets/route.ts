import { NextRequest, NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';

const clampLimit = (value: number) => Math.min(Math.max(value, 1), 20);

export async function GET(request: NextRequest) {
  try {
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? '8');
    const limit = clampLimit(Number.isNaN(rawLimit) ? 8 : rawLimit);

    const payload = await clobClient.getMarkets();
    const sorted = payload.data.filter((market) => market.enable_order_book && market.active);
    const selected = sorted.slice(0, limit);

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
          console.warn('[api/polymarket/markets] Failed to fetch orderbook', error);
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
    console.error('[api/polymarket/markets] Unexpected error', error);
    return NextResponse.json(
      { error: 'Unable to load Polymarket markets' },
      { status: 500 },
    );
  }
}

