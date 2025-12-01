'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip, { type ChipProps } from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchStrategyOverview, runStrategiesNow } from '@/lib/api/autonomy';
import type { StrategyDefinition, StrategyRunResult, StrategyRunSummary } from '@/lib/autonomy/types';
import { useSafeStatus } from '@/hooks/useSafeStatus';

export function StrategyAdminPanel() {
  const [highlight, setHighlight] = React.useState<StrategyRunSummary | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['autonomy', 'strategies'],
    queryFn: fetchStrategyOverview,
  });

  const runMutation = useMutation({
    mutationFn: runStrategiesNow,
    onSuccess: (summary) => {
      setHighlight(summary);
      overviewQuery.refetch();
    },
  });

  React.useEffect(() => {
    if (!highlight || !overviewQuery.data?.runs?.length) {
      return;
    }
    const exists = overviewQuery.data.runs.some((run) => run.runAt === highlight.runAt);
    if (exists) {
      setHighlight(null);
    }
  }, [highlight, overviewQuery.data?.runs]);

  const runs = React.useMemo(() => {
    if (highlight) {
      return [highlight, ...(overviewQuery.data?.runs ?? [])];
    }
    return overviewQuery.data?.runs ?? [];
  }, [highlight, overviewQuery.data?.runs]);

  const strategies = overviewQuery.data?.strategies ?? [];
  const tradingEnabled = overviewQuery.data?.tradingEnabled ?? false;
  const cronConfigured = overviewQuery.data?.cronConfigured ?? false;
  const autonomyDisabled = overviewQuery.data?.autonomyDisabled ?? false;
  const { safeStatus } = useSafeStatus();
  const safeRequired = safeStatus?.requireSafe ?? false;
  const safeReady = safeStatus?.state === 'ready';

  const isLoading = overviewQuery.isLoading;
  const runDisabled = runMutation.isPending || isLoading || autonomyDisabled;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Box>
              <Typography variant="h6">Autonomy Strategy Engine</Typography>
              <Typography variant="body2" color="text.secondary">
                View health, run history, and fire the always-on snipers on demand.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => runMutation.mutate()}
              disabled={runDisabled}
            >
              {runMutation.isPending ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <span>Running…</span>
                </Stack>
              ) : (
                'Run now'
              )}
            </Button>
          </Stack>

          {autonomyDisabled ? (
            <Alert severity="error" variant="outlined">
              Autonomy kill switch engaged (AUTONOMY_DISABLED=true). Clear the flag to resume runs.
            </Alert>
          ) : null}

          {!tradingEnabled ? (
            <Alert severity="warning" variant="outlined">
              Autonomy orders are currently in simulation mode (set AUTONOMY_TRADING_ENABLED=true to
              fire live orders).
            </Alert>
          ) : (
            <Chip label="Order execution armed" color="success" size="small" />
          )}

          {safeRequired && !safeReady ? (
            <Alert severity="warning" variant="outlined">
              Operator Safe not ready. Strategies will skip until the gasless Safe is deployed and
              funded.
            </Alert>
          ) : null}

          {!cronConfigured ? (
            <Alert severity="info" variant="outlined">
              Cron trigger isn’t configured yet. Manual runs will work, but schedule automation
              requires CRON_SECRET + Vercel cron.
            </Alert>
          ) : null}

          {overviewQuery.error ? (
            <Alert severity="error" variant="outlined">
              {overviewQuery.error instanceof Error
                ? overviewQuery.error.message
                : 'Failed to load strategy overview.'}
            </Alert>
          ) : null}

          {highlight ? (
            <Alert severity="success" variant="outlined">
              Manual run queued · {formatRunSummary(highlight)}
            </Alert>
          ) : null}

          {runMutation.error ? (
            <Alert severity="error" variant="outlined">
              {runMutation.error instanceof Error
                ? runMutation.error.message
                : 'Manual run failed'}
            </Alert>
          ) : null}

          {isLoading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {strategies.map((strategy) => (
                <StrategyRow
                  key={strategy.id}
                  strategy={strategy}
                  latestResult={findLatestResult(strategy.id, runs)}
                />
              ))}
            </Stack>
          )}

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Recent runs</Typography>
            {runs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No strategy runs have been recorded yet.
              </Typography>
            ) : (
              runs.slice(0, 6).map((run) => (
                <Box
                  key={run.runAt}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(run.runAt)}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.75 }}>
                    {run.results.map((result) => (
                      <Chip
                        key={`${run.runAt}-${result.strategyId}`}
                        size="small"
                        variant="outlined"
                        label={`${result.strategyId}: ${result.status}`}
                        color={chipColor(result.status)}
                      />
                    ))}
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function StrategyRow({
  strategy,
  latestResult,
}: {
  strategy: StrategyDefinition;
  latestResult?: StrategyRunResult;
}) {
  const statusLabel = latestResult
    ? `${capitalize(latestResult.status)}${latestResult.tradesEnqueued ? ` · ${latestResult.tradesEnqueued} orders` : ''}`
    : 'No runs yet';

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.02)',
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="subtitle1">{strategy.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {formatStrategyDescriptor(strategy)} · {strategy.schedule} UTC · Max $
            {strategy.maxNotional} · Daily cap ${strategy.dailyCap}
          </Typography>
        </Box>
        <Chip
          label={statusLabel}
          color={chipColor(latestResult?.status)}
          size="small"
          variant={latestResult ? 'filled' : 'outlined'}
        />
      </Stack>
      {latestResult?.reason ? (
        <Typography variant="caption" color="text.secondary">
          {latestResult.reason}
        </Typography>
      ) : null}
    </Box>
  );
}

function findLatestResult(strategyId: string, runs: StrategyRunSummary[]) {
  for (const run of runs) {
    const result = run.results.find((entry) => entry.strategyId === strategyId);
    if (result) {
      return result;
    }
  }
  return undefined;
}

function chipColor(status: StrategyRunResult['status'] | undefined): ChipProps['color'] {
  if (status === 'queued') return 'success';
  if (status === 'error') return 'error';
  if (status === 'skipped') return 'warning';
  return 'default';
}

function formatStrategyDescriptor(strategy: StrategyDefinition) {
  const mode = strategy.mode === 'exit' ? 'Exit' : 'Entry';
  return `${mode.toUpperCase()} · ${strategy.source.replace(/-/g, ' ').toUpperCase()}`;
}

function formatRunSummary(run: StrategyRunSummary) {
  const parts = run.results.map((result) => `${result.strategyId} → ${result.status}`);
  return `${parts.join(', ')} (${formatTimestamp(run.runAt)})`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function capitalize(value?: string) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}


