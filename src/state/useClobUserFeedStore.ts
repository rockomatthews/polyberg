'use client';

import { create } from 'zustand';

const MAX_RECORDS = 40;

export type ClobOrderEvent = {
  id: string;
  marketId: string | null;
  status: string | null;
  side: 'BUY' | 'SELL' | null;
  priceCents: number | null;
  size: number | null;
  matched: number | null;
  type: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export type ClobTradeEvent = {
  id: string;
  marketId: string | null;
  side: 'BUY' | 'SELL' | null;
  priceCents: number | null;
  size: number | null;
  timestamp: number | null;
  transactionHash: string | null;
};

type ClobUserFeedState = {
  connected: boolean;
  recentOrders: ClobOrderEvent[];
  recentTrades: ClobTradeEvent[];
  lastEventAt: number | null;
  setConnected: (connected: boolean) => void;
  pushOrder: (event: ClobOrderEvent) => void;
  pushTrade: (event: ClobTradeEvent) => void;
  reset: () => void;
};

function trim<T>(items: T[]): T[] {
  if (items.length <= MAX_RECORDS) {
    return items;
  }
  return items.slice(0, MAX_RECORDS);
}

export const useClobUserFeedStore = create<ClobUserFeedState>((set) => ({
  connected: false,
  recentOrders: [],
  recentTrades: [],
  lastEventAt: null,
  setConnected: (connected) => set({ connected }),
  pushOrder: (event) =>
    set((state) => {
      const filtered = state.recentOrders.filter((existing) => existing.id !== event.id);
      const next = trim([event, ...filtered]);
      return {
        recentOrders: next,
        lastEventAt: Date.now(),
      };
    }),
  pushTrade: (event) =>
    set((state) => {
      const filtered = state.recentTrades.filter((existing) => existing.id !== event.id);
      const next = trim([event, ...filtered]);
      return {
        recentTrades: next,
        lastEventAt: Date.now(),
      };
    }),
  reset: () =>
    set({
      connected: false,
      recentOrders: [],
      recentTrades: [],
      lastEventAt: null,
    }),
}));


