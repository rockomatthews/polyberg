'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useMutation } from '@tanstack/react-query';
import { signIn, useSession } from 'next-auth/react';

import { PanelCard } from './PanelCard';
import { useMarketsData, useOrderBookData } from '@/hooks/useTerminalData';
import { useTerminalStore } from '@/state/useTerminalStore';
import { useSafeStatus } from '@/hooks/useSafeStatus';

const deriveMidPrice = (bid: number | null, ask: number | null) => {
  if (bid != null && ask != null) return (bid + ask) / 2;
  if (bid != null) return bid + 1;
  if (ask != null) return ask - 1;
  return 50;
};

type OrderMutationResponse = { success: boolean; order?: { orderID?: string } };
type OrderMutationError = Error & { code?: string; status?: number };

const getOrderErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object' && 'code' in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
};

export function TradeTicketPanel() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const { data: markets } = useMarketsData();
  const selectedMarketId = useTerminalStore((state) => state.selectedMarketId);
  const selectedTokenId = useTerminalStore((state) => state.selectedTokenId);
  const selectedMarketOverride = useTerminalStore((state) => state.selectedMarketOverride);
  const executionMode = useTerminalStore((state) => state.executionMode);
  const setExecutionMode = useTerminalStore((state) => state.setExecutionMode);
  const selectedOutcomeLabel = useTerminalStore((state) => state.selectedOutcomeLabel);
  const setSelection = useTerminalStore((state) => state.setSelection);
  const { data: orderBook } = useOrderBookData(selectedTokenId);
  const { safeStatus } = useSafeStatus();

  const activeMarket =
    markets?.find((market) => market.conditionId === selectedMarketId) ??
    selectedMarketOverride ??
    null;
  const marketOutcomes = activeMarket?.outcomes ?? [];

  const bestBid =
    orderBook?.bids?.[0]?.price != null
      ? orderBook.bids[0].price * 100
      : activeMarket?.bestBid ?? null;
  const bestAsk =
    orderBook?.asks?.[0]?.price != null
      ? orderBook.asks[0].price * 100
      : activeMarket?.bestAsk ?? null;

  const derivedMid = deriveMidPrice(bestBid, bestAsk);
  const [amountUsd, setAmountUsd] = React.useState(100);
  const [limitPrice, setLimitPrice] = React.useState(derivedMid);
  const [side, setSide] = React.useState<'BUY' | 'SELL'>('BUY');
  const [slippage, setSlippage] = React.useState(2);
  const [timeInForce, setTimeInForce] = React.useState(30);
  const [authRedirecting, setAuthRedirecting] = React.useState(false);

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
      const json = (await response.json()) as
        | (OrderMutationResponse & { error?: string; code?: string })
        | { error?: string; code?: string };
      if (!response.ok || json.error) {
        const message =
          typeof json.error === 'string'
            ? json.error
            : 'Order rejected by relayer. Check credentials.';
        const error = new Error(message) as OrderMutationError;
        if ('code' in json && typeof json.code === 'string') {
          error.code = json.code;
        }
        error.status = response.status;
        throw error;
      }
      return json as OrderMutationResponse;
    },
  });

  React.useEffect(() => {
    if (Number.isFinite(derivedMid)) {
      setLimitPrice(derivedMid);
    }
  }, [derivedMid, selectedTokenId]);

  React.useEffect(() => {
    if (!activeMarket) {
      return;
    }
    if (selectedTokenId) {
      return;
    }
    const fallbackOutcome = activeMarket.outcomes?.find((outcome) => outcome.tokenId);
    if (fallbackOutcome?.tokenId) {
      setSelection({
        marketId: activeMarket.conditionId,
        tokenId: fallbackOutcome.tokenId,
        question: activeMarket.question,
        outcomeLabel: fallbackOutcome.label ?? activeMarket.primaryOutcome ?? 'Outcome',
        openDepthOverlay: false,
      });
    }
  }, [activeMarket, selectedTokenId, setSelection]);

  const safeRequired = safeStatus?.requireSafe ?? false;
  const safeReady = safeStatus?.state === 'ready' || !safeRequired;
  const effectiveTokenId = selectedTokenId ?? activeMarket?.primaryTokenId ?? null;
  const isMarketOrder = executionMode === 'aggressive';
  const marketPriceCents =
    side === 'BUY'
      ? bestAsk ?? derivedMid
      : bestBid ?? derivedMid;
  const effectivePriceCents = isMarketOrder ? marketPriceCents : limitPrice;
  const priceReady = effectivePriceCents != null && effectivePriceCents > 0;
  const normalizedAmount = Number.isFinite(amountUsd) ? Math.max(1, amountUsd) : 1;
  const sizeThousands = priceReady
    ? normalizedAmount / ((effectivePriceCents as number) / 100) / 1000
    : 0;
  const estimatedShares = sizeThousands * 1000;
  const estimatedCost =
    priceReady && estimatedShares > 0
      ? (estimatedShares * (effectivePriceCents as number)) / 100
      : 0;
  const normalizedPriceCents = priceReady ? Number((effectivePriceCents as number).toFixed(2)) : null;
  const normalizedSizeThousands = sizeThousands > 0 ? Number(sizeThousands.toFixed(6)) : 0;
  const submitDisabled =
    !effectiveTokenId ||
    placeOrder.isPending ||
    !safeReady ||
    normalizedPriceCents == null ||
    normalizedSizeThousands <= 0;
  const orderErrorCode = getOrderErrorCode(placeOrder.error);
  const showInsufficientFunds = orderErrorCode === 'INSUFFICIENT_FUNDS';

  const handleSubmit = () => {
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        setAuthRedirecting(true);
        void signIn(undefined, { callbackUrl: window.location.href }).finally(() => {
          setAuthRedirecting(false);
        });
      } else {
        void signIn();
      }
      return;
    }

    if (
      !activeMarket ||
      !effectiveTokenId ||
      normalizedPriceCents == null ||
      normalizedSizeThousands <= 0
    ) {
      return;
    }
    placeOrder.mutate({
      tokenId: effectiveTokenId,
      marketId: selectedMarketId ?? activeMarket.conditionId,
      side,
      price: normalizedPriceCents,
      size: normalizedSizeThousands,
      executionMode,
      slippage,
      timeInForce,
    });
  };

  if (!activeMarket) {
    return (
      <PanelCard title="Sniper Ticket" subtitle="Execution">
        <Typography variant="body2" color="text.secondary">
          Choose a market from the watchlist to prime the sniping ticket.
        </Typography>
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="Sniper Ticket"
      subtitle={
        activeMarket
          ? selectedOutcomeLabel
            ? `${selectedOutcomeLabel} · ${activeMarket.question}`
            : activeMarket.question
          : 'Select a market to arm the ticket'
      }
    >
      <Stack spacing={2}>
        {!isAuthenticated ? (
          <Alert severity="info" variant="outlined">
            Create an account or sign in to execute live orders. You can browse markets without an
            account, but trading requires authentication.
          </Alert>
        ) : null}
        {safeRequired && !safeReady ? (
          <Alert severity="warning" variant="outlined">
            Gasless trading requires an active Safe. Deploy one from your profile, fund it with
            Polygon USDC, then return to execute.
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <ButtonGroup fullWidth size="small" variant="outlined">
            {(['BUY', 'SELL'] as const).map((option) => (
              <Button
                key={option}
                color={option === 'BUY' ? 'success' : 'error'}
                variant={side === option ? 'contained' : 'outlined'}
                onClick={() => setSide(option)}
              >
                {option === 'BUY' ? 'Buy (Long)' : 'Sell (Short)'}
              </Button>
            ))}
          </ButtonGroup>
          <ButtonGroup fullWidth size="small" variant="outlined">
            <Button
              variant={isMarketOrder ? 'contained' : 'outlined'}
              onClick={() => setExecutionMode('aggressive')}
            >
              Market
            </Button>
            <Button
              variant={!isMarketOrder ? 'contained' : 'outlined'}
              onClick={() => setExecutionMode('passive')}
            >
              Limit
            </Button>
          </ButtonGroup>
        </Stack>

        {marketOutcomes.length ? (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Outcome
            </Typography>
            <ButtonGroup fullWidth size="small" variant="outlined">
              {marketOutcomes.map((outcome) => (
                <Button
                  key={outcome.tokenId ?? outcome.label ?? 'outcome'}
                  variant={
                    outcome.tokenId && outcome.tokenId === effectiveTokenId
                      ? 'contained'
                      : 'outlined'
                  }
                  onClick={() => {
                    if (!outcome.tokenId || !activeMarket) return;
                    setSelection({
                      marketId: activeMarket.conditionId,
                      tokenId: outcome.tokenId,
                      question: activeMarket.question,
                      outcomeLabel: outcome.label ?? 'Outcome',
                      openDepthOverlay: true,
                    });
                  }}
                >
                  {outcome.label ?? 'Outcome'}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
        ) : null}

        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            Amount (USD)
          </Typography>
          <TextField
            variant="outlined"
            size="medium"
            type="number"
            value={amountUsd}
            inputProps={{ min: 1, step: 1, style: { fontSize: '1.2rem', padding: '14px 12px' } }}
            onChange={(event) => {
              const next = Number(event.target.value);
              setAmountUsd(Number.isFinite(next) ? next : 0);
            }}
            fullWidth
          />
        </Stack>

        {!isMarketOrder ? (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Limit price (¢)
            </Typography>
            <TextField
              variant="outlined"
              size="small"
              type="number"
              value={Number.isFinite(limitPrice) ? limitPrice : ''}
              inputProps={{ min: 1, max: 99, step: 0.1 }}
              onChange={(event) => {
                const next = Number(event.target.value);
                setLimitPrice(
                  Number.isFinite(next) ? Math.min(99.9, Math.max(0.1, next)) : limitPrice,
                );
              }}
              fullWidth
              helperText="Orders rest on the book until filled or cancelled."
            />
          </Stack>
        ) : (
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Market order will execute at best available book price (currently{' '}
              {marketPriceCents != null ? `${Number(marketPriceCents).toFixed(2)}¢` : '––'}).
            </Typography>
          </Stack>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Slippage (¢)"
            variant="outlined"
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
            variant="outlined"
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

        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary">
            Est. shares {estimatedShares > 0 ? estimatedShares.toFixed(2) : '––'} · Est. cost $
            {estimatedCost > 0 ? estimatedCost.toFixed(2) : '0.00'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Fill price {priceReady ? `${(effectivePriceCents as number).toFixed(2)}¢` : '––'} · Side{' '}
            {side === 'BUY' ? 'Buy' : 'Sell'}
          </Typography>
        </Stack>

        <Button
          color="primary"
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={submitDisabled && isAuthenticated}
          sx={{ alignSelf: 'flex-start' }}
        >
          {placeOrder.isPending || authRedirecting ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} color="inherit" />
              <span>{authRedirecting ? 'Redirecting…' : 'Executing…'}</span>
            </Stack>
          ) : (
            'Execute Order'
          )}
        </Button>

        {showInsufficientFunds ? (
          <Alert severity="warning" variant="outlined">
            No funds detected in your Safe. Send Polygon USDC to{' '}
            {safeStatus?.safeAddress ? (
              <Typography component="span" variant="body2" fontWeight={600}>
                {safeStatus.safeAddress}
              </Typography>
            ) : (
              'your Safe address'
            )}{' '}
            and try again.
          </Alert>
        ) : null}
        {placeOrder.isError && !showInsufficientFunds ? (
          <Alert severity="error" variant="outlined">
            {placeOrder.error instanceof Error ? placeOrder.error.message : 'Order failed'}
          </Alert>
        ) : null}
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
