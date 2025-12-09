import { useQuery } from '@tanstack/react-query';

type ClobBalanceResponse = {
  clob?: {
    balance: number;
    allowance: number;
    rawBalance: string;
    rawAllowance: string;
  };
  error?: string;
};

async function fetchClobBalance(): Promise<ClobBalanceResponse> {
  const response = await fetch('/api/polymarket/balances', { method: 'GET' });
  const json = (await response.json()) as ClobBalanceResponse;
  if (!response.ok) {
    const error = json?.error ?? 'Unable to load CLOB balance';
    throw new Error(error);
  }
  return json;
}

export function useClobBalance(enabled = true) {
  return useQuery({
    queryKey: ['clob-balance'],
    queryFn: fetchClobBalance,
    enabled,
    staleTime: 15_000,
  });
}
