import { NextResponse } from 'next/server';
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
    const { trades } = await ensured.client.getBuilderTrades(undefined, undefined);
    const aggregation = new Map<string, PositionPayload>();

    trades.forEach((trade) => {
      const key = trade.market ?? trade.assetId;
      if (!key) {
        return;
      }

      const direction = trade.side === 'BUY' ? 1 : -1;
      const notionals = Number(trade.sizeUsdc ?? trade.size ?? 0);
      const existing = aggregation.get(key) ?? {
        market: key,
        exposure: 0,
        pnl: 0,
        delta: 'Long' as const,
      };

      existing.exposure += direction * notionals;
      existing.pnl -= direction * Number(trade.feeUsdc ?? 0);
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

