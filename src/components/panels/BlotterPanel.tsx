'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PanelCard } from './PanelCard';
import { useOrdersData } from '@/hooks/useTerminalData';

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

export function BlotterPanel() {
  const { data, isLoading } = useOrdersData();
  const orders = data?.orders ?? [];
  const meta = data?.meta;
  const showSample = !orders.length && Boolean(meta?.error);
  const dataToRender = showSample ? SAMPLE_ORDERS : orders;

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
