'use server';

import { CronExpressionParser } from 'cron-parser';

import { logger } from '@/lib/logger';
import type {
  StrategyDefinition,
  StrategyHandler,
  StrategyRunResult,
  StrategyRunSummary,
} from '@/lib/autonomy/types';
import { applyRiskControls } from '@/lib/autonomy/risk';
import { executeIntents } from '@/lib/autonomy/orderExecutor';
import { runAiConfidenceStrategy } from '@/lib/autonomy/signals/aiCopilot';
import { runSportradarInjuryStrategy } from '@/lib/autonomy/signals/sportradar';

const STATIC_STRATEGIES: StrategyDefinition[] = [
  {
    id: 'ai-confidence-v1',
    name: 'AI Confidence Sniper',
    enabled: true,
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
    enabled: true,
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

export function listStrategies(): StrategyDefinition[] {
  return STATIC_STRATEGIES.map((strategy) => ({ ...strategy }));
}

/**
 * Entry point for the cron route. Evaluates every registered strategy and runs those that are due.
 */
export async function runScheduledStrategies(now = new Date()): Promise<StrategyRunSummary> {
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
      const summary = await executeStrategy(strategy, now);
      results.push(summary);
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
    const expression = CronExpressionParser.parse(schedule, {
      currentDate: now,
      tz: 'UTC',
    });
    const previous = expression.prev().toDate();
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

const handlers: Record<StrategyDefinition['source'], StrategyHandler> = {
  ai: runAiConfidenceStrategy,
  sportradar: runSportradarInjuryStrategy,
};

async function executeStrategy(
  strategy: StrategyDefinition,
  now: Date,
): Promise<StrategyRunResult> {
  const start = performance.now();
  const handler = handlers[strategy.source];
  if (!handler) {
    return {
      strategyId: strategy.id,
      status: 'error',
      reason: `no handler for source ${strategy.source}`,
      durationMs: performance.now() - start,
    };
  }

  const signals = await handler(strategy, now);
  if (!signals.length) {
    return {
      strategyId: strategy.id,
      status: 'skipped',
      reason: 'no qualifying signals',
      durationMs: performance.now() - start,
      signals: 0,
    };
  }

  const intents = await applyRiskControls(strategy, signals, now);
  if (!intents.length) {
    return {
      strategyId: strategy.id,
      status: 'skipped',
      reason: 'risk filters rejected signals',
      durationMs: performance.now() - start,
      signals: signals.length,
    };
  }

  const executions = await executeIntents(intents);
  const submitted = executions.filter((result) => result.status === 'submitted').length;

  return {
    strategyId: strategy.id,
    status: submitted > 0 ? 'queued' : 'skipped',
    tradesEnqueued: submitted,
    signals: signals.length,
    reason: submitted > 0 ? undefined : executions[0]?.reason ?? 'orders skipped',
    durationMs: performance.now() - start,
  };
}


