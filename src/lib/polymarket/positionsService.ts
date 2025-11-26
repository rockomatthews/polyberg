import { ClobClient } from '@polymarket/clob-client';
import type { BuilderTrade, Trade } from '@polymarket/clob-client/dist/types';

import { logger } from '@/lib/logger';

export type AggregatedPosition = {
  assetId: string;
  marketId: string | null;
  exposure: number;
  pnl: number;
  delta: 'Long' | 'Short';
};

type AnyTrade = BuilderTrade | Trade;

export async function fetchAggregatedPositions(client: ClobClient): Promise<AggregatedPosition[]> {
  const trades = await getTradesWithFallback(client);
  const aggregation = new Map<string, AggregatedPosition>();

  trades.forEach((trade) => {
    const key = resolveTradeKey(trade);
    if (!key) {
      return;
    }

    const direction = trade.side === 'BUY' ? 1 : -1;
    const notionals = Number(resolveTradeNotional(trade));
    const existing = aggregation.get(key.assetId) ?? {
      assetId: key.assetId,
      marketId: key.marketId,
      exposure: 0,
      pnl: 0,
      delta: 'Long' as const,
    };

    existing.exposure += direction * notionals;
    existing.pnl -= direction * Number(resolveTradeFee(trade));
    existing.delta = existing.exposure >= 0 ? 'Long' : 'Short';

    aggregation.set(key.assetId, existing);
  });

  return Array.from(aggregation.values()).map((position) => ({
    ...position,
    exposure: Number(Math.abs(position.exposure).toFixed(2)),
    pnl: Number(position.pnl.toFixed(2)),
  }));
}

async function getTradesWithFallback(client: ClobClient): Promise<AnyTrade[]> {
  try {
    const { trades } = await client.getBuilderTrades(undefined, undefined);
    return trades;
  } catch (error) {
    if (isBuilderAuthError(error)) {
      logger.warn('positions.builderTrades.authFailed', {
        message: error instanceof Error ? error.message : String(error),
      });
      const trades = await client.getTrades(undefined, true);
      return trades;
    }
    throw error;
  }
}

function resolveTradeKey(trade: AnyTrade) {
  if ('assetId' in trade && trade.assetId) {
    return { assetId: trade.assetId, marketId: 'market' in trade ? trade.market ?? null : null };
  }
  if ('market' in trade && trade.market) {
    return { assetId: trade.market, marketId: trade.market };
  }
  return null;
}

function resolveTradeNotional(trade: AnyTrade) {
  if ('sizeUsdc' in trade && trade.sizeUsdc != null) {
    return trade.sizeUsdc;
  }
  if ('size' in trade && trade.size != null) {
    return trade.size;
  }
  return 0;
}

function resolveTradeFee(trade: AnyTrade) {
  if ('feeUsdc' in trade && trade.feeUsdc != null) {
    return trade.feeUsdc;
  }
  if ('feeUsd' in trade && trade.feeUsd != null) {
    return trade.feeUsd;
  }
  if ('fee' in trade && trade.fee != null) {
    return trade.fee;
  }
  return 0;
}

function isBuilderAuthError(error: unknown) {
  if (error instanceof Error) {
    return /builder key auth failed/i.test(error.message);
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && /builder key auth failed/i.test(message);
  }
  return false;
}


