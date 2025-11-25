import { AssetType, type ClobClient } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { env, hasBuilderSigning, hasL2Auth, hasOrderSigner } from '@/lib/env';
import { ensureTradingClient } from '@/lib/polymarket/tradingClient';
import { logger } from '@/lib/logger';

type ProbeResult<T = unknown> =
  | { ok: true; details: T }
  | { ok: false; error: string };

function summarizeEnv() {
  let orderSignerAddress: string | null = null;
  if (env.orderSignerPrivateKey) {
    try {
      orderSignerAddress = new Wallet(env.orderSignerPrivateKey).address;
    } catch {
      orderSignerAddress = 'Invalid private key';
    }
  }

  return {
    hasBuilderSigning,
    hasL2Auth,
    hasOrderSigner,
    orderSignerAddress,
    builderSignerHost: env.builderSigner
      ? new URL(env.builderSigner.url).host
      : env.builderLocalCreds
        ? 'local-keys'
        : null,
  };
}

async function probeBalance(client: ClobClient): Promise<ProbeResult> {
  try {
    const result = await client.getBalanceAllowance({
      asset_type: AssetType.COLLATERAL,
    });
    return {
      ok: true,
      details: {
        balance: result.balance,
        allowance: result.allowance,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

async function probeOrders(client: ClobClient): Promise<ProbeResult> {
  try {
    const orders = await client.getOpenOrders(undefined, true);
    return { ok: true, details: { count: orders.length } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const envSummary = summarizeEnv();
  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json(
      {
        env: envSummary,
        error: ensured.error,
        status: ensured.status,
      },
      { status: ensured.status },
    );
  }

  const [balanceProbe, ordersProbe] = await Promise.all([
    probeBalance(ensured.client),
    probeOrders(ensured.client),
  ]);

  if (!balanceProbe.ok || !ordersProbe.ok) {
    logger.error('diagnostics.l2.failed', {
      balanceError: !balanceProbe.ok ? balanceProbe.error : undefined,
      ordersError: !ordersProbe.ok ? ordersProbe.error : undefined,
    });
  }

  return NextResponse.json({
    env: envSummary,
    probes: {
      balance: balanceProbe,
      orders: ordersProbe,
    },
  });
}


