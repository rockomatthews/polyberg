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
import useMediaQuery from '@mui/material/useMediaQuery';

import { signOut, useSession } from 'next-auth/react';

import { useSystemStatus } from '@/hooks/useTerminalData';

export function TerminalHeader() {
  const isMobile = useMediaQuery('(max-width:900px)');
  const { data: session } = useSession();
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
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? 1.5 : 2,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          px: { xs: 1.25, md: 2 },
        }}
      >
        <Image src="/logo-terminal.png" alt="Polymarket Terminal" width={164} height={28} priority />
        {isMobile ? null : (
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
        )}
        <Stack
          direction={isMobile ? 'column' : 'row'}
          spacing={1}
          sx={{
            flex: isMobile ? '1 1 100%' : 1,
            width: isMobile ? '100%' : 'auto',
          }}
          justifyContent={isMobile ? 'flex-start' : 'flex-end'}
          alignItems={isMobile ? 'stretch' : 'center'}
        >
          {isMobile ? (
            <TextField
              placeholder="Search markets, tickers, outcomes"
              variant="outlined"
              size="small"
              sx={{ width: '100%' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          ) : null}
          <Chip
            label={latencyChip}
            size={isMobile ? 'small' : 'medium'}
            color={status && status.latencyMs != null && status.latencyMs < 80 ? 'success' : 'warning'}
            variant="outlined"
          />
          <Chip
            label={walletChip}
            size={isMobile ? 'small' : 'medium'}
            variant="outlined"
            color={status?.relayerConnected ? 'primary' : 'warning'}
          />
          <Tooltip title="Operator menu">
            <Avatar
              alt="Operator"
              sx={{
                width: isMobile ? 30 : 32,
                height: isMobile ? 30 : 32,
                bgcolor: 'primary.main',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
              onClick={() => signOut()}
            >
              {session?.user?.name?.slice(0, 2).toUpperCase() ?? 'OP'}
            </Avatar>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

