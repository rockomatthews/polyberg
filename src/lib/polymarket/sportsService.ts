import { env } from '@/lib/env';
import type { Market } from '@/lib/api/types';
import {
  convertGammaMarketsToMarkets,
  type GammaMarket,
  type GammaTag,
} from '@/lib/polymarket/marketService';

type GammaEvent = {
  id?: string;
  slug?: string;
  title?: string;
  name?: string;
  league?: string;
  tags?: GammaTag[];
  startTime?: string;
  eventDate?: string;
  gameStartTime?: string;
  start_date?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  home_team_name?: string;
  away_team_name?: string;
  image?: string | null;
  markets?: GammaMarket[];
};

export type SportsEventMarket = {
  id: string;
  label: string;
  type: string | null;
  line: number | null;
  market: Market;
};

export type SportsEvent = {
  id: string;
  slug: string;
  title: string;
  league: string | null;
  startTime: string | null;
  image: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  markets: SportsEventMarket[];
};

export async function fetchSportsEvent(slug: string): Promise<SportsEvent | null> {
  const normalizedSlug = slug.toLowerCase();
  const queries = buildSportsSearchQueries(slug);

  for (const query of queries) {
    const events = await fetchSportsEvents(query);
    if (!events.length) {
      continue;
    }
    const event = pickBestEvent(events, normalizedSlug) ?? events[0];
    if (!event) {
      continue;
    }
    return mapEventToSportsEvent(event, slug);
  }

  return null;
}

function parseLineValue(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const numeric =
    typeof value === 'string'
      ? Number(value)
      : typeof value === 'number'
        ? value
        : Number((value as { line?: string })?.line ?? NaN);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
}

function extractLeague(event: GammaEvent): string | null {
  if (event.league) {
    return event.league;
  }
  const tag = (event.tags ?? [])
    .map((item) =>
      typeof item === 'string'
        ? item
        : item && typeof item === 'object'
          ? item.label ?? item.slug ?? ''
          : '',
    )
    .find(Boolean);
  return tag ?? null;
}

function buildSportsSearchQueries(slug: string): string[] {
  const normalized = slug.toLowerCase();
  const variants = new Set<string>();
  variants.add(slug);
  variants.add(normalized);

  const strippedSuffix = normalized.replace(
    /-(total|totals|spread|moneyline|ml|ou|overunder|home|away|draw|line)[^-]*$/,
    '',
  );
  if (strippedSuffix && strippedSuffix.length > 4) {
    variants.add(strippedSuffix);
  }

  const truncated = normalized.split('-').slice(0, 5).join('-');
  if (truncated && truncated.length > 4) {
    variants.add(truncated);
  }

  variants.add(normalized.replace(/-/g, ' '));

  return Array.from(variants).filter((value) => value.trim().length > 0);
}

async function fetchSportsEvents(query: string): Promise<GammaEvent[]> {
  const url = new URL('/public-search', env.gammaApiHost);
  url.searchParams.set('q', query);
  url.searchParams.set('events_tag', 'sports');
  url.searchParams.set('limit_per_type', '20');
  url.searchParams.set('keep_closed_markets', '1');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'polyberg-sports-event/1.1',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sports event: ${response.status}`);
  }

  const payload = (await response.json()) as { events?: GammaEvent[] };
  return payload.events ?? [];
}

function pickBestEvent(events: GammaEvent[], normalizedSlug: string): GammaEvent | null {
  return (
    events.find((entry) => (entry.slug ?? '').toLowerCase() === normalizedSlug) ??
    events.find((entry) =>
      (entry.markets ?? []).some(
        (market) => (market.slug ?? market.conditionId ?? '').toLowerCase() === normalizedSlug,
      ),
    ) ??
    null
  );
}

async function mapEventToSportsEvent(event: GammaEvent, fallbackSlug: string): Promise<SportsEvent> {
  const slug = event.slug ?? fallbackSlug;
  const gammaMarkets = (event.markets ?? []) as GammaMarket[];
  const pairs = await convertGammaMarketsToMarkets(gammaMarkets);
  const markets: SportsEventMarket[] = pairs.map(({ source, market }) => ({
    id: source.conditionId ?? source.slug ?? market.conditionId,
    label: source.question ?? market.question,
    type:
      source.sportsMarketType ??
      (source as { marketType?: string }).marketType ??
      (source as { market_type?: string }).market_type ??
      null,
    line: parseLineValue(source.line),
    market,
  }));

  return {
    id: event.id ?? slug,
    slug,
    title: event.title ?? event.name ?? markets[0]?.label ?? slug,
    league: extractLeague(event),
    startTime:
      event.startTime ??
      event.gameStartTime ??
      event.eventDate ??
      event.start_date ??
      markets[0]?.market.endDate ??
      null,
    image: event.image ?? null,
    homeTeam: event.homeTeamName ?? event.home_team_name ?? null,
    awayTeam: event.awayTeamName ?? event.away_team_name ?? null,
    markets,
  };
}

