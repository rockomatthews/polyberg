'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Chip from '@mui/material/Chip';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useMutation } from '@tanstack/react-query';

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
  const [side, setSide] = React.useState<'BUY' | 'SELL'>('BUY');
  const [slippage, setSlippage] = React.useState(2);
  const [timeInForce, setTimeInForce] = React.useState(15);

  type SubmitPayload = {
    tokenId: string;
    marketId?: string;
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    executionMode: typeof executionMode;
    slippage: number;
    timeInForce: number;
  };

  const placeOrder = useMutation({
    mutationFn: async (payload: SubmitPayload) => {
      const response = await fetch('/api/polymarket/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(
          typeof json.error === 'string'
            ? json.error
            : 'Order rejected by relayer. Check credentials.',
        );
      }
      return json as { success: boolean; order?: { orderID?: string } };
    },
  });

  React.useEffect(() => {
    if (derivedMid) {
      setPrice(derivedMid);
    }
  }, [derivedMid]);

  const handleSubmit = React.useCallback(() => {
    if (!selectedTokenId || !activeMarket || price == null) {
      return;
    }
    placeOrder.mutate({
      tokenId: selectedTokenId,
      marketId: selectedMarketId ?? activeMarket.conditionId,
      side,
      price,
      size,
      executionMode,
      slippage,
      timeInForce,
    });
  }, [
    activeMarket,
    executionMode,
    placeOrder,
    price,
    selectedMarketId,
    selectedTokenId,
    side,
    size,
    slippage,
    timeInForce,
  ]);

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
  const submitDisabled = !selectedTokenId || placeOrder.isPending;

  return (
    <PanelCard
      title="Sniper Ticket"
      subtitle={activeMarket.primaryOutcome ?? activeMarket.question}
    >
      <Stack spacing={2}>
        <ButtonGroup fullWidth size="small" variant="outlined">
          {(['BUY', 'SELL'] as const).map((option) => (
            <Button
              key={option}
              color={option === 'BUY' ? 'success' : 'error'}
              variant={side === option ? 'contained' : 'outlined'}
              onClick={() => setSide(option)}
            >
              {option}
            </Button>
          ))}
        </ButtonGroup>
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
            value={slippage}
            type="number"
            inputProps={{ min: 0, max: 100 }}
            onChange={(event) => {
              const next = Number(event.target.value);
              setSlippage(Number.isFinite(next) ? Math.max(0, next) : 0);
            }}
          />
          <TextField
            label="Time-in-force (s)"
            variant="filled"
            size="small"
            fullWidth
            value={timeInForce}
            type="number"
            inputProps={{ min: 1, max: 3600 }}
            onChange={(event) => {
              const next = Number(event.target.value);
              setTimeInForce(Number.isFinite(next) ? Math.max(1, next) : 1);
            }}
          />
        </Stack>
        <Button
          color="primary"
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={submitDisabled}
        >
          {placeOrder.isPending ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} color="inherit" />
              <span>Sending…</span>
            </Stack>
          ) : (
            'Arm Hotkey · Shift + Enter'
          )}
        </Button>
        {placeOrder.isError && (
          <Alert severity="error" variant="outlined">
            {placeOrder.error instanceof Error ? placeOrder.error.message : 'Order failed'}
          </Alert>
        )}
        {placeOrder.isSuccess && (
          <Alert severity="success" variant="outlined">
            Order sent to builder relayer{placeOrder.data?.order?.orderID ? (
              <> · id {placeOrder.data.order.orderID}</>
            ) : null}
          </Alert>
        )}
      </Stack>
    </PanelCard>
  );
}
