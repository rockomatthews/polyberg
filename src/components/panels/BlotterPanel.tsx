'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PanelCard } from './PanelCard';
import { useMarketsData, useOrdersData } from '@/hooks/useTerminalData';
import { useClobUserFeedStore } from '@/state/useClobUserFeedStore';

const statusColor: Record<string, 'success' | 'warning' | 'default'> = {
  FILLED: 'success',
  OPEN: 'warning',
  WORKING: 'warning',
  CANCELLED: 'default',
};

const SAMPLE_ORDERS = [
  { id: 'sample-1', market: 'ETH ETF approval before July', side: 'Buy', price: 58.2, size: 25_000, status: 'WORKING' },
  { id: 'sample-2', market: 'BTC above $90k on Dec 31', side: 'Sell', price: 44.5, size: 12_500, status: 'OPEN' },
  { id: 'sample-3', market: 'Democrats win Senate', side: 'Buy', price: 63.1, size: 32_000, status: 'FILLED' },
] as const;

const formatPrice = (value: number | null) => {
  if (value == null) {
    return '––';
  }
  return `${(value / 100).toFixed(2)}¢`;
};

const formatSize = (value: number | null) => {
  if (value == null) {
    return '––';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k`;
  }
  return value.toLocaleString();
};

const formatTimestamp = (value: number | null) => {
  if (!value) {
    return '––';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '––';
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export function BlotterPanel() {
  const { data, isLoading } = useOrdersData();
  const { data: markets } = useMarketsData();
  const recentTrades = useClobUserFeedStore((state) => state.recentTrades);
  const recentOrders = useClobUserFeedStore((state) => state.recentOrders);
  const streamingConnected = useClobUserFeedStore((state) => state.connected);
  const orders = data?.orders ?? [];
  const meta = data?.meta;
  const showSample = !orders.length && Boolean(meta?.error);
  const dataToRender = showSample ? SAMPLE_ORDERS : orders;

  const marketLookup = React.useMemo(() => {
    const mapping = new Map<string, string>();
    markets?.forEach((market) => {
      mapping.set(market.conditionId, market.question);
    });
    return mapping;
  }, [markets]);

  const resolveMarketLabel = React.useCallback(
    (marketId: string | null) => {
      if (!marketId) {
        return 'Unknown market';
      }
      return marketLookup.get(marketId) ?? marketId;
    },
    [marketLookup],
  );

  return (
    <PanelCard title="Order Blotter" subtitle="Live">
      {meta?.error ? (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          {meta.error}
        </Alert>
      ) : null}
      {showSample ? (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Showing sample blotter fills until builder credentials are connected.
        </Alert>
      ) : null}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Live fills
        </Typography>
        <Chip
          size="small"
          label={streamingConnected ? 'RTDS connected' : 'Awaiting RTDS'}
          color={streamingConnected ? 'success' : 'default'}
          variant="outlined"
        />
      </Stack>

      {recentTrades.length ? (
        <Stack spacing={1.25} sx={{ mb: 2 }}>
          {recentTrades.map((trade) => (
            <Stack key={trade.id} spacing={0.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">{resolveMarketLabel(trade.marketId)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(trade.timestamp)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {trade.side ?? 'BUY'} {formatSize(trade.size)} @ {formatPrice(trade.priceCents)}
                {trade.transactionHash ? ` • ${trade.transactionHash.slice(0, 6)}` : ''}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
          {streamingConnected ? 'Listening for trade fills…' : 'Authenticating live trade stream…'}
        </Typography>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Resting orders
        </Typography>
        {recentOrders.length ? (
          <Chip
            size="small"
            variant="outlined"
            label={`${recentOrders.length} live`}
            color="info"
          />
        ) : null}
      </Stack>

      {isLoading && !orders.length ? (
        <Skeleton variant="rounded" height={140} />
      ) : dataToRender.length ? (
        <Stack spacing={1.5}>
          {dataToRender.map((order) => (
            <Stack key={order.id} spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">{order.market}</Typography>
                <Chip
                  size="small"
                  label={order.status}
                  color={statusColor[order.status.toUpperCase()] ?? 'default'}
                  variant="outlined"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {order.side} {order.size.toLocaleString()} @ {order.price.toFixed(2)}¢
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Connect builder credentials to stream blotter activity.
        </Typography>
      )}
      <Button size="small" variant="text">
        View full blotter
      </Button>
    </PanelCard>
  );
}
