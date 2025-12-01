import type { Market } from '@/lib/api/types';
import { clobClient } from '@/lib/polymarket/clobClient';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

type ClobToken = {
  token_id?: string;
  outcome?: string;
  price?: number;
};

type ClobMarket = {
  question: string;
  tags?: string[];
  market_slug: string;
  tokens?: ClobToken[];
  enable_order_book: boolean;
  active: boolean;
  archived?: boolean;
  accepting_orders?: boolean;
  closed?: boolean;
  condition_id: string;
  icon?: string | null;
  image?: string | null;
  end_date_iso?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  startDate?: string | null;
  liquidity?: string | number | null;
  liquidityNum?: number | null;
  events?: Array<{
    startDate?: string | null;
    creationDate?: string | null;
  }>;
};

type SamplingPayload = {
  data: ClobMarket[];
  limit: number;
  count: number;
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

  const samplingMarkets = await fetchSamplingMarkets();
  const fallbackMarkets =
    samplingMarkets.length === 0 ? ((await clobClient.getMarkets()).data as ClobMarket[]) : [];
  const sourceMarkets = samplingMarkets.length ? samplingMarkets : fallbackMarkets;

  const eligible = sourceMarkets.filter((market) => {
    if (!market.active) return false;
    if (market.archived) return false;
    if (market.closed) return false;
    if (market.accepting_orders === false) return false;
    return (market.tokens?.length ?? 0) > 0;
  });

  const filtered = eligible.filter((market) => {
    const endTs = resolveEndTimestamp(market.end_date_iso ?? market.endDate);
    if (endTs && endTs < now - 6 * 60 * 60 * 1000) {
      return false;
    }
    return matchesQuery(query, market);
  });

  const prioritized = filtered.sort((a, b) => {
    const aCreated = resolveCreatedTimestamp(a);
    const bCreated = resolveCreatedTimestamp(b);
    if (aCreated !== bCreated) {
      return bCreated - aCreated;
    }
    const aLiquidity = resolveLiquidity(a);
    const bLiquidity = resolveLiquidity(b);
    return bLiquidity - aLiquidity;
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

function resolveCreatedTimestamp(market: ClobMarket) {
  const candidates = [
    market.createdAt,
    market.updatedAt,
    market.startDate,
    market.events?.[0]?.startDate,
    market.events?.[0]?.creationDate,
    market.end_date_iso,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const ts = Date.parse(candidate);
    if (!Number.isNaN(ts)) {
      return ts;
    }
  }
  return 0;
}

function resolveLiquidity(market: ClobMarket) {
  if (typeof market.liquidity === 'number') return market.liquidity;
  if (typeof market.liquidity === 'string') return Number(market.liquidity);
  if (typeof market.liquidityNum === 'number') return market.liquidityNum;
  return 0;
}

function clampLimit(value: number) {
  return Math.min(Math.max(value, 1), 25);
}

function normalize(text?: string | null) {
  return text?.toLowerCase().trim() ?? '';
}

async function fetchSamplingMarkets(): Promise<ClobMarket[]> {
  try {
    const response = await fetch(`${env.polymarketApiHost}/sampling-markets`, {
      headers: {
        'User-Agent': 'polyberg-market-fetch/1.0',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Sampling markets request failed with ${response.status}`);
    }
    const payload = (await response.json()) as SamplingPayload;
    return payload.data ?? [];
  } catch (error) {
    logger.error('markets.sampling.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}


