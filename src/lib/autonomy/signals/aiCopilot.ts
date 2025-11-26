import { generateObject } from 'ai';
import { z } from 'zod';

import { aiApiKey } from '@/lib/ai/config';
import { loadMarketSnapshots } from '@/lib/polymarket/marketService';
import { logger } from '@/lib/logger';
import type { StrategyDefinition, StrategySignal } from '@/lib/autonomy/types';

const aiOpportunitySchema = z.object({
  conditionId: z.string(),
  outcome: z.string(),
  side: z.enum(['BUY', 'SELL']),
  confidence: z.number().min(0).max(1).default(0.6),
  limitPriceCents: z.number().min(1).max(99),
  sizeUsd: z.number().min(5),
  rationale: z.string(),
});

const aiResponseSchema = z.object({
  opportunities: z.array(aiOpportunitySchema).max(3),
});

export async function runAiConfidenceStrategy(
  strategy: StrategyDefinition,
  now: Date,
): Promise<StrategySignal[]> {
  if (!aiApiKey) {
    logger.warn('strategies.ai.disabled', { strategyId: strategy.id });
    return [];
  }

  const markets = await loadMarketSnapshots({ limit: 8 });
  if (!markets.length) {
    logger.warn('strategies.ai.noMarkets', { strategyId: strategy.id });
    return [];
  }

  const prompt = buildPrompt(markets, strategy);

  let parsed;
  try {
    parsed = await generateObject({
      model: 'openai/gpt-4o-mini',
      prompt,
      schema: aiResponseSchema,
    });
  } catch (error) {
    logger.error('strategies.ai.promptFailed', {
      strategyId: strategy.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const opportunities = parsed.object.opportunities ?? [];
  const results: StrategySignal[] = [];
  const expiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  for (const opp of opportunities) {
    const market = markets.find((mkt) => mkt.conditionId === opp.conditionId);
    if (!market) {
      logger.warn('strategies.ai.badMarket', {
        strategyId: strategy.id,
        conditionId: opp.conditionId,
      });
      continue;
    }
    const token = matchOutcomeToToken(market, opp.outcome);
    if (!token?.tokenId) {
      logger.warn('strategies.ai.badOutcome', {
        strategyId: strategy.id,
        conditionId: market.conditionId,
        outcome: opp.outcome,
      });
      continue;
    }

    const limitPriceCents = clamp(opp.limitPriceCents, 1, 99);
    const sizeUsd = Math.min(opp.sizeUsd, strategy.maxNotional);

    results.push({
      strategyId: strategy.id,
      source: strategy.source,
      marketId: market.conditionId,
      marketQuestion: market.question,
      market,
      tokenId: token.tokenId,
      outcome: token.outcome,
      side: opp.side,
      sizeUsd,
      limitPriceCents,
      confidence: clamp(opp.confidence, 0.1, 1),
      reason: opp.rationale,
      expiresAt: expiry,
      metadata: {
        response: opp,
      },
    });
  }

  return results;
}

function buildPrompt(markets: Awaited<ReturnType<typeof loadMarketSnapshots>>, strategy: StrategyDefinition) {
  const marketLines = markets
    .map((market, idx) => {
      const primary = market.primaryOutcome
        ? `${market.primaryOutcome} (${market.primaryTokenId})`
        : 'Outcome A';
      const secondary = market.secondaryOutcome
        ? `${market.secondaryOutcome} (${market.secondaryTokenId})`
        : 'Outcome B';
      return `${idx + 1}. ${market.question}\n   • conditionId: ${market.conditionId}\n   • outcomes: ${primary} vs ${secondary}\n   • bid ${fmt(market.bestBid)}¢ / ask ${fmt(
        market.bestAsk,
      )}¢ liquidity ${market.liquidity ?? 'n/a'}`;
    })
    .join('\n\n');

  return [
    'You are an autonomous Polymarket sniping agent. Review the markets below and output up to 3 high-conviction trades.',
    'Only choose markets from the provided list. When you respond, use their exact conditionId and outcome strings.',
    `Each trade must respect these guardrails: max notional $${strategy.maxNotional.toFixed(
      0,
    )}, limit price between 1¢ and 99¢, and confidence between 0 and 1.`,
    'Return JSON only, matching the provided schema.',
    '',
    'Markets:',
    marketLines,
    '',
    'Focus on spreads, liquidity gaps, or clear catalysts. Keep rationales concise and factual.',
  ].join('\n');
}

function fmt(value: number | null) {
  return value != null ? value.toFixed(2) : '––';
}

function matchOutcomeToToken(market: Awaited<ReturnType<typeof loadMarketSnapshots>>[number], outcome: string) {
  const normalized = normalize(outcome);
  if (market.primaryOutcome && normalize(market.primaryOutcome) === normalized) {
    return { tokenId: market.primaryTokenId, outcome: market.primaryOutcome };
  }
  if (market.secondaryOutcome && normalize(market.secondaryOutcome) === normalized) {
    return { tokenId: market.secondaryTokenId, outcome: market.secondaryOutcome };
  }
  if (market.primaryOutcome && normalize(market.primaryOutcome).includes(normalized)) {
    return { tokenId: market.primaryTokenId, outcome: market.primaryOutcome };
  }
  if (market.secondaryOutcome && normalize(market.secondaryOutcome).includes(normalized)) {
    return { tokenId: market.secondaryTokenId, outcome: market.secondaryOutcome };
  }
  return null;
}

function normalize(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}


