import { NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';
import { hasL2Auth } from '@/lib/env';

export async function GET() {
  if (!hasL2Auth) {
    return NextResponse.json({
      orders: [],
      meta: { requiresL2Auth: true },
    });
  }

  try {
    const openOrders = await clobClient.getOpenOrders();
    const orders = openOrders.map((order) => ({
      id: order.id,
      market: order.market,
      side: order.side,
      price: Number(order.price) * 100,
      size: Number(order.original_size) - Number(order.size_matched),
      status: order.status,
      createdAt: order.created_at,
    }));

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[api/polymarket/orders] Failed to load orders', error);
    return NextResponse.json({ orders: [] }, { status: 502 });
  }
}

