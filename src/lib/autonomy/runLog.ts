import type { StrategyRunSummary } from '@/lib/autonomy/types';
import { redisClient } from '@/lib/redis';

const RUN_LOG_KEY = 'autonomy:runs';
const MAX_RUNS = 20;

const fallbackRuns: StrategyRunSummary[] = [];

export async function recordStrategyRun(summary: StrategyRunSummary) {
  if (redisClient) {
    try {
      await redisClient.lpush(RUN_LOG_KEY, JSON.stringify(summary));
      await redisClient.ltrim(RUN_LOG_KEY, 0, MAX_RUNS - 1);
      return;
    } catch {
      // fall through to in-memory cache
    }
  }
  fallbackRuns.unshift(summary);
  if (fallbackRuns.length > MAX_RUNS) {
    fallbackRuns.length = MAX_RUNS;
  }
}

export async function fetchRecentStrategyRuns(limit = 10): Promise<StrategyRunSummary[]> {
  if (redisClient) {
    try {
      const rows = await redisClient.lrange<string>(RUN_LOG_KEY, 0, limit - 1);
      return rows
        .map((row) => {
          try {
            return JSON.parse(row) as StrategyRunSummary;
          } catch {
            return null;
          }
        })
        .filter((value): value is StrategyRunSummary => Boolean(value?.runAt));
    } catch {
      // fall through to memory
    }
  }
  return fallbackRuns.slice(0, limit);
}


