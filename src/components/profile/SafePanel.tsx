'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BoltIcon from '@mui/icons-material/Bolt';

type SafePanelProps = {
  initialSafeAddress?: string | null;
  canDeploy: boolean;
  collateralAddress: string;
};

export function SafePanel({
  initialSafeAddress,
  canDeploy,
  collateralAddress,
}: SafePanelProps) {
  const [safeAddress, setSafeAddress] = React.useState(initialSafeAddress ?? null);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [deploying, setDeploying] = React.useState(false);
  const [loadingBalance, setLoadingBalance] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const fetchBalance = React.useCallback(async () => {
    if (!safeAddress) {
      return;
    }
    try {
      setLoadingBalance(true);
      const response = await fetch(`/api/profile/safe-balance?safe=${safeAddress}`);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Unable to fetch Safe balance');
      }
      setBalance(json.balance ?? 0);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Safe balance');
    } finally {
      setLoadingBalance(false);
    }
  }, [safeAddress]);

  React.useEffect(() => {
    if (!safeAddress) {
      return;
    }
    void fetchBalance();
    const interval = setInterval(() => {
      void fetchBalance();
    }, 10_000);
    return () => clearInterval(interval);
  }, [safeAddress, fetchBalance]);

  const handleDeploy = async () => {
    if (!canDeploy || deploying) {
      return;
    }
    try {
      setDeploying(true);
      setError(null);
      const response = await fetch('/api/profile/deploy-safe', { method: 'POST' });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Safe deployment failed');
      }
      setSafeAddress(json.safeAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy Safe');
    } finally {
      setDeploying(false);
    }
  };

  const copySafe = () => {
    if (!safeAddress) return;
    void navigator.clipboard.writeText(safeAddress);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">Safe & Treasury</Typography>
          <Typography variant="body2" color="text.secondary">
            Each trader can deploy a dedicated builder Safe. Fund it with USDC on Polygon to enable
            gasless snipes.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              startIcon={<BoltIcon />}
              onClick={handleDeploy}
              disabled={!canDeploy || deploying || Boolean(safeAddress)}
            >
              {deploying ? 'Deploying…' : safeAddress ? 'Safe Ready' : 'Deploy Safe'}
            </Button>
            {!canDeploy && (
              <Chip label="Relayer not configured" color="warning" size="small" variant="outlined" />
            )}
          </Stack>

          {safeAddress ? (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Safe address
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography component="span" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                  {safeAddress}
                </Typography>
                <Tooltip title="Copy Safe address">
                  <IconButton size="small" onClick={copySafe}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Balance
                </Typography>
                {loadingBalance ? (
                  <CircularProgress size={16} />
                ) : (
                  <Typography fontWeight="bold">
                    {balance != null ? `$${balance.toFixed(2)} USDC` : '--'}
                  </Typography>
                )}
                {lastUpdated ? (
                  <Typography variant="caption" color="text.secondary">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </Typography>
                ) : null}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Fund this Safe by transferring USDC on Polygon (collateral contract:{' '}
                <Typography component="span" fontFamily="monospace">
                  {collateralAddress}
                </Typography>
                ). Withdraw from Polymarket or bridge funds, then paste this Safe address as the
                destination.
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No Safe deployed yet. Use the button above once your builder credentials are approved.
            </Typography>
          )}

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

