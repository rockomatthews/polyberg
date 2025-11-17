import { NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';

export async function GET() {
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
    return NextResponse.json({ events: [] }, { status: 502 });
  }
}

