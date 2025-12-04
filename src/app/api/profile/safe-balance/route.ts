import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { getAddress } from '@ethersproject/address';
import { formatUnits } from '@ethersproject/units';

import { env, hasRelayer } from '@/lib/env';
import { logger } from '@/lib/logger';

const erc20Interface = new Interface(['function balanceOf(address owner) view returns (uint256)']);
const USDC_DECIMALS = 6;
const DEFAULT_POLYGON_RPCS = [
  'https://polygon-rpc.com',
  'https://rpc.ankr.com/polygon',
  'https://polygon.llamarpc.com',
];

function sanitizeRpcMessage(message: string) {
  if (env.relayerRpcUrl) {
    return message.replaceAll(env.relayerRpcUrl, '[custom RPC]');
  }
  return message;
}

type RpcFailure = { rpcUrl: string; message: string; code?: string | number };

async function fetchBalanceOf(rpcUrl: string, safeAddress: string, collateralAddress: string) {
  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'eth_call' as const,
    params: [
      {
        to: collateralAddress,
        data: erc20Interface.encodeFunctionData('balanceOf', [safeAddress]),
      },
      'latest',
    ],
  };

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RPC ${response.status} ${response.statusText}: ${text}`.trim());
  }

  const json = (await response.json()) as
    | { result: string }
    | { error: { code?: string | number; message?: string } };

  if ('error' in json) {
    const { code, message } = json.error ?? {};
    const err = new Error(message ?? 'RPC error');
    (err as { code?: string | number }).code = code;
    throw err;
  }

  if (!('result' in json) || typeof json.result !== 'string') {
    throw new Error('RPC result missing');
  }

  const balanceBN = BigNumber.from(json.result);
  const balanceFloat = Number(formatUnits(balanceBN, USDC_DECIMALS));
  return { balanceBN, balanceFloat };
}

export async function handleSafeBalance(request: NextRequest, safeOverride?: string) {
  if (!hasRelayer) {
    return NextResponse.json({ error: 'Relayer URL not configured' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const safeAddressParam = safeOverride?.trim() ?? searchParams.get('safe')?.trim();
  if (!safeAddressParam) {
    return NextResponse.json({ error: 'Safe address required' }, { status: 400 });
  }

  let safeAddress: string;
  try {
    safeAddress = getAddress(safeAddressParam.toLowerCase());
  } catch {
    return NextResponse.json({ error: 'Invalid Safe address' }, { status: 400 });
  }

  let collateralAddress: string;
  try {
    collateralAddress = getAddress(env.collateralAddress);
  } catch {
    return NextResponse.json(
      { error: 'Invalid collateral address configured server-side' },
      { status: 500 },
    );
  }

  const rpcUrls = Array.from(
    new Set(
      [env.relayerRpcUrl, ...DEFAULT_POLYGON_RPCS].filter(
        (url): url is string => Boolean(url && url.length > 0),
      ),
    ),
  );

  const failures: Array<RpcFailure> = [];
  let sawCallException = false;

  for (const rpcUrl of rpcUrls) {
    try {
      const { balanceBN, balanceFloat } = await fetchBalanceOf(rpcUrl, safeAddress, collateralAddress);
      return NextResponse.json({
        balance: balanceFloat,
        raw: balanceBN.toString(),
        collateralAddress,
      });
    } catch (error) {
      const message =
        error instanceof Error ? sanitizeRpcMessage(error.message) : 'RPC request failed';
      const label =
        env.relayerRpcUrl && rpcUrl === env.relayerRpcUrl ? 'custom' : 'public fallback';
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: string | number }).code
          : undefined;
      failures.push({ rpcUrl: label, message, code });
      const lowerMessage = message.toLowerCase();
      if (
        code === 'CALL_EXCEPTION' ||
        lowerMessage.includes('call exception') ||
        lowerMessage.includes('revert')
      ) {
        sawCallException = true;
      }
      logger.error('safeBalance.rpc.failed', {
        rpc: label,
        message,
        code,
      });
    }
  }

  if (sawCallException) {
    return NextResponse.json({
      balance: 0,
      raw: '0',
      collateralAddress,
      meta: {
        failures,
        degraded: 'call_exception',
        message:
          'Polygon RPC returned CALL_EXCEPTION repeatedly; falling back to zero until a reliable RPC is configured.',
      },
    });
  }

  return NextResponse.json(
    {
      error:
        'Safe balance lookup failed across all configured Polygon RPC endpoints. Verify POLYMARKET_RELAYER_RPC_URL or allow outbound access to public Polygon RPC.',
      meta: { failures },
    },
    { status: 502 },
  );
}

export async function GET(request: NextRequest) {
  return handleSafeBalance(request);
}

