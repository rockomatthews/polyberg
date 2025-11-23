'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useHealthStatus } from '@/hooks/useTerminalData';

const LABELS: Record<string, string> = {
  database: 'Database',
  redis: 'Redis cache',
  relayer: 'Builder relayer',
  rpc: 'Polygon RPC',
  ai: 'AI gateway',
  pinecone: 'Pinecone index',
};

export function HealthHeroBanner() {
  const { data: health, error } = useHealthStatus();

  const failingEntries = React.useMemo(() => {
    if (!health?.statuses) {
      return [];
    }
    return Object.entries(health.statuses).filter(([, status]) => !status.ok);
  }, [health]);

  if (!health && !error) {
    return null;
  }

  if (!error && failingEntries.length === 0) {
    return null;
  }

  const checkedAt = health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : null;

  return (
    <Stack spacing={1} sx={{ width: '100%' }}>
      {error ? (
        <Alert severity="warning" variant="outlined">
          Unable to load system health. {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      ) : null}
      {!error &&
        failingEntries.map(([key, status]) => (
          <Alert key={key} severity="warning" variant="outlined" icon={false}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" color="warning" label={LABELS[key] ?? key} />
              <Typography variant="body2">
                {status.message ??
                  'Missing credentials or service offline. Check your relayer + RPC settings.'}
              </Typography>
              {status.status ? (
                <Typography variant="caption" color="text.secondary">
                  HTTP {status.status}
                </Typography>
              ) : null}
            </Stack>
          </Alert>
        ))}
      {!error && checkedAt ? (
        <Typography variant="caption" color="text.secondary">
          Health checked at {checkedAt}
        </Typography>
      ) : null}
    </Stack>
  );
}

