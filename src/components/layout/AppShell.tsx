'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';

import { TerminalHeader } from './TerminalHeader';
import { HealthHeroBanner } from './HealthHeroBanner';
import { WatchlistPanel } from '../panels/WatchlistPanel';
import { DepthLadderPanel } from '../panels/DepthLadderPanel';
import { PositionsPanel } from '../panels/PositionsPanel';
import { BlotterPanel } from '../panels/BlotterPanel';
import { AlertsPanel } from '../panels/AlertsPanel';
import { ActivityPanel } from '../panels/ActivityPanel';
import { TradeTicketPanel } from '../panels/TradeTicketPanel';
import { useTerminalStore } from '@/state/useTerminalStore';

export function AppShell() {
  const [positionsOpen, setPositionsOpen] = React.useState(false);
  const [blotterOpen, setBlotterOpen] = React.useState(false);
  const depthOverlayOpen = useTerminalStore((state) => state.depthOverlayOpen);
  const setDepthOverlayOpen = useTerminalStore((state) => state.setDepthOverlayOpen);
  const selectedMarketId = useTerminalStore((state) => state.selectedMarketId);

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
      <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 1 }}>
        <HealthHeroBanner />
      </Box>
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
            lg: 'minmax(0, 1.8fr) minmax(0, 1fr)',
          },
          gridTemplateAreas: {
            xs: `
              "watch"
              "alerts"
              "activity"
            `,
            md: `
              "watch watch"
              "alerts activity"
            `,
            lg: `
              "watch watch"
              "alerts activity"
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
        <Box sx={{ gridArea: 'activity' }}>
          <ActivityPanel />
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

      <Dialog
        open={positionsOpen}
        onClose={() => setPositionsOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Positions
          <IconButton onClick={() => setPositionsOpen(false)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <PositionsPanel />
        </DialogContent>
      </Dialog>

      <Dialog
        open={blotterOpen}
        onClose={() => setBlotterOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Live Blotter
          <IconButton onClick={() => setBlotterOpen(false)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <BlotterPanel />
        </DialogContent>
      </Dialog>

      <Dialog
        open={depthOverlayOpen && Boolean(selectedMarketId)}
        onClose={() => setDepthOverlayOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(5, 8, 16, 0.92)',
          },
        }}
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'text.primary' }}
        >
          Sniper Console
          <IconButton onClick={() => setDepthOverlayOpen(false)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'transparent' }}>
          {selectedMarketId ? (
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ minWidth: { xs: '100%', md: '760px' } }}
            >
              <Box flex={1} minWidth={0}>
                <TradeTicketPanel />
              </Box>
              <Box flex={1} minWidth={0}>
                <DepthLadderPanel />
              </Box>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a market from the watchlist to load the sniper console.
            </Typography>
          )}
        </DialogContent>
      </Dialog>

      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Button variant="contained" color="primary" onClick={() => setPositionsOpen(true)}>
          View PnL Positions
        </Button>
        <Button variant="outlined" color="inherit" onClick={() => setBlotterOpen(true)}>
          Live Order Blotter
        </Button>
      </Box>
    </Box>
  );
}

