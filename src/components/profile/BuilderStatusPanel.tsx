'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';

import { useHealthStatus } from '@/hooks/useTerminalData';
import type { HealthResponse } from '@/lib/api/types';

type BuilderStatus = {
  label: string;
  ok: boolean;
};

type BuilderStatusPanelProps = {
  fallbackStatuses: BuilderStatus[];
};

export function BuilderStatusPanel({ fallbackStatuses }: BuilderStatusPanelProps) {
  const { data: health, error } = useHealthStatus();

  const healthChecks = React.useMemo(() => {
    const ordering: Array<{ key: keyof NonNullable<HealthResponse['statuses']>; label: string }> = [
      { key: 'database', label: 'Database' },
      { key: 'redis', label: 'Redis' },
      { key: 'relayer', label: 'Relayer' },
      { key: 'rpc', label: 'Polygon RPC' },
      { key: 'ai', label: 'AI gateway' },
      { key: 'pinecone', label: 'Pinecone' },
    ];
    return ordering
      .map(({ key, label }) => {
        const status = health?.statuses?.[key];
        if (!status) return null;
        const detail =
          status.latencyMs != null
            ? `${status.latencyMs}ms`
            : status.status
              ? `HTTP ${status.status}`
              : undefined;
        return {
          label,
          ok: status.ok,
          detail,
          message: status.message,
        };
      })
      .filter(Boolean) as Array<{ label: string; ok: boolean; detail?: string; message?: string }>;
  }, [health]);

  const failingHealth = React.useMemo(
    () => healthChecks.filter((check) => !check.ok),
    [healthChecks],
  );

  return (
    <Stack spacing={1.5}>
      <div>
        <Typography variant="subtitle2" gutterBottom>
          Credential checks
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {fallbackStatuses.map((item) => (
            <Chip
              key={item.label}
              label={item.label}
              color={item.ok ? 'success' : 'warning'}
              variant={item.ok ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Stack>
      </div>
      <div>
        <Typography variant="subtitle2" gutterBottom>
          System health
        </Typography>
        {error ? (
          <Alert severity="warning" variant="outlined">
            Unable to load health status. {error instanceof Error ? error.message : 'Unknown error'}
          </Alert>
        ) : (
          <>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {healthChecks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Checking…
                </Typography>
              ) : (
                healthChecks.map((check) => (
                  <Chip
                    key={check.label}
                    label={
                      check.detail ? `${check.label} • ${check.detail}` : check.label
                    }
                    color={check.ok ? 'success' : 'warning'}
                    variant={check.ok ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))
              )}
            </Stack>
            {failingHealth.length ? (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {failingHealth.map((check) => (
                  <Alert key={check.label} severity="warning" variant="outlined">
                    {check.label}: {check.message ?? 'Configure credentials to enable this service.'}
                  </Alert>
                ))}
              </Stack>
            ) : health?.checkedAt ? (
              <Typography variant="caption" color="text.secondary">
                All systems nominal · updated {new Date(health.checkedAt).toLocaleTimeString()}
              </Typography>
            ) : null}
          </>
        )}
      </div>
    </Stack>
  );
}

