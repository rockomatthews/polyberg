'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PanelCard } from './PanelCard';
import { usePositionsData } from '@/hooks/useTerminalData';

export function PositionsPanel() {
  const { data, isLoading } = usePositionsData();
  const positions = data?.positions ?? [];
  const meta = data?.meta;

  return (
    <PanelCard title="Positions" subtitle="PnL" minHeight={240}>
      {meta?.error ? (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          {meta.error}
        </Alert>
      ) : null}
      {isLoading && !positions.length ? (
        <Skeleton variant="rounded" height={160} />
      ) : positions.length ? (
        <Stack spacing={1.5}>
          {positions.map((pos) => (
            <Stack key={pos.market} spacing={0.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">{pos.market}</Typography>
                <Typography
                  variant="subtitle2"
                  color={pos.pnl >= 0 ? 'accent.main' : 'error.light'}
                >
                  {pos.delta}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Exposure ${(pos.exposure / 1_000).toFixed(1)}k · PnL ${pos.pnl.toLocaleString()}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (pos.exposure / 350_000) * 100)}
                sx={{ height: 6, borderRadius: 999 }}
              />
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No open positions yet. Execute a trade to see exposure + PnL here.
        </Typography>
      )}
    </PanelCard>
  );
}
