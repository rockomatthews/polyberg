'use server';

import { parseExpression } from 'cron-parser';

import { logger } from '@/lib/logger';

/**
 * Core strategy definition. These are intentionally light-weight until we persist them in Postgres.
 */
export type StrategyDefinition = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string; // cron expression
  source: 'ai' | 'sportradar';
  maxNotional: number;
  dailyCap: number;
  params: Record<string, unknown>;
};

export type StrategyRunResult = {
  strategyId: string;
  status: 'skipped' | 'queued' | 'error';
  reason?: string;
  tradesEnqueued?: number;
  durationMs: number;
};

const STATIC_STRATEGIES: StrategyDefinition[] = [
  {
    id: 'ai-confidence-v1',
    name: 'AI Confidence Sniper',
    enabled: false,
    schedule: '*/1 * * * *',
    source: 'ai',
    maxNotional: 50,
    dailyCap: 200,
    params: {
      minConfidence: 0.75,
      maxSpread: 2,
      minLiquidity: 20000,
    },
  },
  {
    id: 'sportradar-injury-v1',
    name: 'Sportradar Injury Pulse',
    enabled: false,
    schedule: '*/1 * * * *',
    source: 'sportradar',
    maxNotional: 40,
    dailyCap: 200,
    params: {
      monitoredLeagues: ['NCAAMB', 'NBA'],
      injuryStatuses: ['Out', 'Doubtful'],
      maxSpread: 4,
      cooldownMinutes: 10,
    },
  },
];

/**
 * Entry point for the cron route. Evaluates every registered strategy and runs those that are due.
 */
export async function runScheduledStrategies(now = new Date()): Promise<{
  runAt: string;
  results: StrategyRunResult[];
}> {
  const results: StrategyRunResult[] = [];
  for (const strategy of STATIC_STRATEGIES) {
    const start = performance.now();
    if (!strategy.enabled) {
      results.push({
        strategyId: strategy.id,
        status: 'skipped',
        reason: 'disabled',
        durationMs: performance.now() - start,
      });
      continue;
    }
    if (!shouldRun(strategy.schedule, now)) {
      results.push({
        strategyId: strategy.id,
        status: 'skipped',
        reason: 'not due this tick',
        durationMs: performance.now() - start,
      });
      continue;
    }
    try {
      const trades = await executeStrategy(strategy);
      results.push({
        strategyId: strategy.id,
        status: trades > 0 ? 'queued' : 'skipped',
        tradesEnqueued: trades,
        reason: trades > 0 ? undefined : 'no qualifying signals',
        durationMs: performance.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('strategies.run.failed', {
        strategyId: strategy.id,
        error: message,
      });
      results.push({
        strategyId: strategy.id,
        status: 'error',
        reason: message,
        durationMs: performance.now() - start,
      });
    }
  }
  return {
    runAt: now.toISOString(),
    results,
  };
}

function shouldRun(schedule: string, now: Date) {
  try {
    const iterator = parseExpression(schedule, {
      currentDate: now,
      iterator: true,
      tz: 'UTC',
    });
    const previous = iterator.prev().value.toDate();
    const delta = Math.abs(now.getTime() - previous.getTime());
    // treat anything within a 60s window as due (because cron fires once per minute)
    return delta < 60_000;
  } catch (error) {
    logger.warn('strategies.schedule.invalid', {
      schedule,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function executeStrategy(strategy: StrategyDefinition): Promise<number> {
  // Placeholder until we wire real AI + Sportradar ingestion.
  logger.info('strategies.run.start', {
    strategyId: strategy.id,
    source: strategy.source,
  });
  // TODO: integrate AI + Sportradar signal evaluation and trade execution.
  return 0;
}


