import { z } from 'zod';

import { loadMarketSnapshots } from '@/lib/polymarket/marketService';
import type { Market } from '@/lib/api/types';
import type { StrategyDefinition, StrategySignal } from '@/lib/autonomy/types';
import { logger } from '@/lib/logger';

const injurySchema = z.object({
  full_name: z.string().optional(),
  position: z.string().optional(),
  status: z.string().optional(),
  comment: z.string().optional(),
  update_date: z.string().optional(),
});

const playerSchema = z.object({
  full_name: z.string().optional(),
  position: z.string().optional(),
  injuries: z.array(injurySchema).optional(),
  status: z.string().optional(),
  comment: z.string().optional(),
  update_date: z.string().optional(),
});

const teamSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  alias: z.string().optional(),
  market: z.string().optional(),
  injuries: z.array(injurySchema).optional(),
  players: z.array(playerSchema).optional(),
});

const sportradarResponseSchema = z.object({
  teams: z.array(teamSchema),
});

type InjurySignalCandidate = {
  team: string;
  alias?: string;
  player: string;
  status: string;
  comment?: string;
  updatedAt?: string;
};

export async function runSportradarInjuryStrategy(
  strategy: StrategyDefinition,
  now: Date,
): Promise<StrategySignal[]> {
  const apiKey = process.env.SPORTRADAR_API_KEY;
  if (!apiKey) {
    logger.warn('strategies.sportradar.noKey', { strategyId: strategy.id });
    return [];
  }

  const injuries = await fetchInjuries(apiKey);
  if (!injuries.length) {
    return [];
  }

  const markets = await loadMarketSnapshots({ limit: 20 });
  if (!markets.length) {
    return [];
  }

  const statuses = new Set(
    (strategy.params?.injuryStatuses as string[] | undefined)?.map((s) => s.toLowerCase()) ?? [
      'out',
      'doubtful',
    ],
  );

  const cooldownMinutes =
    typeof strategy.params?.cooldownMinutes === 'number' ? strategy.params.cooldownMinutes : 30;
  const cutoff = now.getTime() - cooldownMinutes * 60 * 1000;

  const perSignalCap =
    typeof strategy.params?.maxNotional === 'number'
      ? Math.min(strategy.params.maxNotional, strategy.maxNotional)
      : strategy.maxNotional * 0.5;

  const results: StrategySignal[] = [];
  const expiry = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  for (const event of injuries) {
    if (!statuses.has(event.status.toLowerCase())) {
      continue;
    }
    if (event.updatedAt) {
      const ts = Date.parse(event.updatedAt);
      if (!Number.isNaN(ts) && ts < cutoff) {
        continue;
      }
    }

    const market = markets.find((mkt) => isMarketAboutTeam(mkt, event.team, event.alias));
    if (!market) {
      continue;
    }

    const opponent = resolveOpponentToken(market, event.team, event.alias);
    if (!opponent?.tokenId) {
      continue;
    }

    const side: 'BUY' | 'SELL' = 'BUY';
    const limitPriceCents = market.bestAsk ?? 52;
    const reason = `${event.player || 'Key player'} ${event.status}`;
    const sizeUsd = Math.max(5, Math.min(perSignalCap, strategy.maxNotional));

    results.push({
      strategyId: strategy.id,
      source: strategy.source,
      marketId: market.conditionId,
      marketQuestion: market.question,
      market,
      tokenId: opponent.tokenId,
      outcome: opponent.outcome,
      side,
      sizeUsd,
      limitPriceCents: clamp(limitPriceCents ?? 52, 5, 95),
      confidence: event.status.toLowerCase() === 'out' ? 0.8 : 0.65,
      reason,
      expiresAt: expiry,
      metadata: {
        player: event.player,
        status: event.status,
        comment: event.comment,
      },
    });
  }

  return results;
}

