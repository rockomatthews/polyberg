'use client';

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';

import {
  useClobUserFeedStore,
  type ClobOrderEvent,
  type ClobTradeEvent,
} from '@/state/useClobUserFeedStore';

type OrderPayload = {
  id?: string;
  market?: string;
  order_type?: string;
  status?: string;
  side?: 'BUY' | 'SELL';
  price?: string | number | null;
  original_size?: string | number | null;
  size_matched?: string | number | null;
  created_at?: string | number | null;
  last_update?: string | number | null;
  expiration?: string | number | null;
};

type TradePayload = {
  id?: string;
  market?: string;
  side?: 'BUY' | 'SELL';
  price?: string | number | null;
  size?: string | number | null;
  match_time?: string | number | null;
  last_update?: string | number | null;
  transaction_hash?: string | null;
};

const toNumber = (value?: string | number | null) => {
  if (value == null) return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
};

const toTimestamp = (value?: string | number | null) => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
};

const toCents = (value?: string | number | null) => {
  const numeric = toNumber(value);
  if (numeric == null) return null;
  return Number((numeric * 100).toFixed(2));
};

function mapOrder(payload: OrderPayload): ClobOrderEvent {
  return {
    id: payload.id ?? crypto.randomUUID(),
    marketId: payload.market ?? null,
    status: payload.status ?? null,
    side: payload.side ?? null,
    priceCents: toCents(payload.price),
    size: toNumber(payload.original_size),
    matched: toNumber(payload.size_matched),
    type: payload.order_type ?? null,
    createdAt: toTimestamp(payload.created_at),
    updatedAt: toTimestamp(payload.last_update ?? payload.expiration),
  };
}

function mapTrade(payload: TradePayload): ClobTradeEvent {
  return {
    id: payload.id ?? crypto.randomUUID(),
    marketId: payload.market ?? null,
    side: payload.side ?? null,
    priceCents: toCents(payload.price),
    size: toNumber(payload.size),
    timestamp: toTimestamp(payload.match_time ?? payload.last_update),
    transactionHash: payload.transaction_hash ?? null,
  };
}

export function ClobUserFeedBridge() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const setConnected = useClobUserFeedStore((state) => state.setConnected);
  const pushOrder = useClobUserFeedStore((state) => state.pushOrder);
  const pushTrade = useClobUserFeedStore((state) => state.pushTrade);
  const reset = useClobUserFeedStore((state) => state.reset);

  React.useEffect(() => {
    if (status !== 'authenticated') {
      reset();
      return;
    }

    let isActive = true;
    const source = new EventSource('/api/polymarket/stream/clob-user');

    const handleStatus = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as { connected?: boolean };
        if (typeof data.connected === 'boolean') {
          setConnected(data.connected);
        }
      } catch {
        /* noop */
      }
    };

    const handleOrder = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as { payload?: OrderPayload };
        if (parsed?.payload) {
          pushOrder(mapOrder(parsed.payload));
          void queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(() => undefined);
        }
      } catch {
        /* ignore malformed payload */
      }
    };

    const handleTrade = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as { payload?: TradePayload };
        if (parsed?.payload) {
          pushTrade(mapTrade(parsed.payload));
          void queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(() => undefined);
          void queryClient.invalidateQueries({ queryKey: ['positions'] }).catch(() => undefined);
          void queryClient.invalidateQueries({ queryKey: ['safe-balance'] }).catch(() => undefined);
        }
      } catch {
        /* ignore malformed payload */
      }
    };

    source.addEventListener('status', handleStatus);
    source.onopen = () => {
      setConnected(true);
    };
    source.addEventListener('order', handleOrder);
    source.addEventListener('trade', handleTrade);
    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      if (!isActive) return;
      isActive = false;
      source.onopen = null;
      source.onerror = null;
      source.removeEventListener('status', handleStatus);
      source.removeEventListener('order', handleOrder);
      source.removeEventListener('trade', handleTrade);
      source.close();
      setConnected(false);
    };
  }, [status, pushOrder, pushTrade, queryClient, reset, setConnected]);

  return null;
}


