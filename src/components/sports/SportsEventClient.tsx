'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { SportsEvent } from '@/lib/polymarket/sportsService';
import { useTerminalStore } from '@/state/useTerminalStore';
import { DepthLadderPanel } from '@/components/panels/DepthLadderPanel';
import { TradeTicketPanel } from '@/components/panels/TradeTicketPanel';

type SportsEventClientProps = {
  event: SportsEvent;
};

type SportsMarketEntry = SportsEvent['markets'][number];

export function SportsEventClient({ event }: SportsEventClientProps) {
  const setSelection = useTerminalStore((state) => state.setSelection);
  const setDepthOverlayOpen = useTerminalStore((state) => state.setDepthOverlayOpen);
  const markets = event.markets;
  const [activeId, setActiveId] = React.useState<string | null>(
    markets[0]?.market.conditionId ?? null,
  );

  const selectMarket = React.useCallback(
    (marketEntry: SportsMarketEntry) => {
      const market = marketEntry.market;
      if (!market.primaryTokenId) {
        return;
      }
      setActiveId(market.conditionId);
      setSelection({
        marketId: market.conditionId,
        tokenId: market.primaryTokenId,
        question: market.question,
        outcomeLabel:
          market.primaryOutcome ??
          market.outcomes?.[0]?.label ??
          'Yes',
        openDepthOverlay: false,
        market,
      });
      setDepthOverlayOpen(false);
    },
    [setDepthOverlayOpen, setSelection],
  );

  React.useEffect(() => {
    if (markets.length) {
      selectMarket(markets[0]);
    }
  }, [markets, selectMarket]);

  const groupedByType = React.useMemo(() => {
    const groups = new Map<string, SportsMarketEntry[]>();
    markets.forEach((entry) => {
      const key = entry.type ? entry.type.toUpperCase() : 'MARKETS';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    });
    return Array.from(groups.entries());
  }, [markets]);

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(135deg, rgba(51,65,85,0.45), rgba(15,23,42,0.65))',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="overline" color="primary.light">
              {event.league ?? 'Sports Market'}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {event.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {event.startTime
                ? new Intl.DateTimeFormat('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  }).format(new Date(event.startTime))
                : 'Start time TBA'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            {event.homeTeam ? <Chip label={event.homeTeam} color="primary" variant="outlined" /> : null}
            {event.awayTeam ? <Chip label={event.awayTeam} color="secondary" variant="outlined" /> : null}
          </Stack>
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
        <Stack flex={1} spacing={2}>
          {groupedByType.map(([group, markets]) => (
            <Paper
              key={group}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.06)',
                backgroundColor: 'rgba(15,23,42,0.6)',
              }}
            >
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {group}
              </Typography>
              <Divider sx={{ mb: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
              <Stack spacing={1.5}>
                {markets.map((entry) => {
                  const isActive = entry.market.conditionId === activeId;
                  return (
                    <Stack
                      key={entry.market.conditionId}
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        border: isActive ? '1px solid rgba(94,234,212,0.6)' : '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: isActive ? 'rgba(16,185,129,0.08)' : 'rgba(148,163,184,0.04)',
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {entry.type ?? 'Market'}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {entry.label}
                        </Typography>
                      </Box>
                      {entry.line != null ? (
                        <Chip label={`Line ${entry.line > 0 ? `+${entry.line}` : entry.line}`} size="small" />
                      ) : null}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          Bid {formatPrice(entry.market.bestBid)} / Ask {formatPrice(entry.market.bestAsk)}
                        </Typography>
                        <Button
                          variant={isActive ? 'contained' : 'outlined'}
                          color="primary"
                          size="small"
                          onClick={() => selectMarket(entry)}
                        >
                          {isActive ? 'Selected' : 'Trade'}
                        </Button>
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          ))}
        </Stack>
        <Stack flexBasis={380} minWidth={320} spacing={2}>
          <TradeTicketPanel />
          <DepthLadderPanel />
        </Stack>
      </Stack>
    </Stack>
  );
}

const formatPrice = (value: number | null) =>
  value != null && !Number.isNaN(value) ? `${value.toFixed(2)}¢` : '––';

