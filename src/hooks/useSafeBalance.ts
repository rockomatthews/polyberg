'use client';

import { useQuery } from '@tanstack/react-query';

export type SafeBalanceResponse = {
  balance: number;
  raw: string;
  collateralAddress: string;
  meta?: Record<string, unknown>;
};

async function fetchSafeBalance(safeAddress: string): Promise<SafeBalanceResponse> {
  const response = await fetch(`/api/profile/safe-balance?safe=${safeAddress}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const json = await response.json();
  if (!response.ok) {
    const message =
      typeof json?.error === 'string' ? json.error : 'Unable to fetch Safe balance';
    throw new Error(message);
  }
  return json as SafeBalanceResponse;
}

type Options = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

export function useSafeBalance(safeAddress: string | null, options: Options = {}) {
  const enabled = Boolean(safeAddress) && (options.enabled ?? true);
  return useQuery({
    queryKey: ['safe-balance', safeAddress],
    queryFn: () => fetchSafeBalance(safeAddress as string),
    enabled,
    staleTime: 10_000,
    refetchInterval: enabled ? options.refetchInterval ?? 15_000 : undefined,
    retry: 1,
  });
}


