'use client';

import * as React from 'react';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PanelCard } from './PanelCard';
import { useActivityFeed } from '@/hooks/useTerminalData';

export function ActivityPanel() {
  const { data, isLoading } = useActivityFeed();
  const items = data ?? [];

  return (
    <PanelCard title="Activity Feed" subtitle="Live stream">
      {isLoading && !items.length ? (
        <Skeleton variant="rounded" height={160} />
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <Stack key={item.id} spacing={0.25}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Chip size="small" label={item.type} variant="outlined" />
                <Typography variant="caption" color="text.secondary">
                  {item.ts}
                </Typography>
              </Stack>
              <Typography variant="body2">{item.message}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </PanelCard>
  );
}
