'use client';

import { signIn, useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type WatchlistResponse = {
  watchlist: string[];
};

async function fetchWatchlist(): Promise<string[]> {
  const response = await fetch('/api/profile/watchlist', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load watchlist');
  }
  const data = (await response.json()) as WatchlistResponse;
  return data.watchlist ?? [];
}

export function useUserWatchlist() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist,
    staleTime: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['watchlist'] });

  const addMutation = useMutation({
    mutationFn: async (conditionId: string) => {
      const response = await fetch('/api/profile/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionId }),
      });
      if (!response.ok) {
        throw new Error('Failed to add to watchlist');
      }
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (conditionId: string) => {
      const response = await fetch('/api/profile/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditionId }),
      });
      if (!response.ok) {
        throw new Error('Failed to remove from watchlist');
      }
    },
    onSuccess: invalidate,
  });

  const requestAuth = () => {
    const callbackUrl = typeof window !== 'undefined' ? window.location.href : '/';
    void signIn(undefined, { callbackUrl });
  };

  const toggleWatchlist = (conditionId: string, shouldWatch: boolean) => {
    if (!isAuthenticated) {
      requestAuth();
      return;
    }
    if (shouldWatch) {
      addMutation.mutate(conditionId);
    } else {
      removeMutation.mutate(conditionId);
    }
  };

  return {
    watchlist: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    toggleWatchlist,
    adding: addMutation.isPending,
    removing: removeMutation.isPending,
    isAuthenticated,
  };
}

