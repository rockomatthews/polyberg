'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

import { PanelCard } from './PanelCard';
import { useAlertsData } from '@/hooks/useTerminalData';

export function AlertsPanel() {
  const { data, isLoading } = useAlertsData();
  const alerts = data ?? [];

  return (
    <PanelCard
      title="Alerts & Signals"
      subtitle="Rules"
      actions={
        <IconButton size="small" color="primary">
          <NotificationsActiveIcon fontSize="small" />
        </IconButton>
      }
    >
      {isLoading && !alerts.length ? (
        <Skeleton variant="rounded" height={120} />
      ) : alerts.length ? (
        <Stack spacing={1.25}>
          {alerts.map((alert) => (
            <Stack key={alert.id} spacing={0.25}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">{alert.label}</Typography>
                <Chip
                  size="small"
                  label={alert.status}
                  color={alert.status === 'Triggered' ? 'warning' : 'default'}
                  variant="outlined"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Scope: {alert.market}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Alert rules will sync once the ingestion worker is online.
        </Typography>
      )}
      <Button variant="outlined" size="small">
        Create alert
      </Button>
    </PanelCard>
  );
}
