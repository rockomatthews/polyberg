import { NextResponse } from 'next/server';
import { ClobClient } from '@polymarket/clob-client';
import type { BuilderTrade, Trade } from '@polymarket/clob-client/dist/types';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { ensureTradingClient } from '@/lib/polymarket/tradingClient';
import { logger } from '@/lib/logger';

type PositionPayload = {
  market: string;
  exposure: number;
  pnl: number;
  delta: 'Long' | 'Short';
};

type AnyTrade = BuilderTrade | Trade;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { positions: [], meta: { error: 'Not authenticated' } },
      { status: 401 },
    );
  }

  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json(
      {
        positions: [],
        meta: {
          error: ensured.error,
          requiresBuilderSigning: ensured.status === 400,
        },
      },
      { status: ensured.status },
    );
  }

  try {
    const trades = await getTradesWithFallback(ensured.client);
    const aggregation = new Map<string, PositionPayload>();

    trades.forEach((trade) => {
      const key = resolveTradeKey(trade);
      if (!key) {
        return;
      }

      const direction = trade.side === 'BUY' ? 1 : -1;
      const notionals = Number(resolveTradeNotional(trade));
      const existing = aggregation.get(key) ?? {
        market: key,
        exposure: 0,
        pnl: 0,
        delta: 'Long' as const,
      };

      existing.exposure += direction * notionals;
      existing.pnl -= direction * Number(resolveTradeFee(trade));
      existing.delta = existing.exposure >= 0 ? 'Long' : 'Short';

      aggregation.set(key, existing);
    });

    const positions = Array.from(aggregation.values()).map((position) => ({
      market: position.market,
      exposure: Number(Math.abs(position.exposure).toFixed(2)),
      pnl: Number(position.pnl.toFixed(2)),
      delta: position.delta,
    }));

    return NextResponse.json({ positions });
  } catch (error) {
    logger.error('positions.fetch.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const errorMessage =
      error instanceof Error ? error.message : 'Unable to load builder trades';
    return NextResponse.json(
      {
        positions: [],
        meta: {
          error: errorMessage,
          requiresBuilderSigning: true,
        },
      },
      { status: 200 },
    );
  }
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
  if ('market' in trade && trade.market) {
    return trade.market;
  }
  if ('assetId' in trade && trade.assetId) {
    return trade.assetId;
  }
  return undefined;
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

