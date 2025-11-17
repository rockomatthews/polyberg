'use client';

import * as React from 'react';
import Image from 'next/image';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';

import { useSystemStatus } from '@/hooks/useTerminalData';

export function TerminalHeader() {
  const { data: status } = useSystemStatus();
  const latencyChip =
    status?.latencyMs != null ? `Latency ${status.latencyMs}ms` : 'Latency --';
  const walletBalanceLabel =
    status?.walletBalance != null ? `$${(status.walletBalance / 1_000_000).toFixed(2)}M` : 'Balance --';
  const walletChip = status ? `${status.walletLabel} · ${walletBalanceLabel}` : 'Wallet loading';

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar
        sx={{
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Image src="/logo-terminal.svg" alt="Polymarket Terminal" width={164} height={28} priority />
        <TextField
          placeholder="Search markets, tickers, outcomes"
          variant="outlined"
          size="small"
          sx={{ maxWidth: 360, flexShrink: 0 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Stack direction="row" spacing={1} sx={{ flex: 1 }} justifyContent="flex-end">
          <Chip
            label={latencyChip}
            color={status && status.latencyMs != null && status.latencyMs < 80 ? 'success' : 'warning'}
            variant="outlined"
          />
          <Chip
            label={walletChip}
            variant="outlined"
            color={status?.relayerConnected ? 'primary' : 'warning'}
          />
          <Tooltip title="Operator menu">
            <Avatar
              alt="Operator"
              sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem' }}
            >
              OP
            </Avatar>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

