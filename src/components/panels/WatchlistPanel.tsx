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
import Box from '@mui/material/Box';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import StarIcon from '@mui/icons-material/Star';

import { PanelCard } from './PanelCard';
import { useMarketsData } from '@/hooks/useTerminalData';
import { useTerminalStore } from '@/state/useTerminalStore';
import { useUserWatchlist } from '@/hooks/useWatchlist';
import type { Market } from '@/lib/api/types';

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
  const markets = React.useMemo(() => data ?? [], [data]);
  const selectedMarketId = useTerminalStore((state) => state.selectedMarketId);
  const setSelection = useTerminalStore((state) => state.setSelection);
  const { watchlist, toggleWatchlist, isError } = useUserWatchlist();
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);

  const defaultMarket = React.useMemo(
    () => markets.find((market) => market.primaryTokenId),
    [markets],
  );

  React.useEffect(() => {
    if (!selectedMarketId && defaultMarket?.primaryTokenId) {
      setSelection({
        marketId: defaultMarket.conditionId,
        tokenId: defaultMarket.primaryTokenId,
        question: defaultMarket.question,
        openDepthOverlay: false,
      });
    }
  }, [selectedMarketId, defaultMarket, setSelection]);

  const sortedMarkets = React.useMemo(() => {
    const favorites = markets.filter((market) => watchlist.includes(market.conditionId));
    const others = markets.filter((market) => !watchlist.includes(market.conditionId));
    return [...favorites, ...others];
  }, [markets, watchlist]);

  const autoMarkets = React.useMemo(() => {
    if (watchlist.length > 0) {
      return [];
    }
    return pickFeaturedMarkets(markets, 12);
  }, [markets, watchlist]);

  const gridMarkets = React.useMemo(() => {
    if (favoritesOnly) {
      return sortedMarkets.filter((market) => watchlist.includes(market.conditionId));
    }
    if (sortedMarkets.length) {
      return sortedMarkets;
    }
    return autoMarkets;
  }, [favoritesOnly, sortedMarkets, watchlist, autoMarkets]);

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
        {autoMarkets.length > 0 && !watchlist.length ? (
          <Alert severity="info" variant="outlined">
            Showing a rotating mix of trending Polymarket markets. Star any card to pin it to your
            watchlist.
          </Alert>
        ) : null}
        {isFetching && !markets.length ? (
          <Skeleton variant="rounded" height={220} />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            {gridMarkets.map((market) => {
              const isActive = market.conditionId === selectedMarketId;
              const spreadLabel =
                market.spread != null ? `${market.spread.toFixed(2)}¢` : '––';
              const isFavorite = watchlist.includes(market.conditionId);
              return (
                <Stack
                  key={market.conditionId}
                  spacing={1}
                  onClick={() =>
                    setSelection({
                      marketId: market.conditionId,
                      tokenId: market.primaryTokenId,
                      question: market.question,
                      openDepthOverlay: true,
                    })
                  }
                  sx={{
                    p: 1.25,
                    borderRadius: 1.2,
                    bgcolor: isActive ? 'rgba(77,208,225,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${
                      isActive ? 'rgba(77,208,225,0.4)' : 'rgba(255,255,255,0.04)'
                    }`,
                    cursor: 'pointer',
                    minHeight: 140,
                    transition: 'border-color 120ms ease, transform 120ms ease',
                    '&:hover': {
                      borderColor: 'rgba(77,208,225,0.4)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Stack flex={1} spacing={0.5}>
                      <Typography variant="subtitle2" sx={{ minHeight: 48 }}>
                        {market.question}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {market.tag || 'General'}
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
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip size="small" label={`Spread ${spreadLabel}`} />
                    <Chip size="small" variant="outlined" label={`${getTimeLeftLabel(market.endDate)} left`} />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      Bid {formatPrice(market.bestBid)} / Ask {formatPrice(market.bestAsk)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Liquidity {formatLiquidity(market.liquidity)}
                    </Typography>
                  </Stack>
                </Stack>
              );
            })}
          </Box>
        )}
        {favoritesOnly && gridMarkets.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No starred markets yet. Click the star icon to pin favorites.
          </Typography>
        ) : null}
        {!isFetching && watchlist.length === 0 && autoMarkets.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Tap the star icon or use the search bar to build a personalized watchlist.
          </Typography>
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

function pickFeaturedMarkets(markets: Market[] = [], count = 12) {
  const byTag = new Map<string, typeof markets>();
  markets.forEach((market) => {
    const tag = (market.tag ?? 'General').toLowerCase();
    if (!byTag.has(tag)) {
      byTag.set(tag, []);
    }
    byTag.get(tag)!.push(market);
  });
  const tags = shuffle(Array.from(byTag.keys()));
  const selected: typeof markets = [];
  if (tags.length === 0) {
    return markets.slice(0, count);
  }
  let index = 0;
  while (selected.length < count && tags.length > 0) {
    const tag = tags[index % tags.length];
    const bucket = byTag.get(tag);
    if (bucket && bucket.length) {
      selected.push(bucket.shift()!);
      index++;
    } else {
      byTag.delete(tag);
      tags.splice(index % tags.length, 1);
    }
  }
  return selected;
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
