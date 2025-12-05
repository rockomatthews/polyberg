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
  endDate?: string;
  start_date?: string;
  end_date?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  home_team_name?: string;
  away_team_name?: string;
  image?: string | null;
  markets?: GammaMarket[];
};

type GammaSportMetadata = {
  id?: number;
  sport?: string;
  image?: string | null;
  resolution?: string | null;
  ordering?: string | null;
  tags?: string | null;
  series?: string | null;
};

type LeagueConfig = {
  id: string;
  slug: string;
  label: string;
  tagId: string | null;
  seriesId: string | null;
  image: string | null;
  ordering: string | null;
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

const DEFAULT_LOOKAHEAD_HOURS = 24 * 7;
const DEFAULT_LOOKBACK_HOURS = 6;
const GENERAL_TAG_IDS = new Set(['1', '100639']);

const LEAGUE_LABEL_OVERRIDES: Record<string, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  nhl: 'NHL',
  mlb: 'MLB',
  nhlpa: 'NHL',
  cfb: 'College Football',
  ncaaf: 'College Football',
  ncaab: 'College Hoops',
  cbb: 'College Hoops',
  mls: 'MLS',
  epl: 'Premier League',
  lal: 'La Liga',
  bun: 'Bundesliga',
  ucl: 'Champions League',
  sea: 'Serie A',
  fl1: 'Ligue 1',
  nba2k: 'NBA 2K',
  mma: 'MMA',
  ufc: 'UFC',
  golf: 'Golf',
  tennis: 'Tennis',
  atp: 'ATP',
  wta: 'WTA',
  mlbb: 'MLBB',
  lol: 'League of Legends',
  valorant: 'Valorant',
  dota2: 'Dota 2',
  cs2: 'CS2',
  rl: 'Rocket League',
  fifa: 'EA FC',
  kbo: 'KBO',
  kbl: 'KBL',
  ahl: 'AHL',
};

const SPORT_PRIORITY = [
  'nfl',
  'nba',
  'nhl',
  'mlb',
  'mls',
  'ncaaf',
  'cfb',
  'ncaab',
  'cbb',
  'soccer',
  'epl',
  'ucl',
  'lal',
  'sea',
  'fl1',
  'mma',
  'ufc',
  'golf',
  'tennis',
  'atp',
  'wta',
  'lol',
  'valorant',
  'dota2',
  'cs2',
];

type SlateOptions = {
  now?: number;
  limit?: number;
  lookaheadHours?: number;
  lookbackHours?: number;
  staleBufferHours?: number;
};

