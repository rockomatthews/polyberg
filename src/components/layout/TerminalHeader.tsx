'use client';

import * as React from 'react';
import Image from 'next/image';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import useMediaQuery from '@mui/material/useMediaQuery';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { useHealthStatus, useSystemStatus } from '@/hooks/useTerminalData';
import { searchMarkets } from '@/lib/api/polymarket';
import type { Market } from '@/lib/api/types';
import { useTerminalStore } from '@/state/useTerminalStore';

type MarketSearchInputProps = {
  fullWidth?: boolean;
};

function MarketSearchInput({ fullWidth }: MarketSearchInputProps) {
  const [value, setValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [debounced, setDebounced] = React.useState('');
  const setSelection = useTerminalStore((state) => state.setSelection);
  const autoSelectedRef = React.useRef<{ query: string; marketId: string } | null>(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(value.trim());
    }, 200);
    return () => clearTimeout(id);
  }, [value]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['market-search', debounced],
    queryFn: () => searchMarkets(debounced),
    enabled: debounced.length >= 2,
  });

  const handleSelect = (market: Market) => {
    if (!market.primaryTokenId) return;
    setSelection({
      marketId: market.conditionId,
      tokenId: market.primaryTokenId,
      question: market.question,
    });
    setValue('');
    setFocused(false);
  };

  const showDropdown =
    focused && (debounced.length >= 2 || value.length >= 2) && (isFetching || results.length > 0);

  React.useEffect(() => {
    if (debounced.length < 2 || results.length === 0) {
      return;
    }
    const first = results[0];
    if (!first?.primaryTokenId) {
      return;
    }
    const lastSelection = autoSelectedRef.current;
    if (
      lastSelection &&
      lastSelection.query === debounced &&
      lastSelection.marketId === first.conditionId
    ) {
      return;
    }
    setSelection({
      marketId: first.conditionId,
      tokenId: first.primaryTokenId,
      question: first.question,
    });
    autoSelectedRef.current = { query: debounced, marketId: first.conditionId };
  }, [debounced, results, setSelection]);

  return (
    <Stack
      sx={{
        position: 'relative',
        width: fullWidth ? '100%' : undefined,
        flex: fullWidth ? '1 1 100%' : '0 0 360px',
        maxWidth: fullWidth ? '100%' : 360,
      }}
    >
      <TextField
        placeholder="Search markets, tickers, outcomes"
        variant="outlined"
        size="small"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results.length > 0) {
            event.preventDefault();
            handleSelect(results[0]);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setTimeout(() => setFocused(false), 120);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      {showDropdown ? (
        <Paper
          elevation={6}
          sx={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 10,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {isFetching && !results.length ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5 }}>
              <CircularProgress size={16} />
              <ListItemText primary="Searching markets…" />
            </Stack>
          ) : results.length ? (
            <List disablePadding>
              {results.map((market) => (
                <ListItemButton key={market.conditionId} onMouseDown={() => handleSelect(market)}>
                  <ListItemText
                    primary={market.question}
                    secondary={
                      market.tag
                        ? `${market.tag} • Bid ${formatPrice(market.bestBid)} / Ask ${formatPrice(market.bestAsk)}`
                        : `Bid ${formatPrice(market.bestBid)} / Ask ${formatPrice(market.bestAsk)}`
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <ListItemText sx={{ p: 1.5 }} primary="No markets found. Try another query." />
          )}
        </Paper>
      ) : null}
    </Stack>
  );
}

const formatPrice = (value: number | null) =>
  value != null && !Number.isNaN(value) ? `${value.toFixed(2)}¢` : '––';

export function TerminalHeader() {
  const isMobile = useMediaQuery('(max-width:900px)');
  const { data: session } = useSession();
  const { data: status } = useSystemStatus();
  const { data: health } = useHealthStatus();
  const router = useRouter();
  const initials =
    session?.user?.name?.trim().length
      ? session.user.name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join('') || 'OP'
      : 'OP';
  const latencyChip =
    status?.latencyMs != null ? `Latency ${status.latencyMs}ms` : 'Latency --';
  const walletBalanceLabel =
    status?.walletBalance != null ? `$${(status.walletBalance / 1_000_000).toFixed(2)}M` : 'Balance --';
  const walletChip = status ? `${status.walletLabel} · ${walletBalanceLabel}` : 'Wallet loading';
  const relayerStatus = health?.statuses?.relayer;
  const aiStatus = health?.statuses?.ai;
  const relayerChipLabel = relayerStatus
    ? `Relayer · ${relayerStatus.ok ? 'Online' : 'Check config'}`
    : 'Relayer · pending';
  const aiChipLabel = aiStatus ? `AI · ${aiStatus.ok ? 'Ready' : 'Missing key'}` : 'AI · pending';

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
        {isMobile ? null : <MarketSearchInput />}
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
          {isMobile ? <MarketSearchInput fullWidth /> : null}
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
          <Chip
            label={relayerChipLabel}
            size={isMobile ? 'small' : 'medium'}
            variant="outlined"
            color={relayerStatus?.ok ? 'success' : 'warning'}
          />
          <Chip
            label={aiChipLabel}
            size={isMobile ? 'small' : 'medium'}
            variant="outlined"
            color={aiStatus?.ok ? 'success' : 'warning'}
          />
          <Tooltip title={session?.user ? 'Open profile' : 'Sign in to manage profile'}>
            <Avatar
              alt="Operator"
              sx={{
                width: isMobile ? 30 : 32,
                height: isMobile ? 30 : 32,
                bgcolor: 'primary.main',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (session?.user) {
                  router.push('/profile');
                } else {
                  router.push('/');
                }
              }}
            >
              {initials}
            </Avatar>
          </Tooltip>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

