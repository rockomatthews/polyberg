import { NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';
import { hasBuilderSigning } from '@/lib/env';

type PositionPayload = {
  market: string;
  exposure: number;
  pnl: number;
  delta: 'Long' | 'Short';
};

export async function GET() {
  if (!hasBuilderSigning) {
    return NextResponse.json({
      positions: [],
      meta: { requiresBuilderSigning: true },
    });
  }

  try {
    const { trades } = await clobClient.getBuilderTrades(undefined, undefined);
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
    console.error('[api/polymarket/positions] Failed to fetch builder trades', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unable to load builder trades';
    return NextResponse.json(
      {
        positions: [],
        meta: {
          error: errorMessage,
          requiresBuilderSigning: !hasBuilderSigning,
        },
      },
      { status: 200 },
    );
  }
}

