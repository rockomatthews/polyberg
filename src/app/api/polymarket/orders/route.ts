import { NextRequest, NextResponse } from 'next/server';
import { OrderType, Side } from '@polymarket/clob-client';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { ensureTradingClient } from '@/lib/polymarket/tradingClient';
import { recordTradeInsight } from '@/lib/services/tradeInsightsService';
import { logger } from '@/lib/logger';

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

type SubmitPayload = z.infer<typeof tradeSchema>;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated', orders: [] }, { status: 401 });
  }

  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json(
      { orders: [], meta: { error: ensured.error, status: ensured.status } },
      { status: ensured.status },
    );
  }

  try {
    const openOrders = await ensured.client.getOpenOrders();
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
    logger.error('orders.fetch.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ orders: [] }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json({ error: ensured.error }, { status: ensured.status });
  }

  let parsedPayload: SubmitPayload | null = null;

  try {
    const json = await request.json();
    parsedPayload = tradeSchema.parse(json);

    const limitPrice = parsedPayload.price / 100;
    const sizeInContracts = parsedPayload.size * 1_000; // slider is expressed in "k"
    const deferExec = parsedPayload.executionMode === 'passive';

    const result = await ensured.client.createAndPostOrder(
      {
        tokenID: parsedPayload.tokenId,
        price: limitPrice,
        size: sizeInContracts,
        side: parsedPayload.side,
      },
      undefined,
      OrderType.GTC,
      deferExec,
    );

    const responsePayload = {
      success: true,
      order: result,
    };

    recordTradeInsight({
      userId: session.user.id,
      market: parsedPayload.marketId ?? null,
      tokenId: parsedPayload.tokenId,
      side: parsedPayload.side,
      priceCents: parsedPayload.price,
      sizeThousands: parsedPayload.size,
      executionMode: parsedPayload.executionMode,
      slippage: parsedPayload.slippage,
      timeInForce: parsedPayload.timeInForce,
      orderId: result?.orderID ?? result?.id ?? null,
    }).catch((error) => {
      logger.warn('orders.tradeInsight.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.flatten()
        : error instanceof Error
          ? error.message
          : 'Unable to submit trade';
    logger.error('orders.submit.failed', {
      error: error instanceof Error ? error.message : String(error),
      payload: {
        tokenId: parsedPayload?.tokenId,
        side: parsedPayload?.side,
        price: parsedPayload?.price,
      },
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

