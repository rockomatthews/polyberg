import { NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';
import { hasL2Auth } from '@/lib/env';

export async function GET() {
  if (!hasL2Auth) {
    return NextResponse.json({
      events: [],
      meta: { requiresL2Auth: true },
    });
  }

  try {
    const { trades } = await clobClient.getTradesPaginated(undefined, undefined);
    const events = (trades ?? []).slice(0, 20).map((trade) => ({
      id: trade.id,
      type: 'Trade' as const,
      message: `${trade.side} ${Number(trade.size).toFixed(2)} @ ${(Number(trade.price) * 100).toFixed(2)}¢ · ${trade.market}`,
      ts: trade.match_time,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[api/polymarket/activity] Failed to fetch trades', error);
    return NextResponse.json(
      {
        events: [],
        meta: { error: error instanceof Error ? error.message : 'Failed to load activity feed' },
      },
      { status: 200 },
    );
  }
}

