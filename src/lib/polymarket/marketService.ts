import type { Market, MarketCategory } from '@/lib/api/types';
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

export type GammaTag = string | { label?: string; slug?: string };

export type GammaMarket = {
  conditionId?: string;
  slug?: string;
  question?: string;
  tags?: GammaTag[];
  categories?: GammaTag[];
  startDate?: string;
  endDate?: string;
  closeDate?: string;
  createdAt?: string;
  updatedAt?: string;
  tokens?: Array<{
    id?: string;
    tokenId?: string;
    token_id?: string;
    outcome?: string;
    price?: number | string | null;
    priceCents?: number | null;
  }>;
  outcomes?:
    | Array<{
        id?: string;
        tokenId?: string;
        token_id?: string;
        outcome?: string;
        price?: number | string | null;
        priceCents?: number | null;
      }>
    | string;
  outcomePrices?: Array<number | string> | string;
  clobTokenIds?: string | string[];
  liquidity?: number | string | null;
  sportsMarketType?: string;
  marketType?: string;
  market_type?: string;
  line?: number | string | null;
  homeTeamName?: string;
  awayTeamName?: string;
  home_team_name?: string;
  away_team_name?: string;
  image?: string | null;
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
  mode?: 'featured' | 'search';
};

export async function loadMarketSnapshots(
  options: MarketSnapshotOptions = {},
): Promise<Market[]> {
  const limit = clampLimit(Number.isFinite(options.limit) ? Number(options.limit) : 24);
  const query = normalize(options.query);
  const now = options.now ?? Date.now();
  const mode = options.mode ?? 'featured';

  const sourceMarkets = await fetchEligibleMarkets(now);

  if (mode === 'search') {
    const filtered = sourceMarkets
      .filter((market) => matchesQuery(query, market))
      .sort((a, b) => {
        const aScore = resolvePriorityScore(a, now);
        const bScore = resolvePriorityScore(b, now);
        return bScore - aScore;
      })
      .slice(0, limit);
    return hydrateMarkets(filtered);
  }

  const curated = pickFeaturedMarkets(sourceMarkets, limit, now);
  return hydrateMarkets(curated);
}

export async function loadSportsMarkets(options: { limit?: number; now?: number } = {}) {
  const limit = clampLimit(Number.isFinite(options.limit) ? Number(options.limit) : 200);
  const now = options.now ?? Date.now();
  const sourceMarkets = await fetchEligibleMarkets(now);
  const deduped = new Map<string, ClobMarket>();
  sourceMarkets.forEach((market) => {
    if (resolveCategory(market) !== 'sports') {
      return;
    }
    if (!deduped.has(market.condition_id)) {
      deduped.set(market.condition_id, market);
    }
  });
  const sorted = Array.from(deduped.values()).sort((a, b) => {
    const aStart =
      resolveEventStartTimestamp(a) ?? resolveEndTimestamp(a.end_date_iso ?? a.endDate) ?? Infinity;
    const bStart =
      resolveEventStartTimestamp(b) ?? resolveEndTimestamp(b.end_date_iso ?? b.endDate) ?? Infinity;
    return aStart - bStart;
  });
  return hydrateMarkets(sorted.slice(0, limit));
}

