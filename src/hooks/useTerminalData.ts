import { useQuery } from '@tanstack/react-query';

import {
  fetchActivity,
  fetchAlerts,
  fetchHealthStatus,
  fetchMarkets,
  fetchOrderBook,
  fetchOrders,
  fetchPositions,
  fetchSystemStatus,
} from '@/lib/api/polymarket';

export function useMarketsData() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
    staleTime: 15_000,
  });
}

export function useOrderBookData(tokenId: string | null) {
  return useQuery({
    queryKey: ['orderbook', tokenId],
    queryFn: () => fetchOrderBook(tokenId),
    enabled: Boolean(tokenId),
    refetchInterval: 1_500,
  });
}

export function usePositionsData() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: fetchPositions,
    refetchInterval: 10_000,
  });
}

export function useOrdersData() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
    refetchInterval: 5_000,
  });
}

export function useAlertsData() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 15_000,
  });
}

export function useActivityFeed() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    refetchInterval: 4_000,
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: fetchSystemStatus,
    refetchInterval: 3_000,
  });
}

export function useHealthStatus() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealthStatus,
    refetchInterval: 15_000,
  });
}

