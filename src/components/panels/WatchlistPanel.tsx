'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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

type OutcomeButtonTone = 'yes' | 'no' | 'neutral' | 'team-a' | 'team-b';

type OutcomeButtonOption = {
  label: string;
  tokenId: string | null;
  price: number | null;
  tone: OutcomeButtonTone;
};

const YES_KEYWORDS = ['yes', 'up', 'over', 'higher', 'will', 'pass'];
const NO_KEYWORDS = ['no', 'down', 'under', 'lower', 'won\'t', 'fail'];

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

const formatLiquidity = (value: number | null) => {
  if (value == null || Number.isNaN(value)) return '––';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
};

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'politics', label: 'Politics' },
  { id: 'macro', label: 'Macro' },
] as const;

export function WatchlistPanel() {
  const { data, isFetching } = useMarketsData();
  const markets = React.useMemo(() => data ?? [], [data]);
  const selectedMarketId = useTerminalStore((state) => state.selectedMarketId);
  const selectedTokenId = useTerminalStore((state) => state.selectedTokenId);
  const setSelection = useTerminalStore((state) => state.setSelection);
  const { watchlist, toggleWatchlist, isError } = useUserWatchlist();
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [categoryFilter, setCategoryFilter] =
    React.useState<(typeof CATEGORY_FILTERS)[number]['id']>('all');

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
        outcomeLabel:
          defaultMarket.primaryOutcome ??
          defaultMarket.outcomes?.[0]?.label ??
          'Yes',
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

  const filteredMarkets = React.useMemo(() => {
    const applyCategory = (list: Market[]) => {
      if (categoryFilter === 'all') {
        return list;
      }
      return list.filter((market) => deriveCategory(market) === categoryFilter);
    };
    if (favoritesOnly) {
      return applyCategory(sortedMarkets.filter((market) => watchlist.includes(market.conditionId)));
    }
    if (sortedMarkets.length) {
      return applyCategory(sortedMarkets);
    }
    return applyCategory(autoMarkets);
  }, [favoritesOnly, sortedMarkets, watchlist, autoMarkets, categoryFilter]);

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
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {CATEGORY_FILTERS.map((filter) => (
            <Chip
              key={filter.id}
              size="small"
              label={filter.label}
              variant={categoryFilter === filter.id ? 'filled' : 'outlined'}
              color={categoryFilter === filter.id ? 'primary' : 'default'}
              onClick={() => setCategoryFilter(filter.id)}
            />
          ))}
        </Stack>
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
            {filteredMarkets.map((market) => {
              const isActive = market.conditionId === selectedMarketId;
              const spreadLabel =
                market.spread != null ? `${market.spread.toFixed(2)}¢` : '––';
              const isFavorite = watchlist.includes(market.conditionId);
              const category = getMarketCategory(market);
              const outcomeOptions = buildOutcomeOptions(market);
              return (
                <Stack
                  key={market.conditionId}
                  spacing={1}
                  onClick={() =>
                    setSelection({
                      marketId: market.conditionId,
                      tokenId: market.primaryTokenId,
                      question: market.question,
                      outcomeLabel:
                        market.primaryOutcome ??
                        market.outcomes?.[0]?.label ??
                        'Yes',
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
                  <Typography variant="caption" color="text.secondary">
                    {category.charAt(0).toUpperCase() + category.slice(1)} • Ends in{' '}
                    {getTimeLeftLabel(market.endDate)}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="stretch" flexWrap="wrap">
                    {outcomeOptions.map((option, index) => (
                      <OutcomeButton
                        key={`${market.conditionId}-${index}-${option.tokenId ?? option.label}`}
                        option={option}
                        active={Boolean(
                          option.tokenId && option.tokenId === selectedTokenId,
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelection({
                            marketId: market.conditionId,
                            tokenId: option.tokenId ?? market.primaryTokenId,
                            question: market.question,
                            outcomeLabel: option.label,
                            openDepthOverlay: true,
                          });
                        }}
                      />
                    ))}
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                    <Chip size="small" label={`Spread ${spreadLabel}`} />
                    <Typography variant="caption" color="text.secondary">
                      Liquidity {formatLiquidity(market.liquidity)}
                    </Typography>
                  </Stack>
                </Stack>
              );
            })}
          </Box>
        )}
        {favoritesOnly && filteredMarkets.length === 0 ? (
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

type OutcomeButtonProps = {
  option: OutcomeButtonOption;
  active: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function OutcomeButton({ option, active, onClick }: OutcomeButtonProps) {
  const palette = resolveOutcomePalette(option.tone, active);
  return (
    <Button
      onClick={onClick}
      variant="outlined"
      size="small"
      sx={{
        flex: '1 1 120px',
        minWidth: 0,
        borderRadius: 1.5,
        borderWidth: 1,
        borderColor: palette.border,
        color: palette.text,
        backgroundColor: palette.background,
        textTransform: 'none',
        justifyContent: 'flex-start',
        px: 1.5,
        py: 1,
        minHeight: 64,
        '&:hover': {
          borderColor: palette.hoverBorder,
          backgroundColor: palette.hoverBackground,
        },
      }}
    >
      <Stack spacing={0.5} alignItems="flex-start">
        <Typography variant="button" sx={{ fontWeight: 600 }}>
          {option.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {option.price != null ? `${option.price.toFixed(1)}¢` : 'Tap to trade'}
        </Typography>
      </Stack>
    </Button>
  );
}

function resolveOutcomePalette(tone: OutcomeButtonTone, active: boolean) {
  const palettes: Record<OutcomeButtonTone, { text: string; border: string; background: string; hoverBorder: string; hoverBackground: string }> = {
    yes: {
      text: '#3efad5',
      border: 'rgba(62,250,213,0.6)',
      background: active ? 'rgba(62,250,213,0.12)' : 'transparent',
      hoverBorder: '#3efad5',
      hoverBackground: 'rgba(62,250,213,0.08)',
    },
    no: {
      text: '#ff7a93',
      border: 'rgba(255,122,147,0.6)',
      background: active ? 'rgba(255,122,147,0.12)' : 'transparent',
      hoverBorder: '#ff7a93',
      hoverBackground: 'rgba(255,122,147,0.08)',
    },
    neutral: {
      text: '#f3d96d',
      border: 'rgba(243,217,109,0.6)',
      background: active ? 'rgba(243,217,109,0.12)' : 'transparent',
      hoverBorder: '#f3d96d',
      hoverBackground: 'rgba(243,217,109,0.08)',
    },
    'team-a': {
      text: '#6fc3ff',
      border: 'rgba(111,195,255,0.6)',
      background: active ? 'rgba(111,195,255,0.12)' : 'transparent',
      hoverBorder: '#6fc3ff',
      hoverBackground: 'rgba(111,195,255,0.08)',
    },
    'team-b': {
      text: '#b18dff',
      border: 'rgba(177,141,255,0.6)',
      background: active ? 'rgba(177,141,255,0.12)' : 'transparent',
      hoverBorder: '#b18dff',
      hoverBackground: 'rgba(177,141,255,0.08)',
    },
  };
  return palettes[tone];
}

function getMarketCategory(market: Market) {
  return market.category ?? deriveCategory(market);
}

function buildOutcomeOptions(market: Market): OutcomeButtonOption[] {
  const category = getMarketCategory(market);
  const tokens = market.outcomes?.length ? market.outcomes : [];
  if (category === 'sports' && tokens.length >= 2) {
    const sportsTokens = tokens.slice(0, 3);
    return sportsTokens.map((token, index) => ({
      label:
        token.label ??
        (index === 1 && sportsTokens.length === 3 ? 'Draw' : `Outcome ${index + 1}`),
      tokenId: token.tokenId ?? (index === 0 ? market.primaryTokenId : market.secondaryTokenId),
      price: token.price ?? null,
      tone: resolveSportsTone(index, sportsTokens.length),
    }));
  }
  const yesOutcome = resolveBinaryOutcome(market, tokens, 'yes');
  const noOutcome = resolveBinaryOutcome(market, tokens, 'no', yesOutcome.price);
  return [yesOutcome, noOutcome];
}

function resolveSportsTone(index: number, length: number): OutcomeButtonTone {
  if (index === 1 && length === 3) {
    return 'neutral';
  }
  return index === 0 ? 'team-a' : 'team-b';
}

function resolveBinaryOutcome(
  market: Market,
  tokens: Market['outcomes'],
  mode: 'yes' | 'no',
  pairedPrice?: number | null,
): OutcomeButtonOption {
  const keywords = mode === 'yes' ? YES_KEYWORDS : NO_KEYWORDS;
  const fallbackLabel = mode === 'yes' ? 'Yes' : 'No';
  const fallbackTokenId = mode === 'yes' ? market.primaryTokenId : market.secondaryTokenId;
  const fallbackOutcome =
    mode === 'yes' ? market.primaryOutcome ?? fallbackLabel : market.secondaryOutcome ?? fallbackLabel;
  const matched =
    tokens.find((token) => {
      const normalized = normalizeOutcomeLabel(token.label);
      return keywords.some((word) => normalized.includes(word));
    }) ??
    tokens[(mode === 'yes' ? 0 : 1)] ??
    null;

  const resolvedPrice =
    matched?.price ??
    (mode === 'yes'
      ? market.bestAsk ?? market.bestBid ?? null
      : pairedPrice != null
      ? Number((100 - pairedPrice).toFixed(2))
      : market.bestBid ?? market.bestAsk ?? null);

  return {
    label: matched?.label ?? fallbackOutcome ?? fallbackLabel,
    tokenId: matched?.tokenId ?? fallbackTokenId ?? null,
    price: resolvedPrice,
    tone: mode,
  };
}

function normalizeOutcomeLabel(label?: string | null) {
  return label?.toLowerCase().trim() ?? '';
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

function deriveCategory(market: Market) {
  if (market.category) {
    return market.category;
  }
  const tag = market.tag?.toLowerCase() ?? '';
  const question = market.question.toLowerCase();
  const matches = (keywords: string[]) => keywords.some((word) => question.includes(word));
  if (
    ['sports', 'nfl', 'nba', 'ufc', 'mlb', 'nhl'].includes(tag) ||
    matches(['match', 'game', 'odds', 'tournament', 'world cup', 'nfl', 'nba', 'mlb', 'nhl'])
  ) {
    return 'sports';
  }
  if (
    ['movies', 'music', 'awards', 'culture'].includes(tag) ||
    matches(['oscar', 'grammy', 'album', 'movie', 'film', 'celebrity', 'tour'])
  ) {
    return 'entertainment';
  }
  if (
    ['crypto', 'tech', 'ai', 'business'].includes(tag) ||
    matches(['bitcoin', 'ethereum', 'coin', 'token', 'stock', 'ipo', 'ai'])
  ) {
    return 'crypto';
  }
  if (
    ['politics', 'elections', 'senate', 'trump'].includes(tag) ||
    matches(['election', 'president', 'congress', 'governor', 'parliament'])
  ) {
    return 'politics';
  }
  if (
    ['economy', 'science', 'world'].includes(tag) ||
    matches(['inflation', 'economy', 'gdp', 'climate', 'war', 'disease', 'hurricane'])
  ) {
    return 'macro';
  }
  return 'other';
}
