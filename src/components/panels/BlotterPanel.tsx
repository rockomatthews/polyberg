'use client';

import * as React from 'react';
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

export function BlotterPanel() {
  const { data, isLoading } = useOrdersData();
  const orders = data ?? [];

  return (
    <PanelCard title="Order Blotter" subtitle="Live">
      {isLoading && !orders.length ? (
        <Skeleton variant="rounded" height={140} />
      ) : orders.length ? (
        <Stack spacing={1.5}>
          {orders.map((order) => (
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
