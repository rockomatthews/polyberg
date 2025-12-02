export type MarketCategory =
  | 'sports'
  | 'entertainment'
  | 'crypto'
  | 'politics'
  | 'macro'
  | 'other';

export type MarketOutcome = {
  tokenId: string | null;
  label: string | null;
  price: number | null;
};

export type Market = {
  conditionId: string;
  question: string;
  slug: string;
  icon: string | null;
  tag: string | null;
  endDate: string | null;
  primaryTokenId: string | null;
  secondaryTokenId: string | null;
  primaryOutcome: string | null;
  secondaryOutcome: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  liquidity: number | null;
  outcomes: MarketOutcome[];
  category: MarketCategory;
};

export type OrderBookLevel = {
  price: number;
  size: number;
};

export type OrderBookSnapshot = {
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  updatedAt: string;
};

export type Position = {
  market: string;
  exposure: number;
  pnl: number;
  delta: 'Long' | 'Short';
};

export type OrderEvent = {
  id: string;
  market: string;
  side: 'Buy' | 'Sell';
  price: number;
  size: number;
  status: string;
  createdAt: number;
};

export type AlertRule = {
  id: string;
  label: string;
  status: 'Triggered' | 'Armed';
  market: string;
};

export type ActivityEvent = {
  id: string;
  type: 'Trade' | 'Alert' | 'News';
  message: string;
  ts: string;
};

export type SystemStatus = {
  latencyMs: number | null;
  walletLabel: string;
  walletBalance: number | null;
  relayerConnected: boolean;
};

export type OrdersResponse = {
  orders: OrderEvent[];
  meta?: {
    error?: string;
    status?: number;
    requiresBuilderSigning?: boolean;
  };
};

export type HealthStatus = {
  ok: boolean;
  message?: string;
  latencyMs?: number;
  status?: number;
};

export type HealthResponse = {
  ok: boolean;
  checkedAt?: string;
  statuses?: Record<string, HealthStatus>;
  error?: string;
};