async function hydrateMarkets(markets: ClobMarket[]): Promise<Market[]> {
  return markets.map((market) => {
    const category: MarketCategory = resolveCategory(market);
    const outcomes =
      market.tokens
        ?.slice(0, 3)
        .map((token) => ({
          tokenId: token.token_id ?? null,
          label: token.outcome ?? null,
          price: token.price != null ? Number(token.price) * 100 : null,
        })) ?? [];
    const primaryToken = market.tokens?.[0];
    const secondaryToken = market.tokens?.[1];
    const bestBid =
      primaryToken?.price != null ? Number(primaryToken.price) * 100 : null;
    const bestAsk =
      secondaryToken?.price != null ? Number(secondaryToken.price) * 100 : null;
    const liquidity = resolveLiquidity(market) || null;

    return {
      conditionId: market.condition_id,
      question: market.question,
      slug: market.market_slug,
      icon: market.icon ?? market.image ?? null,
      tag: market.tags?.[0] ?? null,
      endDate: market.end_date_iso ?? null,
      primaryTokenId: primaryToken?.token_id ?? null,
      secondaryTokenId: secondaryToken?.token_id ?? null,
      primaryOutcome: primaryToken?.outcome ?? null,
      secondaryOutcome: secondaryToken?.outcome ?? null,
      bestBid,
      bestAsk,
      spread:
        bestBid != null && bestAsk != null
          ? Number(Math.abs(bestAsk - bestBid).toFixed(2))
          : null,
      liquidity,
      outcomes,
      category,
    } satisfies Market;
  });
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
  return Math.min(Math.max(value, 1), 250);
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

const SPORTS_TARGET_COUNT = 240;
const SPORTS_LOOKAHEAD_HOURS = 24 * 7;
const SPORTS_LOOKBACK_HOURS = 12;

async function fetchEligibleMarkets(now: number) {
  const samplingMarkets = await fetchSamplingMarkets();
  const fallbackMarkets =
    samplingMarkets.length === 0 ? ((await clobClient.getMarkets()).data as ClobMarket[]) : [];
  const baseMarkets = samplingMarkets.length ? samplingMarkets : fallbackMarkets;
  const eligible = baseMarkets.filter((market) => {
    if (!market.active) return false;
    if (market.archived) return false;
    if (market.closed) return false;
    if (market.accepting_orders === false) return false;
    const endTs = resolveEndTimestamp(market.end_date_iso ?? market.endDate);
    if (endTs && endTs < now - 6 * 60 * 60 * 1000) {
      return false;
    }
    return (market.tokens?.length ?? 0) > 0;
  });

  return ensureSportsCoverage(eligible, now);
}

function pickFeaturedMarkets(markets: ClobMarket[], limit: number, now: number) {
  const buckets = new Map<string, ClobMarket[]>();
  markets.forEach((market) => {
    const category = resolveCategory(market);
    if (!buckets.has(category)) {
      buckets.set(category, []);
    }
    buckets.get(category)!.push(market);
  });

  buckets.forEach((bucket) =>
    bucket.sort((a, b) => resolvePriorityScore(b, now) - resolvePriorityScore(a, now)),
  );

  const priorityOrder = ['sports', 'entertainment', 'crypto', 'politics', 'macro', 'other'];
  const selected: ClobMarket[] = [];
  while (selected.length < limit && buckets.size > 0) {
    let added = false;
    for (const category of priorityOrder) {
      const bucket = buckets.get(category);
      if (bucket && bucket.length) {
        selected.push(bucket.shift()!);
        added = true;
        if (!bucket.length) {
          buckets.delete(category);
        }
        if (selected.length >= limit) {
          break;
        }
      }
    }
    if (!added) {
      break;
    }
  }

  if (selected.length < limit) {
    const remaining = markets
      .filter((market) => !selected.includes(market))
      .sort((a, b) => resolvePriorityScore(b, now) - resolvePriorityScore(a, now));
    selected.push(...remaining.slice(0, limit - selected.length));
  }

  return selected.slice(0, limit);
}

function resolveCategory(market: ClobMarket): MarketCategory {
  const tags = (market.tags ?? []).map((tag) => tag.toLowerCase());
  const question = market.question?.toLowerCase() ?? '';
  if (
    tags.some((tag) => ['sports', 'nfl', 'nba', 'ufc', 'mlb', 'nhl'].includes(tag)) ||
    /\b(nfl|nba|mlb|nhl|soccer|match|game|tournament|fight|odds|vs\.|world cup)\b/.test(question)
  ) {
    return 'sports';
  }
  if (
    tags.some((tag) => ['movies', 'music', 'awards', 'culture', 'pop culture'].includes(tag)) ||
    /\b(oscar|grammy|album|movie|film|tv|celebrity|box office|concert|tour|song|show)\b/.test(
      question,
    )
  ) {
    return 'entertainment';
  }
  if (
    tags.some((tag) => ['crypto', 'tech', 'ai', 'business', 'ipo'].includes(tag)) ||
    /\b(bitcoin|ethereum|token|price|stock|ipo|ai|model|coin|fund|rate)\b/.test(question)
  ) {
    return 'crypto';
  }
  if (
    tags.some((tag) => ['politics', 'elections', 'trump', 'cabinet', 'senate'].includes(tag)) ||
    /\b(election|president|senate|congress|primary|governor|parliament|minister)\b/.test(question)
  ) {
    return 'politics';
  }
  if (
    tags.some((tag) => ['economy', 'science', 'world'].includes(tag)) ||
    /\b(inflation|economy|gdp|rate|climate|hurricane|disease|war|peace)\b/.test(question)
  ) {
    return 'macro';
  }
  return 'other';
}

function resolvePriorityScore(market: ClobMarket, now: number) {
  const liquidity = resolveLiquidity(market);
  const created = resolveCreatedTimestamp(market) || now;
  const ageHours = Math.max(1, (now - created) / (1000 * 60 * 60));
  const freshnessScore = 1 / ageHours;
  const liquidityScore = liquidity ? Math.log10(liquidity + 10) : 0;
  return liquidityScore * 0.6 + freshnessScore * 0.4;
}

async function ensureSportsCoverage(markets: ClobMarket[], now: number) {
  const sportsCount = markets.filter((market) => resolveCategory(market) === 'sports').length;
  if (sportsCount >= SPORTS_TARGET_COUNT) {
    return markets;
  }
  const needed = SPORTS_TARGET_COUNT - sportsCount;
  const existingIds = new Set(markets.map((market) => market.condition_id));
  const supplemental: ClobMarket[] = [];

  const slate = await fetchSportsSlate(now, needed, existingIds);
  slate.forEach((market) => existingIds.add(market.condition_id));
  supplemental.push(...slate);

  if (supplemental.length < needed) {
    const gammaSlate = await fetchGammaSportsMarkets(needed - supplemental.length, existingIds);
    supplemental.push(...gammaSlate);
  }

  if (!supplemental.length) {
    return markets;
  }
  return [...markets, ...supplemental];
}

async function fetchSportsSlate(
  now: number,
  needed: number,
  existingIds: Set<string>,
): Promise<ClobMarket[]> {
  if (needed <= 0) {
    return [];
  }
  try {
    const response = await clobClient.getMarkets();
    const markets = response.data as ClobMarket[];
    const startWindow = now - SPORTS_LOOKBACK_HOURS * 60 * 60 * 1000;
    const endWindow = now + SPORTS_LOOKAHEAD_HOURS * 60 * 60 * 1000;
    return markets
      .filter((market) => !existingIds.has(market.condition_id))
      .filter((market) => resolveCategory(market) === 'sports')
      .filter((market) => {
        if (!market.active || market.archived || market.closed) {
          return false;
        }
        const start = resolveEventStartTimestamp(market);
        const end = resolveEndTimestamp(market.end_date_iso ?? market.endDate);
        const reference = start ?? end;
        if (!reference) {
          return false;
        }
        return reference >= startWindow && reference <= endWindow;
      })
      .sort((a, b) => {
        const aStart = resolveEventStartTimestamp(a) ?? resolveEndTimestamp(a.end_date_iso ?? a.endDate) ?? Infinity;
        const bStart = resolveEventStartTimestamp(b) ?? resolveEndTimestamp(b.end_date_iso ?? b.endDate) ?? Infinity;
        return aStart - bStart;
      })
      .slice(0, needed);
  } catch (error) {
    logger.warn('markets.sportsSlate.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function resolveEventStartTimestamp(market: ClobMarket) {
  const candidates = [
    market.events?.[0]?.startDate,
    market.events?.[0]?.creationDate,
    market.startDate,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const ts = Date.parse(candidate);
    if (!Number.isNaN(ts)) {
      return ts;
    }
  }
  return null;
}

async function fetchGammaSportsMarkets(
  needed: number,
  existingIds: Set<string>,
): Promise<ClobMarket[]> {
  if (needed <= 0) {
    return [];
  }
  try {
    const url = new URL('/public-search', env.gammaApiHost);
    url.searchParams.set('q', 'sports');
    url.searchParams.set('events_tag', 'sports');
    url.searchParams.set('limit_per_type', String(Math.min(needed * 5, 250)));
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'polyberg-sports-fetch/1.0',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Gamma markets request failed with ${response.status}`);
    }
    const payload = (await response.json()) as {
      events?: Array<{ markets?: GammaMarket[] }>;
    };
    const markets =
      payload.events
        ?.flatMap((event) => event.markets ?? [])
        .filter((market): market is GammaMarket => Boolean(market)) ?? [];
    const normalized: ClobMarket[] = [];
    for (const market of markets) {
      const mapped = mapGammaMarketToClobMarket(market);
      if (!mapped || existingIds.has(mapped.condition_id)) {
        continue;
      }
      normalized.push(mapped);
      if (normalized.length >= needed) {
        break;
      }
    }
    return normalized;
  } catch (error) {
    logger.warn('markets.gammaSports.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function normalizeGammaTokens(market: GammaMarket): ClobToken[] {
  if (Array.isArray(market.tokens) && market.tokens.length) {
    return market.tokens
      .filter((token) => token.token_id || token.tokenId || token.id)
      .map((token) => ({
        token_id: token.token_id ?? token.tokenId ?? token.id ?? undefined,
        outcome: token.outcome ?? undefined,
        price: convertPriceToCents(token.price ?? token.priceCents ?? null),
      }));
  }

  const clobTokenIds = Array.isArray(market.clobTokenIds)
    ? market.clobTokenIds
    : parseJsonArray<string>(market.clobTokenIds ?? null) ??
      parseJsonArray<string>((market as { clob_token_ids?: string }).clob_token_ids ?? null) ??
      [];
  const outcomeLabels =
    parseOutcomeLabels(market.outcomes) ??
    parseOutcomeLabels((market as { shortOutcomes?: string }).shortOutcomes) ??
    [];
  const outcomePrices =
    parsePriceArray(market.outcomePrices) ??
    parsePriceArray((market as { outcome_prices?: string }).outcome_prices) ??
    [];

  if (!clobTokenIds.length) {
    return [];
  }

  return clobTokenIds.map((tokenId, index) => ({
    token_id: tokenId ?? undefined,
    outcome: outcomeLabels[index] ?? undefined,
    price: convertPriceToCents(outcomePrices[index] ?? null),
  }));
}

function convertPriceToCents(value?: number | string | null) {
  if (value == null) {
    return undefined;
  }
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  return Number((numeric * 100).toFixed(2));
}

function parseJsonArray<T>(value?: string | null): T[] | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function parseOutcomeLabels(
  value?: Array<{ outcome?: string }> | string | null,
): string[] | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        typeof entry === 'string'
          ? entry
          : typeof entry === 'object'
            ? entry.outcome ?? ''
            : '',
      )
      .filter(Boolean);
  }
  return parseJsonArray<string>(value);
}

function parsePriceArray(value?: Array<number | string> | string | null) {
  if (!value) {
    return null;
  }
  const normalize = (input: number | string) => {
    const numeric = typeof input === 'string' ? Number(input) : input;
    return Number.isFinite(numeric) ? numeric : undefined;
  };
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  const parsed = parseJsonArray<number | string>(value);
  return parsed?.map((item) => normalize(item)) ?? null;
}

function normalizeTagStrings(values?: GammaTag[]): string[] {
  if (!values?.length) {
    return [];
  }
  return values
    .map((tag) => {
      if (typeof tag === 'string') return tag;
      if (tag && typeof tag === 'object') {
        return tag.label ?? tag.slug ?? '';
      }
      return '';
    })
    .filter(Boolean);
}

function mapGammaMarketToClobMarket(market: GammaMarket): ClobMarket | null {
  const conditionId =
    market.conditionId ??
    (market as { condition_id?: string }).condition_id ??
    (market as { id?: string }).id ??
    market.slug ??
    '';
  if (!conditionId) {
    return null;
  }
  const parsedTokens = normalizeGammaTokens(market);
  const normalizedTags = [
    ...normalizeTagStrings(market.tags),
    ...normalizeTagStrings(market.categories),
  ].filter(Boolean);

  return {
    question: market.question ?? '',
    market_slug: market.slug ?? conditionId,
    tags: normalizedTags.length ? normalizedTags : ['Sports'],
    tokens: parsedTokens,
    enable_order_book: true,
    active: true,
    condition_id: conditionId,
    icon: market.image ?? null,
    image: market.image ?? null,
    end_date_iso: market.endDate ?? market.closeDate ?? null,
    endDate: market.endDate ?? market.closeDate ?? null,
    createdAt: market.createdAt ?? null,
    updatedAt: market.updatedAt ?? null,
    startDate: market.startDate ?? null,
    liquidity:
      typeof market.liquidity === 'string' ? Number(market.liquidity) : market.liquidity ?? null,
    liquidityNum:
      typeof market.liquidity === 'string'
        ? Number(market.liquidity)
        : (market.liquidity as number | null | undefined) ?? null,
    events: [],
    archived: false,
    accepting_orders: true,
    closed: false,
  };
}

export async function convertGammaMarketsToMarkets(
  markets: GammaMarket[],
): Promise<Array<{ source: GammaMarket; market: Market }>> {
  const pairs: Array<{ source: GammaMarket; clob: ClobMarket }> = [];
  for (const market of markets) {
    const mapped = mapGammaMarketToClobMarket(market);
    if (mapped) {
      pairs.push({ source: market, clob: mapped });
    }
  }
  if (!pairs.length) {
    return [];
  }
  const hydrated = await hydrateMarkets(pairs.map((pair) => pair.clob));
  return hydrated.map((market, index) => ({ source: pairs[index].source, market }));
}


