import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type SafeStatusResponse = {
  state: 'disabled' | 'missing' | 'pending' | 'ready' | 'error';
  safeAddress: string | null;
  statusLabel: string;
  deploymentTxHash?: string | null;
  metadata?: Record<string, unknown> | null;
  updatedAt?: string | null;
  relayer: {
    configured: boolean;
    url?: string | null;
  };
  requireSafe: boolean;
};

async function fetchSafeStatus(): Promise<SafeStatusResponse> {
  const response = await fetch('/api/profile/safe-status');
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || 'Unable to load Safe status');
  }
  return json;
}

async function requestSafe(): Promise<SafeStatusResponse> {
  const response = await fetch('/api/profile/request-safe', { method: 'POST' });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || 'Safe deployment failed');
  }
  return json;
}

export function useSafeStatus() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['safe-status'],
    queryFn: fetchSafeStatus,
    staleTime: 10_000,
    retry: 1,
  });

  const requestMutation = useMutation({
    mutationKey: ['safe-request'],
    mutationFn: requestSafe,
    onSuccess: (data) => {
      queryClient.setQueryData(['safe-status'], data);
    },
  });

  return {
    safeStatus: statusQuery.data,
    safeLoading: statusQuery.isLoading,
    safeError: statusQuery.error,
    refetchSafe: statusQuery.refetch,
    requestSafe: requestMutation,
  };
}


