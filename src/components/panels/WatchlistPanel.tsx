'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import StarIcon from '@mui/icons-material/Star';

import { PanelCard } from './PanelCard';
import { useMarketsData } from '@/hooks/useTerminalData';
import { useTerminalStore } from '@/state/useTerminalStore';
import { useUserWatchlist } from '@/hooks/useWatchlist';

const getTimeLeftLabel = (endDate: string | null) => {
  if (!endDate) return '––';
  const delta = new Date(endDate).getTime() - Date.now();
  if (Number.isNaN(delta) || delta <= 0) return 'Closed';
  const days = Math.floor(delta / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d`;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(delta / (1000 * 60));
  return `${minutes}m`;
};

const formatPrice = (value: number | null) =>
  value != null ? `${value.toFixed(2)}¢` : '––';

const formatLiquidity = (value: number | null) => {
  if (value == null || Number.isNaN(value)) return '––';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
};

export function WatchlistPanel() {
  const { data, isFetching } = useMarketsData();
  const markets = data ?? [];
  const selectedMarketId = useTerminalStore((state) => state.selectedMarketId);
  const setSelection = useTerminalStore((state) => state.setSelection);
  const { watchlist, toggleWatchlist, isError } = useUserWatchlist();
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);

  const defaultMarket = React.useMemo(
    () => (data ?? []).find((market) => market.primaryTokenId),
    [data],
  );

  React.useEffect(() => {
    if (!selectedMarketId && defaultMarket?.primaryTokenId) {
      setSelection({
        marketId: defaultMarket.conditionId,
        tokenId: defaultMarket.primaryTokenId,
      });
    }
  }, [selectedMarketId, defaultMarket, setSelection]);

  const sortedMarkets = React.useMemo(() => {
    const favorites = markets.filter((market) => watchlist.includes(market.conditionId));
    const others = markets.filter((market) => !watchlist.includes(market.conditionId));
    return [...favorites, ...others];
  }, [markets, watchlist]);

  const displayMarkets = React.useMemo(() => {
    if (favoritesOnly) {
      return sortedMarkets.filter((market) => watchlist.includes(market.conditionId));
    }
    return sortedMarkets.length ? sortedMarkets : markets;
  }, [favoritesOnly, sortedMarkets, markets, watchlist]);

  const autoMarkets = React.useMemo(() => {
    if (watchlist.length > 0) {
      return [];
    }
    return markets.slice(0, 3);
  }, [markets, watchlist]);

  return (
    <PanelCard title="Watchlist" subtitle="Markets">
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {watchlist.length} favorites
          </Typography>
          <Chip
            size="small"
            label="Favorites only"
            variant={favoritesOnly ? 'filled' : 'outlined'}
            color={favoritesOnly ? 'primary' : 'default'}
            onClick={() => setFavoritesOnly((prev) => !prev)}
          />
        </Stack>
        {isError ? (
          <Alert severity="warning" variant="outlined">
            Unable to load your watchlist. Refresh or check your session.
          </Alert>
        ) : null}
        {autoMarkets.length > 0 ? (
          <Alert severity="info" variant="outlined">
            Showing the top {autoMarkets.length} trending markets from Polymarket. Star any of them
            to pin to your personal watchlist.
          </Alert>
        ) : null}
        {isFetching && !markets.length ? (
          <Skeleton variant="rounded" height={140} />
        ) : (
          displayMarkets.map((market) => {
            const isActive = market.conditionId === selectedMarketId;
            const spreadLabel =
              market.spread != null ? `${market.spread.toFixed(2)}¢` : '––';
            const isFavorite = watchlist.includes(market.conditionId);
            return (
              <Stack
                key={market.conditionId}
                direction="row"
                spacing={1}
                alignItems="center"
                onClick={() =>
                  setSelection({
                    marketId: market.conditionId,
                    tokenId: market.primaryTokenId,
                  })
                }
                sx={{
                  padding: 1,
                  borderRadius: 1,
                  bgcolor: isActive ? 'rgba(77,208,225,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${
                    isActive ? 'rgba(77,208,225,0.4)' : 'rgba(255,255,255,0.04)'
                  }`,
                  cursor: 'pointer',
                  transition: 'border-color 120ms ease',
                }}
              >
                <Stack flex={1}>
                  <Typography variant="subtitle2">{market.question}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={`Spread ${spreadLabel}`} />
                    <Typography variant="caption" color="text.secondary">
                      {getTimeLeftLabel(market.endDate)} left
                    </Typography>
                  </Stack>
                </Stack>
                <Stack alignItems="flex-end">
                  <Typography variant="body2">
                    Bid {formatPrice(market.bestBid)} / Ask {formatPrice(market.bestAsk)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Liquidity {formatLiquidity(market.liquidity)}
                  </Typography>
                </Stack>
                <Tooltip title={isFavorite ? 'Remove from watchlist' : 'Add to watchlist'}>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleWatchlist(market.conditionId, !isFavorite);
                    }}
                  >
                    {isFavorite ? (
                      <StarIcon fontSize="small" color="warning" />
                    ) : (
                      <StarOutlineIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
            );
          })
        )}
        {favoritesOnly && displayMarkets.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No starred markets yet. Click the star icon to pin favorites.
          </Typography>
        ) : null}
        {!isFetching && watchlist.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Tap the star icon or use the search bar to build a personalized watchlist.
          </Typography>
        ) : null}
        {autoMarkets.length > 0 ? (
          <Stack spacing={1}>
            {autoMarkets.map((market) => (
              <Stack
                key={`auto-${market.conditionId}`}
                direction="row"
                spacing={1}
                alignItems="center"
                onClick={() =>
                  setSelection({
                    marketId: market.conditionId,
                    tokenId: market.primaryTokenId,
                  })
                }
                sx={{
                  padding: 1,
                  borderRadius: 1,
                  border: '1px dashed rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
              >
                <Stack flex={1}>
                  <Typography variant="subtitle2">{market.question}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Auto-suggested · liquidity {formatLiquidity(market.liquidity)}
                  </Typography>
                </Stack>
                <Chip size="small" label="Popular now" color="primary" variant="outlined" />
              </Stack>
            ))}
          </Stack>
        ) : null}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={isFetching ? 25 : 72}
        sx={{ height: 4, borderRadius: 999 }}
      />
      <Typography variant="caption" color="text.secondary">
        Market data refreshed live via relayer feed.
      </Typography>
    </PanelCard>
  );
}