export async function fetchSportsSlate(options: SlateOptions = {}): Promise<Market[]> {
  const now = options.now ?? Date.now();
  const lookaheadMs = (options.lookaheadHours ?? DEFAULT_LOOKAHEAD_HOURS) * 60 * 60 * 1000;
  const lookbackMs = (options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS) * 60 * 60 * 1000;
  const staleBufferMs = (options.staleBufferHours ?? 2) * 60 * 60 * 1000;
  const staleCutoff = now - staleBufferMs;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;

  const metadata = await fetchSportsMetadata();
  if (!metadata.length) {
    return [];
  }

  const prioritized = prioritizeLeagues(metadata);
  const candidates: Array<{ market: GammaMarket; tag: string; icon: string | null; start: number; end: number | null }> =
    [];
  const seen = new Set<string>();
  let shouldStop = false;

  for (const config of prioritized) {
    if (shouldStop) {
      break;
    }
    try {
      const events = await fetchEventsForLeague(config);
      if (!events.length) {
        continue;
      }
      for (const event of events) {
        const eventStart = resolveEventTimestamp(
          event.startTime ?? event.gameStartTime ?? event.eventDate ?? event.start_date ?? null,
        );
        for (const gammaMarket of event.markets ?? []) {
          if (!isHeadToHeadMarket(gammaMarket)) continue;
          if (!isMarketActive(gammaMarket)) continue;
          const startTs =
            resolveEventTimestamp(
              gammaMarket.startDate ?? (gammaMarket as { start_date?: string }).start_date ?? gammaMarket.endDate,
            ) ?? eventStart;
          const endTs = resolveEventTimestamp(
            gammaMarket.endDate ?? (gammaMarket as { end_date?: string }).end_date ?? event.endDate,
          );
          if (startTs && startTs < now - lookbackMs) {
            continue;
          }
          if (startTs && startTs > now + lookaheadMs) {
            continue;
          }
          if (endTs && endTs < staleCutoff) {
            continue;
          }
          const conditionId =
            gammaMarket.conditionId ??
            (gammaMarket as { condition_id?: string }).condition_id ??
            (gammaMarket as { id?: string }).id ??
            gammaMarket.slug;
          if (!conditionId || seen.has(conditionId)) {
            continue;
          }
          seen.add(conditionId);
          candidates.push({
            market: gammaMarket,
            tag: config.label,
            icon: config.image,
            start: startTs ?? endTs ?? now,
            end: endTs ?? null,
          });
          if (candidates.length >= limit * 2) {
            shouldStop = true;
            break;
          }
        }
        if (shouldStop) {
          break;
        }
      }
    } catch (error) {
      console.warn('[sportsSlate] league fetch failed', { league: config.slug, error });
    }
  }

  if (!candidates.length) {
    return [];
  }

  const ordered = candidates.sort((a, b) => a.start - b.start);
  const trimmed = ordered.slice(0, limit);
  const hydrated = await convertGammaMarketsToMarkets(trimmed.map((entry) => entry.market));
  return hydrated
    .map(({ market }, index) => {
      const meta = trimmed[index];
      return {
        ...market,
        tag: meta?.tag ?? market.tag ?? 'Sports',
        icon: meta?.icon ?? market.icon,
      };
    })
    .sort((a, b) => {
      const aTime = a.endDate ? Date.parse(a.endDate) : Number.MAX_SAFE_INTEGER;
      const bTime = b.endDate ? Date.parse(b.endDate) : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
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

async function fetchSportsMetadata(): Promise<GammaSportMetadata[]> {
  try {
    const url = new URL('/sports', env.gammaApiHost);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'polyberg-sports-meta/1.0',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch sports metadata: ${response.status}`);
    }
    const payload = (await response.json()) as GammaSportMetadata[];
    return payload ?? [];
  } catch (error) {
    console.warn('[sportsSlate] metadata fetch failed', error);
    return [];
  }
}

function prioritizeLeagues(metadata: GammaSportMetadata[]): LeagueConfig[] {
  const configs = metadata
    .map((entry) => buildLeagueConfig(entry))
    .filter((config): config is LeagueConfig => Boolean(config && (config.tagId || config.seriesId)));
  return configs.sort((a, b) => {
    const aIndex = SPORT_PRIORITY.indexOf(a.slug);
    const bIndex = SPORT_PRIORITY.indexOf(b.slug);
    if (aIndex === -1 && bIndex === -1) {
      return a.slug.localeCompare(b.slug);
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function buildLeagueConfig(entry: GammaSportMetadata): LeagueConfig | null {
  const slug = (entry.sport ?? '').toLowerCase();
  if (!slug) {
    return null;
  }
  const tagId = pickPrimaryTagId(entry);
  const label = formatLeagueLabel(slug);
  return {
    id: String(entry.id ?? slug),
    slug,
    label,
    tagId,
    seriesId: entry.series ?? null,
    image: entry.image ?? null,
    ordering: entry.ordering ?? null,
  };
}

function pickPrimaryTagId(entry: GammaSportMetadata): string | null {
  if (!entry.tags) {
    return null;
  }
  const tags = entry.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag && !GENERAL_TAG_IDS.has(tag));
  return tags[0] ?? null;
}

function formatLeagueLabel(slug: string) {
  const normalized = slug.toLowerCase();
  if (LEAGUE_LABEL_OVERRIDES[normalized]) {
    return LEAGUE_LABEL_OVERRIDES[normalized];
  }
  if (normalized.length <= 4) {
    return normalized.toUpperCase();
  }
  return normalized
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function fetchEventsForLeague(config: LeagueConfig): Promise<GammaEvent[]> {
  if (config.tagId) {
    const events = await fetchGammaEvents('tag_id', config.tagId);
    if (events.length) {
      return events;
    }
  }
  if (config.seriesId) {
    const events = await fetchGammaEvents('series_id', config.seriesId);
    if (events.length) {
      return events;
    }
  }
  return [];
}

async function fetchGammaEvents(param: 'tag_id' | 'series_id', value: string): Promise<GammaEvent[]> {
  const url = new URL('/events', env.gammaApiHost);
  url.searchParams.set(param, value);
  url.searchParams.set('closed', 'false');
  url.searchParams.set('limit', '200');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'polyberg-sports-events/1.0',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch events for ${param}=${value}: ${response.status}`);
  }
  const payload = (await response.json()) as GammaEvent[];
  return payload ?? [];
}

function resolveEventTimestamp(value?: string | null) {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function isHeadToHeadMarket(market: GammaMarket) {
  const question = (market.question ?? '').toLowerCase();
  if (!question) return false;
  return question.includes(' vs ') || question.includes(' vs.') || question.includes(' @ ');
}

function isMarketActive(market: GammaMarket) {
  if ((market as { closed?: boolean }).closed) return false;
  if ((market as { active?: boolean }).active === false) return false;
  if ((market as { acceptingOrders?: boolean }).acceptingOrders === false) return false;
  return true;
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

