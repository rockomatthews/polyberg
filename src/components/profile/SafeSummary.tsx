'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

type SafeSummaryProps = {
  safeAddress?: string | null;
  collateralAddress: string;
  canDeploy: boolean;
};

export function SafeSummary({ safeAddress, collateralAddress, canDeploy }: SafeSummaryProps) {
  const [balance, setBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let abort = false;
    const loadBalance = async () => {
      if (!safeAddress) {
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/profile/safe-balance?safe=${safeAddress}`);
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || 'Unable to fetch Safe balance');
        }
        if (!abort) {
          setBalance(typeof json.balance === 'number' ? json.balance : null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (!abort) {
          setError(err instanceof Error ? err.message : 'Safe balance unavailable');
        }
      } finally {
        if (!abort) {
          setLoading(false);
        }
      }
    };

    void loadBalance();

    return () => {
      abort = true;
    };
  }, [safeAddress]);

  const copySafe = React.useCallback(() => {
    if (safeAddress) {
      void navigator.clipboard.writeText(safeAddress);
    }
  }, [safeAddress]);

  if (!safeAddress) {
    return (
      <Stack spacing={1.5} mt={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Safe</Typography>
          <Chip label="Not connected" color="warning" size="small" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          No Safe is connected to this profile yet. Head to the Builder Onboarding Wizard to deploy a
          Safe (fund it with Polygon USDC at {collateralAddress}) so trades can settle safely.
        </Typography>
        <Button
          component="a"
          href="#builder-credentials"
          variant="outlined"
          size="small"
          disabled={!canDeploy}
        >
          {canDeploy ? 'Connect Safe' : 'Relayer required'}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} mt={2}>
      <Typography variant="subtitle2">Safe</Typography>
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
        {loading ? (
          <CircularProgress size={14} />
        ) : (
          <Typography fontWeight={600}>
            {balance != null ? `$${balance.toFixed(2)} USDC` : '--'}
          </Typography>
        )}
        {lastUpdated ? (
          <Typography variant="caption" color="text.secondary">
            Updated {lastUpdated.toLocaleTimeString()}
          </Typography>
        ) : null}
      </Stack>
      {error ? (
        <Typography variant="caption" color="error.main">
          {error}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        Fund this Safe via Polygon USDC ({collateralAddress}) and it will auto-feed the relayer for
        gasless snipes.
      </Typography>
    </Stack>
  );
}


