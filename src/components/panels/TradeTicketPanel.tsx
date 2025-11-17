'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { PanelCard } from './PanelCard';
import { useMarketsData, useOrderBookData } from '@/hooks/useTerminalData';
import { useTerminalStore } from '@/state/useTerminalStore';

const deriveMidPrice = (bid: number | null, ask: number | null) => {
  if (bid != null && ask != null) return (bid + ask) / 2;
  if (bid != null) return bid + 1;
  if (ask != null) return ask - 1;
  return 50;
};

export function TradeTicketPanel() {
  const { data: markets } = useMarketsData();
  const selectedMarketId = useTerminalStore((state) => state.selectedMarketId);
  const selectedTokenId = useTerminalStore((state) => state.selectedTokenId);
  const executionMode = useTerminalStore((state) => state.executionMode);
  const setExecutionMode = useTerminalStore((state) => state.setExecutionMode);
  const { data: orderBook } = useOrderBookData(selectedTokenId);

  const activeMarket = markets?.find((market) => market.conditionId === selectedMarketId);

  const bestBid =
    orderBook?.bids?.[0]?.price != null
      ? orderBook.bids[0].price * 100
      : activeMarket?.bestBid ?? null;
  const bestAsk =
    orderBook?.asks?.[0]?.price != null
      ? orderBook.asks[0].price * 100
      : activeMarket?.bestAsk ?? null;

  const derivedMid = deriveMidPrice(bestBid, bestAsk);
  const [price, setPrice] = React.useState(derivedMid);
  const [size, setSize] = React.useState(5);

  React.useEffect(() => {
    if (derivedMid) {
      setPrice(derivedMid);
    }
  }, [derivedMid]);

  if (!activeMarket) {
    return (
      <PanelCard title="Sniper Ticket" subtitle="Execution">
        <Typography variant="body2" color="text.secondary">
          Choose a market from the watchlist to prime the sniping ticket.
        </Typography>
      </PanelCard>
    );
  }

  const priceSliderMin = Math.max(0, derivedMid - 20);
  const priceSliderMax = derivedMid + 20;

  return (
    <PanelCard
      title="Sniper Ticket"
      subtitle={activeMarket.primaryOutcome ?? activeMarket.question}
    >
      <Stack spacing={2}>
        <ButtonGroup fullWidth size="small" variant="outlined">
          <Button
            variant={executionMode === 'aggressive' ? 'contained' : 'outlined'}
            onClick={() => setExecutionMode('aggressive')}
          >
            Aggressive
          </Button>
          <Button
            variant={executionMode === 'passive' ? 'contained' : 'outlined'}
            onClick={() => setExecutionMode('passive')}
          >
            Passive
          </Button>
        </ButtonGroup>
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            Limit Price ({price.toFixed(2)}¢)
          </Typography>
          <Slider
            value={price}
            min={priceSliderMin}
            max={priceSliderMax}
            onChange={(_, value) => setPrice(value as number)}
            size="small"
          />
        </Stack>
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            Size ({size.toFixed(2)}k)
          </Typography>
          <Slider
            value={size}
            min={1}
            max={20}
            onChange={(_, value) => setSize(value as number)}
            size="small"
          />
          <Stack direction="row" spacing={1}>
            {[2, 5, 10].map((preset) => (
              <Chip
                key={preset}
                label={`${preset}k`}
                onClick={() => setSize(preset)}
                variant={size === preset ? 'filled' : 'outlined'}
                color={size === preset ? 'primary' : 'default'}
              />
            ))}
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            label="Slippage (¢)"
            variant="filled"
            size="small"
            fullWidth
            defaultValue={2}
          />
          <TextField
            label="Time-in-force (s)"
            variant="filled"
            size="small"
            fullWidth
            defaultValue={15}
          />
        </Stack>
        <Button color="primary" variant="contained" size="large">
          Arm Hotkey · Shift + Enter
        </Button>
      </Stack>
    </PanelCard>
  );
}
