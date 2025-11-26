import { generateObject } from 'ai';
import { z } from 'zod';

import { aiApiKey } from '@/lib/ai/config';
import { logger } from '@/lib/logger';
import { getManagedPositions } from '@/lib/autonomy/managedPositions';
import type { StrategyDefinition, StrategySignal } from '@/lib/autonomy/types';
import { fetchBestPrices } from '@/lib/polymarket/orderbookService';

const exitSchema = z.object({
  exits: z
    .array(
      z.object({
        marketId: z.string(),
        tokenId: z.string(),
        limitPriceCents: z.number().min(1).max(99),
        reason: z.string(),
      }),
    )
    .max(3),
});

type ManagedContext = Awaited<ReturnType<typeof getManagedPositions>>[number] & {
  bestBidCents: number | null;
  bestAskCents: number | null;
};

export async function runAiExitStrategy(
  strategy: StrategyDefinition,
  now: Date,
): Promise<StrategySignal[]> {
  if (!aiApiKey) {
    logger.warn('strategies.aiExit.disabled', { strategyId: strategy.id });
    return [];
  }

  const managed = await getManagedPositions();
  if (!managed.length) {
    return [];
  }

  const contexts: ManagedContext[] = [];
  for (const position of managed) {
    const prices = await fetchBestPrices(position.tokenId);
    contexts.push({
      ...position,
      bestBidCents: prices.bestBidCents,
      bestAskCents: prices.bestAskCents,
    });
  }

  const prompt = buildPrompt(contexts, now);

  let parsed;
  try {
    parsed = await generateObject({
      model: 'openai/gpt-4o-mini',
      prompt,
      schema: exitSchema,
    });
  } catch (error) {
    logger.error('strategies.aiExit.promptFailed', {
      strategyId: strategy.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const exits = parsed.object.exits ?? [];
  const signals: StrategySignal[] = [];

  for (const exit of exits) {
    const context = contexts.find(
      (ctx) => ctx.marketId === exit.marketId && ctx.tokenId === exit.tokenId,
    );
    if (!context) {
      continue;
    }

    const exitSide = context.side === 'BUY' ? 'SELL' : 'BUY';
    const limitPriceCents =
      exitSide === 'SELL'
        ? clampPrice(exit.limitPriceCents, context.bestBidCents, 'SELL')
        : clampPrice(exit.limitPriceCents, context.bestAskCents, 'BUY');

    if (limitPriceCents == null) {
      continue;
    }

    signals.push({
      strategyId: strategy.id,
      source: strategy.source,
      mode: strategy.mode,
      marketId: context.marketId,
      marketQuestion: context.question ?? 'Unknown market',
      tokenId: context.tokenId,
      outcome: context.outcome,
      side: exitSide,
      sizeUsd: context.sizeUsd,
      limitPriceCents,
      confidence: 0.75,
      reason: exit.reason,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      intent: 'exit',
    });
  }

  return signals;
}

function buildPrompt(positions: ManagedContext[], now: Date) {
  const lines = positions
    .map((position, index) => {
      const ageMinutes = Math.max(
        0,
        Math.round((now.getTime() - new Date(position.enteredAt).getTime()) / 60000),
      );
      return `${index + 1}. ${position.question ?? 'Unknown market'} (${position.marketId})
   - Token: ${position.tokenId}
   - Exposure: $${position.sizeUsd.toFixed(2)} (${position.side === 'BUY' ? 'Long' : 'Short'})
   - Spread: ${formatSpread(position.bestBidCents, position.bestAskCents)}¢
   - Time held: ${ageMinutes} minutes`;
    })
    .join('\n\n');

  return [
    'You are an autonomous Polymarket exit director. Determine which existing positions should be closed now.',
    'Only reference the positions provided. Respond with JSON describing markets that should be unwound immediately, including a concise reason.',
    'Limit exits to situations where liquidity is adequate or the thesis is invalidated.',
    '',
    'Positions:',
    lines,
  ].join('\n');
}

function formatSpread(bid: number | null, ask: number | null) {
  if (bid == null || ask == null) return 'n/a';
  return (ask - bid).toFixed(2);
}

function clampPrice(
  requested: number,
  reference: number | null,
  side: 'BUY' | 'SELL',
): number | null {
  if (reference == null) {
    return requested;
  }
  if (side === 'SELL') {
    return Math.min(requested, reference);
  }
  return Math.max(requested, reference);
}


