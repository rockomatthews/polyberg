import type { Market } from '@/lib/api/types';

export type StrategySource = 'ai' | 'sportradar';

export type StrategyDefinition = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  source: StrategySource;
  maxNotional: number;
  dailyCap: number;
  params: Record<string, unknown>;
};

export type StrategySignal = {
  strategyId: string;
  source: StrategySource;
  marketId: string;
  marketQuestion: string;
  market?: Market;
  tokenId: string;
  outcome?: string | null;
  side: 'BUY' | 'SELL';
  sizeUsd: number;
  limitPriceCents: number;
  confidence: number;
  reason: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
};

export type ExecutionIntent = StrategySignal & {
  limitPrice: number; // normalized 0-1
  sizeShares: number;
  notionalUsd: number;
};

export type StrategyRunResult = {
  strategyId: string;
  status: 'skipped' | 'queued' | 'error';
  reason?: string;
  signals?: number;
  tradesEnqueued?: number;
  durationMs: number;
};

export type StrategyHandler = (
  strategy: StrategyDefinition,
  now: Date,
) => Promise<StrategySignal[]>;

export type StrategyRunSummary = {
  runAt: string;
  results: StrategyRunResult[];
};


