import { redisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';
import type { ExecutionIntent, StrategyDefinition, StrategySignal } from '@/lib/autonomy/types';

export async function applyRiskControls(
  strategy: StrategyDefinition,
  signals: StrategySignal[],
  now: Date,
): Promise<ExecutionIntent[]> {
  const intents: ExecutionIntent[] = [];

  for (const signal of signals) {
    const clampedNotional =
      signal.intent === 'exit' ? signal.sizeUsd : Math.min(signal.sizeUsd, strategy.maxNotional);
    const normalizedPrice = clamp(signal.limitPriceCents / 100, 0.01, 0.99);
    const sizeShares = Number((clampedNotional / normalizedPrice).toFixed(4));

    if (!Number.isFinite(sizeShares) || sizeShares <= 0) {
      logger.warn('strategies.risk.invalidSize', {
        strategyId: strategy.id,
        marketId: signal.marketId,
        reason: 'Size not finite',
      });
      continue;
    }

    if (signal.intent !== 'exit') {
      const permitted = await reserveDailyNotional(strategy, clampedNotional, now);
      if (!permitted) {
        logger.warn('strategies.risk.dailyCap', {
          strategyId: strategy.id,
          marketId: signal.marketId,
        });
        continue;
      }
    }

    intents.push({
      ...signal,
      notionalUsd: clampedNotional,
      limitPrice: normalizedPrice,
      sizeShares,
    });
  }

  return intents;
}

async function reserveDailyNotional(
  strategy: StrategyDefinition,
  amount: number,
  now: Date,
) {
  if (!redisClient) {
    return true;
  }
  const key = buildDailyKey(strategy.id, now);
  const current = ((await redisClient.get<number>(key)) ?? 0) as number;
  const nextValue = current + amount;
  if (strategy.dailyCap && nextValue > strategy.dailyCap) {
    return false;
  }
  await redisClient.incrbyfloat(key, amount);
  const ttlSeconds = secondsUntilMidnight(now);
  await redisClient.expire(key, ttlSeconds);
  return nextValue <= Number.MAX_SAFE_INTEGER;
}

function buildDailyKey(strategyId: string, now: Date) {
  const day = now.toISOString().slice(0, 10);
  return `autonomy:strategy:${strategyId}:daily:${day}`;
}

function secondsUntilMidnight(now: Date) {
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}


