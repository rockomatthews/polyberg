import { logger } from '@/lib/logger';
import { getManagedPositions } from '@/lib/autonomy/managedPositions';
import type { StrategyDefinition, StrategySignal } from '@/lib/autonomy/types';
import { fetchBestPrices } from '@/lib/polymarket/orderbookService';

export async function runMakerReversionStrategy(
  strategy: StrategyDefinition,
  now: Date,
): Promise<StrategySignal[]> {
  const managed = await getManagedPositions();
  if (!managed.length) {
    return [];
  }

  const spreadThreshold =
    typeof strategy.params?.spreadThreshold === 'number'
      ? Number(strategy.params.spreadThreshold)
      : 1.5;
  const maxHoldMinutes =
    typeof strategy.params?.maxHoldMinutes === 'number'
      ? Number(strategy.params.maxHoldMinutes)
      : 20;

  const signals: StrategySignal[] = [];

  for (const position of managed) {
    const { bestBidCents, bestAskCents } = await fetchBestPrices(position.tokenId);
    const spread =
      bestBidCents != null && bestAskCents != null ? bestAskCents - bestBidCents : Number.POSITIVE_INFINITY;
    const ageMinutes = Math.max(
      0,
      (now.getTime() - new Date(position.enteredAt).getTime()) / 60000,
    );

    let reason: string | null = null;
    if (isFinite(spread) && spread <= spreadThreshold) {
      reason = `Spread normalized to ${spread.toFixed(2)}¢`;
    }
    if (ageMinutes >= maxHoldMinutes) {
      reason = reason
        ? `${reason}; exceeded ${maxHoldMinutes}m hold`
        : `Exceeded ${maxHoldMinutes}m hold`;
    }

    if (!reason) {
      continue;
    }

    const exitSide = position.side === 'BUY' ? 'SELL' : 'BUY';
    const limitPriceCents = exitSide === 'SELL' ? bestBidCents : bestAskCents;
    if (limitPriceCents == null) {
      logger.warn('strategies.makerExit.missingPrice', {
        strategyId: strategy.id,
        marketId: position.marketId,
      });
      continue;
    }

    signals.push({
      strategyId: strategy.id,
      source: strategy.source,
      mode: strategy.mode,
      marketId: position.marketId,
      marketQuestion: position.question ?? 'Unknown market',
      tokenId: position.tokenId,
      outcome: position.outcome,
      side: exitSide,
      sizeUsd: position.sizeUsd,
      limitPriceCents,
      confidence: 0.65,
      reason,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      intent: 'exit',
    });
  }

  return signals;
}


