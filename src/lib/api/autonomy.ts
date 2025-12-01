import type { StrategyDefinition, StrategyRunSummary } from '@/lib/autonomy/types';

async function apiRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = (await response.text()) || 'Autonomy API request failed';
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export type StrategyOverviewResponse = {
  strategies: StrategyDefinition[];
  runs: StrategyRunSummary[];
  tradingEnabled: boolean;
  cronConfigured: boolean;
  autonomyDisabled: boolean;
};

export async function fetchStrategyOverview(): Promise<StrategyOverviewResponse> {
  return apiRequest<StrategyOverviewResponse>('/api/autonomy/strategies');
}

export async function runStrategiesNow(): Promise<StrategyRunSummary> {
  return apiRequest<StrategyRunSummary>('/api/autonomy/strategies', {
    method: 'POST',
  });
}


