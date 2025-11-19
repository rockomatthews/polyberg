import { NextRequest, NextResponse } from 'next/server';
import { OrderType, Side } from '@polymarket/clob-client';
import { z } from 'zod';

import { clobClient } from '@/lib/polymarket/clobClient';
import { hasBuilderSigning, hasL2Auth, hasOrderSigner } from '@/lib/env';

const tradeSchema = z.object({
  tokenId: z.string().min(1),
  side: z.nativeEnum(Side),
  price: z.number().min(0).max(100),
  size: z.number().positive(),
  executionMode: z.enum(['aggressive', 'passive']).default('aggressive'),
  slippage: z.number().min(0).max(100).optional(),
  timeInForce: z.number().min(1).max(3_600).optional(),
  marketId: z.string().optional(),
});

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

export async function POST(request: NextRequest) {
  if (!hasOrderSigner) {
    return NextResponse.json(
      { error: 'Order signer key not configured. Cannot submit trades.' },
      { status: 400 },
    );
  }
  if (!hasL2Auth || !hasBuilderSigning) {
    return NextResponse.json(
      {
        error:
          'Polymarket builder auth (L2 API key + builder signer) is required before trading.',
      },
      { status: 400 },
    );
  }

  try {
    const json = await request.json();
    const payload = tradeSchema.parse(json);

    const limitPrice = payload.price / 100;
    const sizeInContracts = payload.size * 1_000; // slider is expressed in "k"
    const deferExec = payload.executionMode === 'passive';

    const result = await clobClient.createAndPostOrder(
      {
        tokenID: payload.tokenId,
        price: limitPrice,
        size: sizeInContracts,
        side: payload.side,
      },
      undefined,
      OrderType.GTC,
      deferExec,
    );

    return NextResponse.json({
      success: true,
      order: result,
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.flatten()
        : error instanceof Error
          ? error.message
          : 'Unable to submit trade';
    console.error('[api/polymarket/orders] Trade submission failed', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

