'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PanelCard } from './PanelCard';
import { useMarketsData, useOrderBookData } from '@/hooks/useTerminalData';
import { useTerminalStore } from '@/state/useTerminalStore';

export function DepthLadderPanel() {
  const { data: markets } = useMarketsData();
  const selectedMarketId = useTerminalStore((state) => state.selectedMarketId);
  const selectedTokenId = useTerminalStore((state) => state.selectedTokenId);
  const selectedMarketQuestion = useTerminalStore((state) => state.selectedMarketQuestion);
  const selectedOutcomeLabel = useTerminalStore((state) => state.selectedOutcomeLabel);
  const { data: orderBook, isFetching } = useOrderBookData(selectedTokenId);
  const activeMarket = markets?.find((market) => market.conditionId === selectedMarketId);

  const ladderRows = React.useMemo(() => {
    if (!orderBook) return [];
    const maxDepth = 8;
    const rows = [];
    for (let i = 0; i < maxDepth; i += 1) {
      rows.push({
        bid: orderBook.bids[i],
        ask: orderBook.asks[i],
      });
    }
    return rows;
  }, [orderBook]);

  return (
    <PanelCard
      title={activeMarket?.question ?? selectedMarketQuestion ?? 'Order Book'}
      subtitle={
        activeMarket
          ? selectedOutcomeLabel
            ? `${selectedOutcomeLabel} depth`
            : 'Depth ladder'
          : 'Select a market'
      }
      minHeight={320}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label="Auto-center" color="primary" size="small" variant="outlined" />
        <Typography variant="caption" color="text.secondary">
          Last update {isFetching ? '...' : 'live'}
        </Typography>
      </Stack>
      {!selectedTokenId ? (
        <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Select a market from the watchlist to view depth.
          </Typography>
        </Stack>
      ) : isFetching && !ladderRows.length ? (
        <Skeleton variant="rounded" height={200} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 1,
            fontSize: '0.85rem',
          }}
        >
          <Typography color="text.secondary">Bid Size</Typography>
          <Typography color="text.secondary">Price (¢)</Typography>
          <Typography color="text.secondary" textAlign="right">
            Ask Size
          </Typography>
          {ladderRows.map((row, index) => (
            <React.Fragment key={`${row.bid?.price ?? row.ask?.price ?? index}-${index}`}>
              <Box
                sx={{
                  background: 'rgba(77,208,225,0.08)',
                  borderRadius: 0.5,
                  px: 1,
                  textAlign: 'left',
                }}
              >
                {row.bid ? row.bid.size.toFixed(2) : '––'}
              </Box>
              <Typography textAlign="center">
                {row.bid?.price != null
                  ? `${(row.bid.price * 100).toFixed(2)}¢`
                  : row.ask?.price != null
                  ? `${(row.ask.price * 100).toFixed(2)}¢`
                  : '––'}
              </Typography>
              <Box
                sx={{
                  background: 'rgba(244,143,177,0.08)',
                  borderRadius: 0.5,
                  px: 1,
                  textAlign: 'right',
                }}
              >
                {row.ask ? row.ask.size.toFixed(2) : '––'}
              </Box>
            </React.Fragment>
          ))}
        </Box>
      )}
      <LinearProgress value={orderBook ? 54 : 12} variant="determinate" />
      <Typography variant="caption" color="text.secondary">
        Book imbalance 58% bullish · refreshes every 1.5s
      </Typography>
    </PanelCard>
  );
}
