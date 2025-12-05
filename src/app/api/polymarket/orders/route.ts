import { NextRequest, NextResponse } from 'next/server';
import { OrderType, Side } from '@polymarket/clob-client';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { ensureTradingClient } from '@/lib/polymarket/tradingClient';
import { recordTradeInsight } from '@/lib/services/tradeInsightsService';
import { logger } from '@/lib/logger';
import {
  ensureUserSafeReady,
  SafeNotReadyError,
} from '@/lib/services/safeTradingGate';
import {
  clampPrice,
  estimateOrderCollateral,
  COLLATERAL_TOLERANCE,
} from '@/lib/trading/collateral';
import { getSafeBalance, SafeBalanceError } from '@/lib/services/safeBalanceService';
import {
  ensureUserTradingCredentials,
  TradingCredentialsError,
} from '@/lib/services/tradingCredentialsService';

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

type ClassifiedOrderError =
  | {
      code: 'INSUFFICIENT_FUNDS';
      status: number;
      message: string;
      rawMessage: string;
    }
  | {
      code: 'ORDER_REJECTED';
      status: number;
      message: string;
      rawMessage: string;
    };

function extractOrderErrorMessage(error: unknown): string {
  const fallthrough = 'Unable to submit trade';
  if (!error) {
    return fallthrough;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || fallthrough;
  }
  if (typeof error === 'object' && error) {
    const maybeResponse = (error as { response?: unknown }).response;
    if (maybeResponse && typeof maybeResponse === 'object') {
      const data = (maybeResponse as { data?: unknown }).data;
      const extracted = extractMessageFromData(data);
      if (extracted) {
        return extracted;
      }
    }
    if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return (error as { message?: string }).message ?? fallthrough;
    }
  }
  return fallthrough;
}

function extractMessageFromData(data: unknown): string | undefined {
  if (!data) {
    return undefined;
  }
  if (typeof data === 'string') {
    return data;
  }
  if (typeof data !== 'object') {
    return undefined;
  }
  const fields = ['message', 'error', 'detail', 'description'] as const;
  for (const field of fields) {
    const value = (data as Record<string, unknown>)[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  if (Array.isArray((data as { errors?: unknown }).errors)) {
    const first = ((data as { errors?: unknown }).errors as Array<unknown>).find(Boolean);
    if (first && typeof first === 'object') {
      const nested = extractMessageFromData(first);
      if (nested) {
        return nested;
      }
    } else if (typeof first === 'string') {
      return first;
    }
  }
  try {
    return JSON.stringify(data);
  } catch {
    return undefined;
  }
}

function classifyOrderError(error: unknown): ClassifiedOrderError {
  const rawMessage = extractOrderErrorMessage(error);
  const normalized = rawMessage.toLowerCase();
  const insufficient =
    normalized.includes('insufficient') ||
    normalized.includes('not enough') ||
    normalized.includes('no funds') ||
    normalized.includes('available balance');
  if (insufficient) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      status: 402,
      message: 'No funds detected in your Safe. Deposit Polygon USDC and retry.',
      rawMessage,
    };
  }
  return {
    code: 'ORDER_REJECTED',
    status: 400,
    message: rawMessage || 'Order rejected by relayer',
    rawMessage,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated', orders: [] }, { status: 401 });
  }

  try {
    await ensureUserTradingCredentials(session.user.id);
  } catch (error) {
    if (error instanceof TradingCredentialsError) {
      return NextResponse.json(
        {
          orders: [],
          meta: {
            error: error.message,
            requiresBuilderSigning: true,
          },
        },
        { status: 409 },
      );
    }
    throw error;
  }

  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json(
      {
        orders: [],
        meta: {
          error: ensured.error,
          status: ensured.status,
          requiresBuilderSigning: ensured.status === 400,
        },
      },
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
    return NextResponse.json(
      {
        orders: [],
        meta: {
          error: 'Unable to load open orders from builder relayer',
          requiresBuilderSigning: true,
        },
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let safeAddress: string | null = null;
  try {
    safeAddress = await ensureUserSafeReady(session.user.id);
  } catch (error) {
    if (error instanceof SafeNotReadyError) {
      return NextResponse.json(
        {
          error: error.message,
          safe: error.payload,
        },
        { status: 409 },
      );
    }
    throw error;
  }

  try {
    await ensureUserTradingCredentials(session.user.id);
  } catch (error) {
    if (error instanceof TradingCredentialsError) {
      return NextResponse.json(
        { error: error.message, code: 'TRADING_CREDENTIALS_MISSING' },
        { status: 409 },
      );
    }
    throw error;
  }

  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json({ error: ensured.error }, { status: ensured.status });
  }

  let parsedPayload: SubmitPayload | null = null;

  try {
    const json = await request.json();
    parsedPayload = tradeSchema.parse(json);

    const priceDecimal = parsedPayload.price / 100;
    const normalizedPrice = clampPrice(priceDecimal);
    const limitPrice = Number(normalizedPrice.toFixed(3)); // clamp float noise before relayer call
    const sizeInContracts = parsedPayload.size * 1_000; // slider is expressed in "k"
    const deferExec = parsedPayload.executionMode === 'passive';

    let availableSafeBalance: number | null = null;
    try {
      if (safeAddress) {
        const { balance } = await getSafeBalance(safeAddress);
        availableSafeBalance = balance;
      }
    } catch (error) {
      if (error instanceof SafeBalanceError) {
        logger.error('orders.safeBalance.failed', {
          error: error.message,
          status: error.status,
        });
        return NextResponse.json(
          { error: error.message, code: 'SAFE_BALANCE_ERROR', meta: error.meta },
          { status: error.status },
        );
      }
      throw error;
    }

    const { requiredCollateral } = estimateOrderCollateral({
      side: parsedPayload.side,
      priceDecimals: limitPrice,
      sizeThousands: parsedPayload.size,
      slippageCents: parsedPayload.slippage,
    });

    if (
      availableSafeBalance != null &&
      requiredCollateral > availableSafeBalance + COLLATERAL_TOLERANCE
    ) {
      const formattedRequired = requiredCollateral.toFixed(2);
      const formattedAvailable = availableSafeBalance.toFixed(2);
      return NextResponse.json(
        {
          error: `Insufficient Safe balance. Need $${formattedRequired}, available $${formattedAvailable}.`,
          code: 'INSUFFICIENT_FUNDS',
          safeBalance: availableSafeBalance,
          required: requiredCollateral,
        },
        { status: 402 },
      );
    }

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
    if (error instanceof z.ZodError) {
      logger.error('orders.submit.failed', {
        error: error.flatten(),
        payload: {
          tokenId: parsedPayload?.tokenId,
          side: parsedPayload?.side,
          price: parsedPayload?.price,
        },
      });
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    const classified = classifyOrderError(error);
    logger.error('orders.submit.failed', {
      error: classified.rawMessage,
      code: classified.code,
      payload: {
        tokenId: parsedPayload?.tokenId,
        side: parsedPayload?.side,
        price: parsedPayload?.price,
      },
    });
    return NextResponse.json(
      {
        error: classified.message,
        code: classified.code,
      },
      { status: classified.status },
    );
  }
}