async function fetchInjuries(apiKey: string): Promise<InjurySignalCandidate[]> {
  const url = `https://api.sportradar.us/nba/trial/v8/en/league/injuries.json?api_key=${apiKey}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      const text = await response.text();
      logger.warn('strategies.sportradar.httpError', {
        status: response.status,
        body: text?.slice(0, 200),
      });
      return [];
    }
    const parsed = sportradarResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      logger.warn('strategies.sportradar.parseFailed', { error: parsed.error.message });
      return [];
    }
    const candidates: InjurySignalCandidate[] = [];
    for (const team of parsed.data.teams) {
      const teamName = buildTeamName(team);
      const alias = team.alias;
      const simpleInjuries = team.injuries ?? [];
      for (const injury of simpleInjuries) {
        if (!injury.status) continue;
        candidates.push({
          team: teamName,
          alias,
          player: injury.full_name ?? 'Unknown player',
          status: injury.status,
          comment: injury.comment,
          updatedAt: injury.update_date,
        });
      }
      for (const player of team.players ?? []) {
        const timeline = player.injuries ?? [player];
        for (const injury of timeline) {
          const status = injury.status ?? player.status;
          if (!status) continue;
          candidates.push({
            team: teamName,
            alias,
            player: player.full_name ?? 'Unknown player',
            status,
            comment: injury.comment ?? player.comment,
            updatedAt: injury.update_date ?? player.update_date,
          });
        }
      }
    }
    return candidates;
  } catch (error) {
    logger.error('strategies.sportradar.fetchFailed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function buildTeamName(team: z.infer<typeof teamSchema>) {
  if (team.market) {
    return `${team.market} ${team.name}`;
  }
  return team.name;
}

function isMarketAboutTeam(market: Market, team: string, alias?: string) {
  const normalizedTeam = normalize(team);
  const normalizedAlias = alias ? normalize(alias) : null;
  return (
    includesNormalized(market.question, normalizedTeam) ||
    (!!normalizedAlias && includesNormalized(market.question, normalizedAlias)) ||
    (market.primaryOutcome && includesNormalized(market.primaryOutcome, normalizedTeam)) ||
    (market.secondaryOutcome && includesNormalized(market.secondaryOutcome, normalizedTeam)) ||
    (normalizedAlias &&
      market.primaryOutcome &&
      includesNormalized(market.primaryOutcome, normalizedAlias)) ||
    (normalizedAlias &&
      market.secondaryOutcome &&
      includesNormalized(market.secondaryOutcome, normalizedAlias))
  );
}

function resolveOpponentToken(market: Market, team: string, alias?: string) {
  const normalizedTeam = normalize(team);
  const normalizedAlias = alias ? normalize(alias) : null;
  const primaryMatch =
    (market.primaryOutcome && includesNormalized(market.primaryOutcome, normalizedTeam)) ||
    (normalizedAlias && market.primaryOutcome && includesNormalized(market.primaryOutcome, normalizedAlias));
  const secondaryMatch =
    (market.secondaryOutcome && includesNormalized(market.secondaryOutcome, normalizedTeam)) ||
    (normalizedAlias &&
      market.secondaryOutcome &&
      includesNormalized(market.secondaryOutcome, normalizedAlias));

  if (primaryMatch) {
    return {
      tokenId: market.secondaryTokenId ?? market.primaryTokenId ?? '',
      outcome: market.secondaryOutcome ?? market.primaryOutcome,
      side: 'secondary' as const,
    };
  }
  if (secondaryMatch) {
    return {
      tokenId: market.primaryTokenId ?? market.secondaryTokenId ?? '',
      outcome: market.primaryOutcome ?? market.secondaryOutcome,
      side: 'primary' as const,
    };
  }
  return null;
}

function includesNormalized(input: string | null | undefined, needle: string) {
  if (!input) return false;
  const normalizedInput = normalize(input);
  return normalizedInput.includes(needle) || needle.includes(normalizedInput);
}

function normalize(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}


