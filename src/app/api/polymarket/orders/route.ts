import { NextRequest, NextResponse } from 'next/server';
import { AssetType, OrderType, Side } from '@polymarket/clob-client';
import { z } from 'zod';
import { getServerSession } from 'next-auth/next';
import { parseUnits } from '@ethersproject/units';
import { Contract, Wallet } from '@ethersproject/wallet';
import { JsonRpcProvider } from '@ethersproject/providers';
import { MaxUint256 } from '@ethersproject/constants';

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
import { env } from '@/lib/env';
import { getUserSafe } from '@/lib/services/userService';
import {
  createTransferTransaction,
  executeTransactionsWithSigner,
} from '@/lib/relayer/transactions';

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

const EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const erc20Abi = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

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

function resolveBuilderError(payload: unknown): string | null {
  if (!payload) {
    return 'Builder relayer returned an empty response';
  }
  if (typeof payload !== 'object') {
    return null;
  }
  const maybeError = (payload as { error?: unknown }).error;
  if (maybeError) {
    if (typeof maybeError === 'string') {
      return maybeError;
    }
    if (maybeError instanceof Error && maybeError.message) {
      return maybeError.message;
    }
    try {
      return JSON.stringify(maybeError);
    } catch {
      return 'Builder relayer rejected the order';
    }
  }
  if ('success' in payload && (payload as { success?: unknown }).success === false) {
    return 'Builder relayer rejected the order';
  }
  if ('status' in payload) {
    const status = (payload as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400) {
      return `Builder relayer responded with status ${status}`;
    }
  }
  return null;
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
    logger.info('orders.safe.ready', {
      userId: session.user.id,
      safe: safeAddress,
    });
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
    logger.info('orders.credentials.ready', {
      userId: session.user.id,
    });
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

  const orderSignerAddress =
    (ensured.client as { signer?: { address?: string } }).signer?.address ?? null;
  if (!orderSignerAddress) {
    logger.error('orders.signer.missing', { userId: session.user.id });
    return NextResponse.json(
      { error: 'Order signer is not configured for this user' },
      { status: 500 },
    );
  }

  let parsedPayload: SubmitPayload | null = null;

  try {
    const json = await request.json();
    parsedPayload = tradeSchema.parse(json);
    logger.info('orders.submit.payload', {
      userId: session.user.id,
      marketId: parsedPayload.marketId ?? null,
      tokenId: parsedPayload.tokenId,
      side: parsedPayload.side,
      priceCents: parsedPayload.price,
      sizeThousands: parsedPayload.size,
    });

    const priceDecimal = parsedPayload.price / 100;
    const normalizedPrice = clampPrice(priceDecimal);
    const limitPrice = Number(normalizedPrice.toFixed(3)); // clamp float noise before relayer call
    const sizeInContracts = parsedPayload.size * 1_000; // slider is expressed in "k"
    const isMarketOrder = parsedPayload.executionMode === 'aggressive';
    const deferExec = !isMarketOrder && parsedPayload.executionMode === 'passive';

    let availableSafeBalance: number | null = null;
    let clobBalance: number | null = null;
    try {
      if (safeAddress) {
        const { balance } = await getSafeBalance(safeAddress);
        availableSafeBalance = balance;
        logger.info('orders.safe.balance', {
          userId: session.user.id,
          safe: safeAddress,
          balance: balance.toFixed(4),
        });
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

    try {
      const allowance = await ensured.client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
      clobBalance = Number(allowance.balance ?? 0);
      logger.info('orders.clob.balance', {
        userId: session.user.id,
        balance: clobBalance.toFixed(4),
      });
    } catch (error) {
      logger.warn('orders.clobBalance.failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const { requiredCollateral } = estimateOrderCollateral({
      side: parsedPayload.side,
      priceDecimals: limitPrice,
      sizeThousands: parsedPayload.size,
      slippageCents: parsedPayload.slippage,
    });
    const clobBalanceValue = clobBalance ?? 0;
    const shortfall = Math.max(0, requiredCollateral - clobBalanceValue);

    if (shortfall > 0) {
      if (availableSafeBalance == null) {
        logger.warn('orders.safe.balance.missing', { userId: session.user.id });
        return NextResponse.json(
          { error: 'Unable to read Safe balance to fund trading', code: 'SAFE_BALANCE_UNKNOWN' },
          { status: 409 },
        );
      }
      if (availableSafeBalance + COLLATERAL_TOLERANCE < shortfall) {
        const formattedRequired = shortfall.toFixed(2);
        const formattedAvailable = availableSafeBalance.toFixed(2);
        logger.warn('orders.safe.insufficient', {
          userId: session.user.id,
          required: formattedRequired,
          available: formattedAvailable,
        });
        return NextResponse.json(
          {
            error: `Insufficient Safe balance. Need $${formattedRequired}, available $${formattedAvailable}.`,
            code: 'INSUFFICIENT_FUNDS',
            safeBalance: availableSafeBalance,
            required: shortfall,
          },
          { status: 402 },
        );
      }

      const safeRecord = await getUserSafe(session.user.id);
      const ownerPrivateKey = safeRecord?.owner_private_key ?? null;
      if (!ownerPrivateKey) {
        logger.error('orders.safe.ownerKey.missing', { userId: session.user.id });
        return NextResponse.json(
          {
            error: 'Safe owner key missing. Redeploy your Safe from the profile page before trading.',
            code: 'SAFE_OWNER_KEY_MISSING',
          },
          { status: 409 },
        );
      }

      const provider = new JsonRpcProvider(env.relayerRpcUrl || 'https://polygon-rpc.com', env.polymarketChainId);
      const makerWallet = new Wallet(ownerPrivateKey, provider);
      const erc20 = new Contract(env.collateralAddress, erc20Abi, makerWallet);

      const shortfallRaw = parseUnits(shortfall.toFixed(6), 6);
      const allowance = await erc20.allowance(makerWallet.address, EXCHANGE_ADDRESS);
      if (allowance.lt(shortfallRaw)) {
        try {
          const approveTx = await erc20.approve(EXCHANGE_ADDRESS, MaxUint256.toString());
          logger.info('orders.approve.submit', {
            userId: session.user.id,
            maker: makerWallet.address,
            exchange: EXCHANGE_ADDRESS,
            tx: approveTx.hash,
          });
          await approveTx.wait();
          logger.info('orders.approve.mined', {
            userId: session.user.id,
            maker: makerWallet.address,
            exchange: EXCHANGE_ADDRESS,
            tx: approveTx.hash,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const gasHint =
            /insufficient funds for gas/i.test(message) || /intrinsic gas too low/i.test(message)
              ? 'Add a small amount of MATIC to cover the one-time approval.'
              : undefined;
          logger.error('orders.approve.failed', {
            userId: session.user.id,
            maker: makerWallet.address,
            error: message,
          });
          return NextResponse.json(
            {
              error: 'Approval to CTF exchange failed.',
              code: 'APPROVAL_FAILED',
              hint: gasHint,
            },
            { status: 402 },
          );
        }
      }

      const transferTx = createTransferTransaction(env.collateralAddress, orderSignerAddress, shortfallRaw.toString());

      try {
        const result = await executeTransactionsWithSigner(
          ownerPrivateKey,
          [transferTx],
          `auto-fund clob ${shortfall.toFixed(4)}`,
        );
        logger.info('orders.autofund.success', {
          userId: session.user.id,
          safe: safeAddress,
          shortfall: shortfall.toFixed(4),
          txHash: result?.transactionHash ?? null,
        });
        const allowance = await ensured.client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        clobBalance = Number(allowance.balance ?? 0);
      } catch (error) {
        logger.error('orders.autofund.failed', {
          userId: session.user.id,
          error: error instanceof Error ? error.message : String(error),
          shortfall: shortfall.toFixed(4),
        });
        return NextResponse.json(
          { error: 'Funding from Safe failed. Retry or top up your Safe.', code: 'AUTO_FUND_FAILED' },
          { status: 502 },
        );
      }

      if (clobBalance + COLLATERAL_TOLERANCE < requiredCollateral) {
        return NextResponse.json(
          {
            error: 'Trading balance still low after funding. Please retry.',
            code: 'INSUFFICIENT_CLOB_FUNDS',
            clobBalance,
            required: requiredCollateral,
          },
          { status: 402 },
        );
      }
    }

    let result;
    if (isMarketOrder) {
      const marketAmount =
        parsedPayload.side === Side.BUY
          ? Number(requiredCollateral.toFixed(4))
          : sizeInContracts;
      logger.info('orders.market.submit', {
        userId: session.user.id,
        tokenId: parsedPayload.tokenId,
        marketAmount,
        side: parsedPayload.side,
        price: limitPrice,
        orderType: 'market',
      });
      result = await ensured.client.createAndPostMarketOrder(
        {
          tokenID: parsedPayload.tokenId,
          price: limitPrice,
          amount: marketAmount,
          side: parsedPayload.side,
        },
        undefined,
        OrderType.FOK,
        false,
      );
    } else {
      logger.info('orders.limit.submit', {
        userId: session.user.id,
        tokenId: parsedPayload.tokenId,
        sizeInContracts,
        side: parsedPayload.side,
        price: limitPrice,
        orderType: 'limit',
        deferExec,
      });
      result = await ensured.client.createAndPostOrder(
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
    }

    const orderId =
      result?.orderID ??
      result?.order?.orderID ??
      result?.id ??
      (typeof result === 'object' && result && 'order_hash' in result
        ? (result as { order_hash?: string }).order_hash
        : null);
    const successFlag =
      (typeof result === 'object' && result && 'success' in result
        ? (result as { success?: unknown }).success === true
        : undefined);

    if (!orderId && successFlag !== true) {
      logger.error('orders.submit.unknownResponse', {
        userId: session.user.id,
        execution: isMarketOrder ? 'market' : 'limit',
        response: typeof result === 'object' ? result : String(result),
      });
      return NextResponse.json(
        {
          error: 'Order submission did not return an order id',
          code: 'ORDER_SUBMIT_FAILED',
          response: result ?? null,
        },
        { status: 502 },
      );
    }

    const builderError = resolveBuilderError(result);
    if (builderError) {
      logger.error('orders.submit.builderError', {
        userId: session.user.id,
        tokenId: parsedPayload.tokenId,
        execution: isMarketOrder ? 'market' : 'limit',
        message: builderError,
        response: typeof result === 'object' ? result : String(result),
      });
      throw new Error(builderError);
    }

    logger.info('orders.submit.posted', {
      userId: session.user.id,
      orderId: orderId ?? null,
      execution: isMarketOrder ? 'market' : 'limit',
      deferExec,
      response: typeof result === 'object' ? result : String(result),
    });

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

