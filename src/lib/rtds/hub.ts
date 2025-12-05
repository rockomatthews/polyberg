'use server';

import { RealTimeDataClient, type Message } from '@polymarket/real-time-data-client';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

type MarketLiveStatus = 'open' | 'resolved' | 'suspended';

export type MarketLiveState = {
  conditionId: string;
  bestBidCents: number | null;
  bestAskCents: number | null;
  lastTradeCents: number | null;
  updatedAt: number;
  status: MarketLiveStatus;
};

type HubStore = {
  client: RealTimeDataClient | null;
  state: Map<string, MarketLiveState>;
  subscribed: boolean;
};

declare global {
  var __polybergRtdsStore: HubStore | undefined;
}

function getStore(): HubStore {
  if (!globalThis.__polybergRtdsStore) {
    globalThis.__polybergRtdsStore = {
      client: null,
      state: new Map(),
      subscribed: false,
    };
  }
  return globalThis.__polybergRtdsStore;
}

function ensureClient(): HubStore | null {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (!env.rtdsEnabled) {
    return null;
  }

  const store = getStore();
  if (!store.client) {
    const client = new RealTimeDataClient({
      host: env.rtdsUrl,
      pingInterval: env.rtdsPingMs,
      autoReconnect: true,
      onConnect: (connected) => {
        logger.info('rtds.connected', { host: env.rtdsUrl });
        subscribeToFeeds(connected, store);
      },
      onMessage: (_client, message) => handleMessage(store, message),
      onStatusChange: (status) => {
        logger.info('rtds.status', { status });
      },
    });
    client.connect();
    store.client = client;
  }
  return store;
}

function subscribeToFeeds(client: RealTimeDataClient, store: HubStore) {
  if (store.subscribed) return;
  try {
    client.subscribe({
      subscriptions: [
        { topic: 'clob_market', type: 'agg_orderbook' },
        { topic: 'clob_market', type: 'price_change' },
        { topic: 'clob_market', type: 'last_trade_price' },
        { topic: 'clob_market', type: 'market_created' },
        { topic: 'clob_market', type: 'market_resolved' },
        { topic: 'clob_market', type: 'tick_size_change' },
      ],
    });
    store.subscribed = true;
  } catch (error) {
    logger.error('rtds.subscribe.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function handleMessage(store: HubStore, message: Message) {
  if (message.topic !== 'clob_market') {
    return;
  }
  switch (message.type) {
    case 'agg_orderbook':
      return handleOrderBook(store, message.payload);
    case 'price_change':
      return handlePriceChange(store, message.payload);
    case 'last_trade_price':
      return handleLastTrade(store, message.payload);
    case 'market_created':
      return markStatus(store, message.payload, 'open');
    case 'market_resolved':
      return markStatus(store, message.payload, 'resolved');
    default:
      return;
  }
}

type AggregatedBookPayload = {
  market?: string;
  bids?: Array<{ price?: string | number }>;
  asks?: Array<{ price?: string | number }>;
  timestamp?: string;
};

type PriceChangePayload = {
  market?: string;
  price_changes?: Array<{
    best_bid?: string | number | null;
    best_ask?: string | number | null;
  }>;
  timestamp?: string;
};

type LastTradePayload = {
  market?: string;
  price?: string | number;
  timestamp?: string;
};

type MarketStatusPayload = {
  market?: string;
};

function handleOrderBook(store: HubStore, payload: unknown) {
  const data = payload as AggregatedBookPayload;
  if (!data?.market) return;
  const bestBid = data.bids?.[0]?.price;
  const bestAsk = data.asks?.[0]?.price;
  if (bestBid == null && bestAsk == null) {
    return;
  }
  upsertMarket(store, data.market, {
    bestBidCents: convertDecimalToCents(bestBid),
    bestAskCents: convertDecimalToCents(bestAsk),
    updatedAt: resolveTimestamp(data.timestamp),
  });
}

function handlePriceChange(store: HubStore, payload: unknown) {
  const data = payload as PriceChangePayload;
  if (!data?.market) return;
  const change = data.price_changes?.[0];
  if (!change) return;
  upsertMarket(store, data.market, {
    bestBidCents: convertDecimalToCents(change.best_bid),
    bestAskCents: convertDecimalToCents(change.best_ask),
    updatedAt: resolveTimestamp(data.timestamp),
  });
}

function handleLastTrade(store: HubStore, payload: unknown) {
  const data = payload as LastTradePayload;
  if (!data?.market) return;
  upsertMarket(store, data.market, {
    lastTradeCents: convertDecimalToCents(data.price),
    updatedAt: resolveTimestamp(data.timestamp),
  });
}

function markStatus(store: HubStore, payload: unknown, status: MarketLiveStatus) {
  const data = payload as MarketStatusPayload;
  if (!data?.market) return;
  upsertMarket(store, data.market, {
    status,
    updatedAt: Date.now(),
  });
}

function upsertMarket(
  store: HubStore,
  conditionId: string,
  patch: Partial<Omit<MarketLiveState, 'conditionId'>> = {},
) {
  const existing =
    store.state.get(conditionId) ??
    ({
      conditionId,
      bestBidCents: null,
      bestAskCents: null,
      lastTradeCents: null,
      updatedAt: Date.now(),
      status: 'open',
    } satisfies MarketLiveState);

  const next: MarketLiveState = {
    ...existing,
    ...patch,
    status: patch.status ?? existing.status,
  };

  store.state.set(conditionId, next);
}

function convertDecimalToCents(value?: string | number | null) {
  if (value == null) return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Number((numeric * 100).toFixed(2));
}

function resolveTimestamp(value?: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

export function getLiveMarketOverlay(conditionId: string): MarketLiveState | null {
  const store = ensureClient();
  if (!store) return null;
  return store.state.get(conditionId) ?? null;
}

export function getLiveMarketSnapshot(): Map<string, MarketLiveState> {
  const store = ensureClient();
  if (!store) return new Map();
  return store.state;
}


