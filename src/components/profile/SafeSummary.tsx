'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { useSafeStatus } from '@/hooks/useSafeStatus';

type SafeSummaryProps = {
  collateralAddress: string;
};

export function SafeSummary({ collateralAddress }: SafeSummaryProps) {
  const { safeStatus, safeLoading, requestSafe, confirmFee } = useSafeStatus();
  const safeAddress = safeStatus?.safeAddress ?? null;
  const [balance, setBalance] = React.useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = React.useState(false);
  const [balanceError, setBalanceError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [txHashInput, setTxHashInput] = React.useState('');
  const [feeError, setFeeError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const loadBalance = async () => {
      if (!safeAddress) return;
      try {
        setLoadingBalance(true);
        const response = await fetch(`/api/profile/safe-balance?safe=${safeAddress}`);
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || 'Unable to fetch Safe balance');
        }
        if (active) {
          setBalance(typeof json.balance === 'number' ? json.balance : null);
          setLastUpdated(new Date());
          setBalanceError(null);
        }
      } catch (error) {
        if (active) {
          setBalanceError(error instanceof Error ? error.message : 'Safe balance unavailable');
        }
      } finally {
        if (active) {
          setLoadingBalance(false);
        }
      }
    };

    if (safeStatus?.state === 'ready') {
      void loadBalance();
    }

    return () => {
      active = false;
    };
  }, [safeAddress, safeStatus?.state]);

  const copySafe = React.useCallback(() => {
    if (safeAddress) {
      void navigator.clipboard.writeText(safeAddress);
    }
  }, [safeAddress]);

  const handleConfirmFee = React.useCallback(() => {
    setFeeError(null);
    confirmFee.mutate(txHashInput.trim() || undefined, {
      onSuccess: () => {
        setTxHashInput('');
      },
      onError: (error) => {
        setFeeError(error instanceof Error ? error.message : 'Unable to confirm payment');
      },
    });
  }, [confirmFee, txHashInput]);

  if (safeLoading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" mt={2}>
        <CircularProgress size={14} />
        <Typography variant="body2" color="text.secondary">
          Checking Safe status…
        </Typography>
      </Stack>
    );
  }

  if (!safeStatus || safeStatus.state === 'disabled') {
    return (
      <Stack spacing={1.5} mt={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Safe</Typography>
          <Chip label="Relayer offline" color="warning" size="small" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Configure the Polymarket relayer to unlock gasless sniping. Once online, you can deploy per
          user Safes directly from here.
        </Typography>
      </Stack>
    );
  }

  if (safeStatus.state === 'fee-required') {
    return (
      <Stack spacing={1.5} mt={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Safe</Typography>
          <Chip label="Fee required" color="warning" size="small" variant="outlined" />
        </Stack>
        <Alert severity="info" variant="outlined">
          Send ${safeStatus.feeUsd.toFixed(2)} USDC on Polygon to{' '}
          <Typography component="span" fontFamily="monospace">
            {safeStatus.treasuryAddress ?? 'your treasury Safe'}
          </Typography>
          . After paying, paste the transaction hash below to unlock Safe deployment.
        </Alert>
        <TextField
          label="Payment Tx Hash (optional)"
          size="small"
          value={txHashInput}
          onChange={(event) => setTxHashInput(event.target.value)}
          placeholder="0x..."
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleConfirmFee}
          disabled={confirmFee.isPending}
        >
          {confirmFee.isPending ? 'Confirming…' : `I paid $${safeStatus.feeUsd.toFixed(2)}`}
        </Button>
        {feeError ? (
          <Alert severity="error" variant="outlined">
            {feeError}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  if (safeStatus.state === 'missing') {
    return (
      <Stack spacing={1.5} mt={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Safe</Typography>
          <Chip label="Not connected" color="warning" size="small" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {safeStatus.setupFeePaid
            ? 'Fee received. Deploy your dedicated Safe to start gasless sniping.'
            : 'Deploy a dedicated Safe wallet to route all trades gaslessly.'}
        </Typography>
        {safeStatus.feeTxHash ? (
          <Typography variant="caption" color="text.secondary">
            Last payment tx: {safeStatus.feeTxHash.slice(0, 10)}…{safeStatus.feeTxHash.slice(-6)}
          </Typography>
        ) : null}
        {safeStatus.setupFeePaid ? (
          <Button
            variant="contained"
            size="small"
            onClick={() => requestSafe.mutate()}
            disabled={requestSafe.isPending}
          >
            {requestSafe.isPending ? 'Requesting…' : 'Deploy my Safe'}
          </Button>
        ) : null}
        {requestSafe.isError ? (
          <Alert severity="error" variant="outlined">
            {requestSafe.error instanceof Error ? requestSafe.error.message : 'Safe request failed'}
          </Alert>
        ) : null}
      </Stack>
    );
  }

  if (safeStatus.state === 'pending') {
    return (
      <Stack spacing={1.5} mt={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Safe</Typography>
          <Chip label="Deploying" color="info" size="small" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Safe deployment in progress ({safeStatus.statusLabel}). The relayer handles gas and should
          finish within ~30 seconds.
        </Typography>
      </Stack>
    );
  }

  if (safeStatus.state === 'error') {
    return (
      <Stack spacing={1.5} mt={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Safe</Typography>
          <Chip label="Error" color="error" size="small" variant="outlined" />
        </Stack>
        <Alert severity="error" variant="outlined">
          {safeStatus.statusLabel || 'Safe deployment failed. Retry the request or contact support.'}
        </Alert>
        <Button variant="outlined" size="small" onClick={() => requestSafe.mutate()}>
          Retry deployment
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} mt={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle2">Safe</Typography>
        <Chip label="Ready" color="success" size="small" variant="outlined" />
      </Stack>
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
      {balanceError ? (
        <Typography variant="caption" color="error.main">
          {balanceError}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        Fund this Safe via Polygon USDC ({collateralAddress}) and the relayer will execute snipes
        gaslessly on your behalf.
      </Typography>
      {safeStatus.feeTxHash ? (
        <Typography variant="caption" color="text.secondary">
          Setup fee tx: {safeStatus.feeTxHash.slice(0, 10)}…{safeStatus.feeTxHash.slice(-6)}
        </Typography>
      ) : null}
    </Stack>
  );
}


