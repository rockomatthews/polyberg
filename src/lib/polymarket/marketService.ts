import type { Market } from '@/lib/api/types';
import { clobClient } from '@/lib/polymarket/clobClient';
import { logger } from '@/lib/logger';

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
  archived?: boolean;
  condition_id: string;
  icon?: string | null;
  image?: string | null;
  end_date_iso?: string | null;
};

export type MarketSnapshotOptions = {
  limit?: number;
  query?: string;
  now?: number;
};

export async function loadMarketSnapshots(
  options: MarketSnapshotOptions = {},
): Promise<Market[]> {
  const limit = clampLimit(Number.isFinite(options.limit) ? Number(options.limit) : 12);
  const query = normalize(options.query);
  const now = options.now ?? Date.now();

  const payload = await clobClient.getMarkets();
  const marketsResponse = payload.data as ClobMarket[];
  const eligible = marketsResponse.filter((market) => {
    if (!market.active) return false;
    if (market.archived) return false;
    return (market.tokens?.length ?? 0) > 0;
  });

  const graceMs = 60 * 60 * 1000;
  const recencyWindowMs = 45 * 24 * 60 * 60 * 1000;

  const liveMarkets = eligible.filter((market) => {
    const ts = resolveEndTimestamp(market.end_date_iso);
    if (ts == null) return true;
    return ts >= now - graceMs;
  });

  const recentMarkets =
    liveMarkets.length > 0
      ? []
      : eligible.filter((market) => {
          const ts = resolveEndTimestamp(market.end_date_iso);
          if (ts == null) return true;
          return ts >= now - recencyWindowMs;
        });

  const pool =
    liveMarkets.length > 0
      ? { markets: liveMarkets, sort: 'asc' as const }
      : recentMarkets.length > 0
        ? { markets: recentMarkets, sort: 'desc' as const }
        : { markets: eligible, sort: 'desc' as const };

  const prioritized = pool.markets
    .filter((market) => matchesQuery(query, market))
    .sort((a, b) => {
      const aTs = resolveEndTimestamp(a.end_date_iso);
      const bTs = resolveEndTimestamp(b.end_date_iso);
      if (pool.sort === 'asc') {
        const aRank = aTs ?? Number.POSITIVE_INFINITY;
        const bRank = bTs ?? Number.POSITIVE_INFINITY;
        return aRank - bRank;
      }
      const aRank = aTs ?? Number.NEGATIVE_INFINITY;
      const bRank = bTs ?? Number.NEGATIVE_INFINITY;
      return bRank - aRank;
    });

  const selected = prioritized.slice(0, limit);
  const markets = await Promise.all(
    selected.map(async (market) => {
      const primaryToken = market.tokens?.[0];
      let bestBid: number | null = null;
      let bestAsk: number | null = null;
      let liquidity: number | null = null;

      if (primaryToken?.token_id) {
        try {
          const summary = await clobClient.getOrderBook(primaryToken.token_id);
          bestBid = summary.bids?.length ? Number(summary.bids[0].price) * 100 : null;
          bestAsk = summary.asks?.length ? Number(summary.asks[0].price) * 100 : null;
          const bidDepth = (summary.bids ?? [])
            .slice(0, 3)
            .reduce((acc, level) => acc + Number(level.size), 0);
          const askDepth = (summary.asks ?? [])
            .slice(0, 3)
            .reduce((acc, level) => acc + Number(level.size), 0);
          liquidity = Number((bidDepth + askDepth).toFixed(2));
        } catch (error) {
          logger.warn('markets.orderbook.failed', {
            tokenId: primaryToken?.token_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        conditionId: market.condition_id,
        question: market.question,
        slug: market.market_slug,
        icon: market.icon ?? market.image ?? null,
        tag: market.tags?.[0] ?? null,
        endDate: market.end_date_iso ?? null,
        primaryTokenId: primaryToken?.token_id ?? null,
        secondaryTokenId: market.tokens?.[1]?.token_id ?? null,
        primaryOutcome: market.tokens?.[0]?.outcome ?? null,
        secondaryOutcome: market.tokens?.[1]?.outcome ?? null,
        bestBid,
        bestAsk,
        spread:
          bestBid != null && bestAsk != null
            ? Number(Math.abs(bestAsk - bestBid).toFixed(2))
            : null,
        liquidity,
      } satisfies Market;
    }),
  );

  return markets;
}

function matchesQuery(query: string, market: ClobMarket) {
  if (!query.length) return true;
  const tokenOutcomes = (market.tokens ?? [])
    .map((token) => token.outcome ?? '')
    .filter(Boolean)
    .join(' ');
  const haystack = [market.question, market.tags?.join(' '), market.market_slug, tokenOutcomes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function resolveEndTimestamp(value?: string | null) {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function clampLimit(value: number) {
  return Math.min(Math.max(value, 1), 25);
}

function normalize(text?: string | null) {
  return text?.toLowerCase().trim() ?? '';
}


