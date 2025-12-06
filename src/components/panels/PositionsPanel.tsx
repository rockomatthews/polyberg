'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PanelCard } from './PanelCard';
import { usePositionsData } from '@/hooks/useTerminalData';
import { useClobUserFeedStore } from '@/state/useClobUserFeedStore';

const SAMPLE_POSITIONS = [
  { market: 'Will BTC hit $100k by 2025?', exposure: 275_000, pnl: 42_000, delta: 'Long' as const },
  { market: 'US Presidential Election 2024', exposure: 180_000, pnl: -12_500, delta: 'Short' as const },
  { market: 'Fed cuts rates by March', exposure: 95_000, pnl: 8_750, delta: 'Long' as const },
] as const;

export function PositionsPanel() {
  const { data, isLoading } = usePositionsData();
  const streamingConnected = useClobUserFeedStore((state) => state.connected);
  const positions = data?.positions ?? [];
  const meta = data?.meta;
  const showSample = !positions.length && Boolean(meta?.error);
  const dataToRender = showSample ? SAMPLE_POSITIONS : positions;

  return (
    <PanelCard title="Positions" subtitle="PnL" minHeight={240}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Builder exposure
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={streamingConnected ? 'Live via RTDS' : 'Polling'}
          color={streamingConnected ? 'success' : 'default'}
        />
      </Stack>
      {meta?.error ? (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          {meta.error}
        </Alert>
      ) : null}
      {showSample ? (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Showing sample positions until builder credentials are connected.
        </Alert>
      ) : null}
      {isLoading && !positions.length ? (
        <Skeleton variant="rounded" height={160} />
      ) : dataToRender.length ? (
        <Stack spacing={1.5}>
          {dataToRender.map((pos) => (
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
