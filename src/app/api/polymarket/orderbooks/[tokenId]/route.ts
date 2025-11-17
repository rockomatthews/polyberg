import { NextRequest, NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';

export async function GET(
  _request: NextRequest,
  { params }: { params: { tokenId: string } },
) {
  const tokenId = decodeURIComponent(params.tokenId);

  if (!tokenId) {
    return NextResponse.json({ error: 'Missing token id' }, { status: 400 });
  }

  try {
    const summary = await clobClient.getOrderBook(tokenId);
    const bids = (summary.bids ?? []).slice(0, 12).map((level) => ({
      price: Number(level.price),
      size: Number(level.size),
    }));
    const asks = (summary.asks ?? []).slice(0, 12).map((level) => ({
      price: Number(level.price),
      size: Number(level.size),
    }));

    return NextResponse.json({
      tokenId,
      bids,
      asks,
      updatedAt: summary.timestamp,
    });
  } catch (error) {
    console.error('[api/polymarket/orderbooks] Failed to fetch orderbook', tokenId, error);
    return NextResponse.json(
      { error: 'Unable to load orderbook for token' },
      { status: 502 },
    );
  }
}

