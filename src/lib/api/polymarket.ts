import {
  ActivityEvent,
  AlertRule,
  Market,
  OrderBookSnapshot,
  OrderEvent,
  Position,
  SystemStatus,
} from './types';

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
    const data = await apiGet<{ markets: Market[] }>('/api/polymarket/markets');
    return data.markets;
  } catch (error) {
    console.error('[api] fetchMarkets failed', error);
    return [];
  }
}

export async function fetchOrderBook(tokenId: string | null): Promise<OrderBookSnapshot | null> {
  if (!tokenId) {
    return null;
  }

  try {
    return await apiGet<OrderBookSnapshot>(
      `/api/polymarket/orderbooks/${encodeURIComponent(tokenId)}`,
    );
  } catch (error) {
    console.error('[api] fetchOrderBook failed', error);
    return null;
  }
}

export async function fetchPositions(): Promise<Position[]> {
  try {
    const data = await apiGet<{ positions: Position[] }>('/api/polymarket/positions');
    return data.positions;
  } catch (error) {
    console.warn('[api] fetchPositions failed', error);
    return [];
  }
}

export async function fetchOrders(): Promise<OrderEvent[]> {
  try {
    const data = await apiGet<{ orders: OrderEvent[] }>('/api/polymarket/orders');
    return data.orders;
  } catch (error) {
    console.warn('[api] fetchOrders failed', error);
    return [];
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

