import {
  ActivityEvent,
  AlertRule,
  HealthResponse,
  Market,
  OrderBookSnapshot,
  OrdersResponse,
  Position,
  SystemStatus,
} from './types';
import { getCached, setCached, redisClient } from '@/lib/redis';

const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(path, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed for ${path}`);
  }

  return response.json() as Promise<T>;
};

export async function fetchMarkets(): Promise<Market[]> {
  try {
    const cached = await getCached<Market[]>('markets:latest');
    if (cached?.length) {
      return cached;
    }
  } catch (error) {
    console.warn('[cache] read markets failed', error);
  }
  try {
    const data = await apiGet<{ markets: Market[] }>('/api/polymarket/markets?limit=200');
    if (data.markets?.length) {
      setCached('markets:latest', data.markets, 5).catch((err) =>
        console.warn('[cache] set markets failed', err),
      );
      redisClient
        ?.publish('markets-updates', JSON.stringify({ ts: Date.now(), markets: data.markets }))
        .catch((err) => console.warn('[redis] publish markets failed', err));
    }
    return data.markets;
  } catch (error) {
    console.error('[api] fetchMarkets failed', error);
    return [];
  }
}

export async function fetchSportsMarkets(): Promise<Market[]> {
  try {
    const cached = await getCached<Market[]>('markets:sports:latest');
    if (cached?.length) {
      return cached;
    }
  } catch (error) {
    console.warn('[cache] read sports markets failed', error);
  }
  try {
    const data = await apiGet<{ markets: Market[] }>('/api/polymarket/sports?limit=250');
    if (data.markets?.length) {
      setCached('markets:sports:latest', data.markets, 5).catch((err) =>
        console.warn('[cache] set sports markets failed', err),
      );
    }
    return data.markets;
  } catch (error) {
    console.error('[api] fetchSportsMarkets failed', error);
    return [];
  }
}

export async function searchMarkets(query: string): Promise<Market[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const data = await apiGet<{ markets: Market[] }>(
      `/api/polymarket/search?q=${encodeURIComponent(trimmed)}&limit=20`,
    );
    return data.markets;
  } catch (error) {
    console.warn('[api] searchMarkets failed', error);
    return [];
  }
}

export async function fetchOrderBook(tokenId: string | null): Promise<OrderBookSnapshot | null> {
  if (!tokenId) {
    return null;
  }

  try {
    const cached = await getCached<OrderBookSnapshot>(`orderbook:${tokenId}:latest`);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn('[cache] read orderbook failed', error);
  }

  try {
    const snapshot = await apiGet<OrderBookSnapshot>(
      `/api/polymarket/orderbooks/${encodeURIComponent(tokenId)}`,
    );
    if (snapshot) {
      setCached(`orderbook:${tokenId}:latest`, snapshot, 5).catch((err) =>
        console.warn('[cache] set orderbook failed', err),
      );
      redisClient
        ?.publish(
          `orderbook-updates:${tokenId}`,
          JSON.stringify({ ts: Date.now(), book: snapshot }),
        )
        .catch((err) => console.warn('[redis] publish orderbook failed', err));
    }
    return snapshot;
  } catch (error) {
    console.error('[api] fetchOrderBook failed', error);
    return null;
  }
}

type PositionsResponse = {
  positions: Position[];
  meta?: {
    error?: string;
    requiresBuilderSigning?: boolean;
  };
};

export async function fetchPositions(): Promise<PositionsResponse> {
  try {
    return await apiGet<PositionsResponse>('/api/polymarket/positions');
  } catch (error) {
    console.warn('[api] fetchPositions failed', error);
    return {
      positions: [],
      meta: {
        error: error instanceof Error ? error.message : 'Failed to load positions',
        requiresBuilderSigning: true,
      },
    };
  }
}

export async function fetchOrders(): Promise<OrdersResponse> {
  try {
    return await apiGet<OrdersResponse>('/api/polymarket/orders');
  } catch (error) {
    console.warn('[api] fetchOrders failed', error);
    return {
      orders: [],
      meta: {
        error: error instanceof Error ? error.message : 'Failed to load orders',
        requiresBuilderSigning: true,
      },
    };
  }
}

export async function fetchAlerts(): Promise<AlertRule[]> {
  try {
    const data = await apiGet<{ alerts: AlertRule[] }>('/api/polymarket/alerts');
    return data.alerts;
  } catch (error) {
    console.warn('[api] fetchAlerts failed', error);
    return [];
  }
}

export async function fetchActivity(): Promise<ActivityEvent[]> {
  try {
    const data = await apiGet<{ events: ActivityEvent[] }>('/api/polymarket/activity');
    return data.events;
  } catch (error) {
    console.warn('[api] fetchActivity failed', error);
    return [];
  }
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  try {
    return await apiGet<SystemStatus>('/api/polymarket/system-status');
  } catch (error) {
    console.warn('[api] fetchSystemStatus failed', error);
    return {
      latencyMs: null,
      walletLabel: 'Builder Wallet',
      walletBalance: null,
      relayerConnected: false,
    };
  }
}

export async function fetchHealthStatus(): Promise<HealthResponse | null> {
  try {
    return await apiGet<HealthResponse>('/api/health');
  } catch (error) {
    console.warn('[api] fetchHealthStatus failed', error);
    return null;
  }
}

