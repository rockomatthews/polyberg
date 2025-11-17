'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';

import { TerminalHeader } from './TerminalHeader';
import { WatchlistPanel } from '../panels/WatchlistPanel';
import { DepthLadderPanel } from '../panels/DepthLadderPanel';
import { TradeTicketPanel } from '../panels/TradeTicketPanel';
import { PositionsPanel } from '../panels/PositionsPanel';
import { BlotterPanel } from '../panels/BlotterPanel';
import { AlertsPanel } from '../panels/AlertsPanel';
import { ActivityPanel } from '../panels/ActivityPanel';

export function AppShell() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TerminalHeader />
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'grid',
          gap: 2,
          padding: 2,
          gridTemplateColumns: {
            lg: '320px minmax(0, 1.6fr) 360px',
            xs: '1fr',
          },
          gridAutoRows: 'min-content',
        }}
      >
        <Stack spacing={2}>
          <WatchlistPanel />
          <AlertsPanel />
        </Stack>
        <Stack spacing={2}>
          <DepthLadderPanel />
          <TradeTicketPanel />
          <ActivityPanel />
        </Stack>
        <Stack spacing={2}>
          <PositionsPanel />
          <BlotterPanel />
        </Stack>
      </Box>
      <Divider sx={{ opacity: 0.08 }} />
      <Box
        component="footer"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          color: 'text.secondary',
          fontSize: '0.8rem',
        }}
      >
        <span>Strategy engine idle · awaiting signal</span>
        <span>Connected to Polymarket Builder Relayer</span>
      </Box>
    </Box>
  );
}

