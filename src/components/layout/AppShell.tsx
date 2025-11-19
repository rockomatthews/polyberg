'use client';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';

import { TerminalHeader } from './TerminalHeader';
import { WatchlistPanel } from '../panels/WatchlistPanel';
import { DepthLadderPanel } from '../panels/DepthLadderPanel';
import { TradeTicketPanel } from '../panels/TradeTicketPanel';
import { PositionsPanel } from '../panels/PositionsPanel';
import { BlotterPanel } from '../panels/BlotterPanel';
import { AlertsPanel } from '../panels/AlertsPanel';
import { ActivityPanel } from '../panels/ActivityPanel';
import { StrategyCopilot } from '../panels/StrategyCopilot';

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
          px: { xs: 1.5, md: 2 },
          py: { xs: 1.5, md: 2 },
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(0, 1fr) minmax(0, 1fr)',
            lg: '320px minmax(0, 1.4fr) 360px',
          },
          gridTemplateAreas: {
            xs: `
              "watch"
              "alerts"
              "ladder"
              "ticket"
              "activity"
              "side"
            `,
            md: `
              "watch ladder"
              "alerts ladder"
              "ticket activity"
              "side activity"
            `,
            lg: `
              "watch ladder side"
              "alerts ladder side"
              "ticket ladder side"
              "activity ladder side"
            `,
          },
        }}
      >
        <Box sx={{ gridArea: 'watch' }}>
          <WatchlistPanel />
        </Box>
        <Box sx={{ gridArea: 'alerts' }}>
          <AlertsPanel />
        </Box>
        <Box sx={{ gridArea: 'ladder' }}>
          <DepthLadderPanel />
        </Box>
        <Box sx={{ gridArea: 'ticket' }}>
          <TradeTicketPanel />
        </Box>
        <Box sx={{ gridArea: 'activity', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ActivityPanel />
          <StrategyCopilot />
        </Box>
        <Box
          sx={{
            gridArea: 'side',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <PositionsPanel />
          <BlotterPanel />
        </Box>
      </Box>
      <Divider sx={{ opacity: 0.08 }} />
      <Box
        component="footer"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
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

