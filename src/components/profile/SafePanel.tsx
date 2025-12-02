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
import Link from '@mui/material/Link';

import type { UserSafeRecord } from '@/lib/services/userService';

type SafePanelProps = {
  initialUserSafe?: UserSafeRecord | null;
  sharedSafeAddress?: string | null;
  canDeploy: boolean;
  collateralAddress: string;
};

export function SafePanel({
  initialUserSafe,
  sharedSafeAddress,
  canDeploy,
  collateralAddress,
}: SafePanelProps) {
  const [userSafe, setUserSafe] = React.useState<UserSafeRecord | null>(initialUserSafe ?? null);
  const userSafeAddress = userSafe?.safe_address ?? null;
  const activeSafeAddress = userSafeAddress ?? sharedSafeAddress ?? null;
  const deploymentStatus = userSafe?.status ?? (userSafeAddress ? 'ready' : 'not-deployed');
  const deploymentTxHash = userSafe?.deployment_tx_hash ?? null;
  const [balance, setBalance] = React.useState<number | null>(null);
  const [deploying, setDeploying] = React.useState(false);
  const [loadingBalance, setLoadingBalance] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const fetchBalance = React.useCallback(async () => {
    if (!activeSafeAddress) {
      return;
    }
    try {
      setLoadingBalance(true);
      const response = await fetch(`/api/profile/safe-balance?safe=${activeSafeAddress}`);
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
  }, [activeSafeAddress]);

  React.useEffect(() => {
    if (!activeSafeAddress) {
      return;
    }
    void fetchBalance();
    const interval = setInterval(() => {
      void fetchBalance();
    }, 10_000);
    return () => clearInterval(interval);
  }, [activeSafeAddress, fetchBalance]);

  const handleDeploy = async () => {
    if (!canDeploy || deploying || Boolean(userSafeAddress)) {
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
      setUserSafe((prev) => ({
        user_id: prev?.user_id ?? 'self',
        safe_address: json.safeAddress,
        deployment_tx_hash: json.transactionHash ?? null,
        status: json.status ?? 'deployed',
        ownership_type: 'per-user',
        notes: null,
        metadata: null,
        owner_private_key: prev?.owner_private_key ?? null,
        created_at: prev?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      setBalance(0);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy Safe');
    } finally {
      setDeploying(false);
    }
  };

  const copySafe = () => {
    if (!activeSafeAddress) return;
    void navigator.clipboard.writeText(activeSafeAddress);
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
              disabled={!canDeploy || deploying || Boolean(userSafeAddress)}
            >
              {deploying ? 'Deploying…' : userSafeAddress ? 'Safe Ready' : 'Deploy Safe'}
            </Button>
            {!canDeploy && (
              <Chip label="Relayer not configured" color="warning" size="small" variant="outlined" />
            )}
            {deploymentStatus !== 'not-deployed' ? (
              <Chip
                label={deploymentStatus === 'deployed' ? 'Deployed' : deploymentStatus}
                color={deploymentStatus === 'deployed' ? 'success' : 'warning'}
                size="small"
                variant="outlined"
              />
            ) : null}
            {sharedSafeAddress && !userSafeAddress ? (
              <Chip
                label="Using shared Safe"
                color="info"
                size="small"
                variant="outlined"
                sx={{ borderStyle: 'dashed' }}
              />
            ) : null}
          </Stack>

          {activeSafeAddress ? (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Safe address
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography component="span" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                  {activeSafeAddress}
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
              {deploymentTxHash ? (
                <Typography variant="body2" color="text.secondary">
                  Deployment tx:{' '}
                  <Link
                    href={`https://polygonscan.com/tx/${deploymentTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {deploymentTxHash.slice(0, 10)}…
                  </Link>
                </Typography>
              ) : null}
              <Typography variant="body2" color="text.secondary">
                Fund this Safe by transferring USDC on Polygon (collateral contract:{' '}
                <Typography component="span" fontFamily="monospace">
                  {collateralAddress}
                </Typography>
                ). Withdraw from Polymarket or bridge funds, then paste this Safe address as the
                destination.
              </Typography>
              <Alert severity="info" variant="outlined">
                After funding, refresh the balance above. Need gasless snipes? Keep at least $25 USDC
                available before queuing orders.
              </Alert>
              {sharedSafeAddress && !userSafeAddress ? (
                <Alert severity="info" variant="outlined">
                  You are currently using the shared operator Safe (
                  {sharedSafeAddress.slice(0, 8)}…{sharedSafeAddress.slice(-6)}). Deploy your own to
                  segregate balances.
                </Alert>
              ) : null}
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

