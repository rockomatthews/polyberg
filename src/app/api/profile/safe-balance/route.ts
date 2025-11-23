import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider, StaticJsonRpcProvider } from '@ethersproject/providers';
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

const providerCache = new Map<string, JsonRpcProvider>();

function getProvider(rpcUrl: string) {
  if (!providerCache.has(rpcUrl)) {
    const chainId = env.relayerChainId ?? env.polymarketChainId;
    const network = { chainId, name: `polygon-${chainId}` };
    providerCache.set(
      rpcUrl,
      new StaticJsonRpcProvider({ url: rpcUrl, timeout: 15_000 }, network),
    );
  }
  return providerCache.get(rpcUrl)!;
}

function sanitizeRpcMessage(message: string) {
  if (env.relayerRpcUrl) {
    return message.replaceAll(env.relayerRpcUrl, '[custom RPC]');
  }
  return message;
}

function extractErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  if (!hasRelayer) {
    return NextResponse.json({ error: 'Relayer URL not configured' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const safeAddressParam = searchParams.get('safe')?.trim();
  if (!safeAddressParam) {
    return NextResponse.json({ error: 'Safe address required' }, { status: 400 });
  }

  let safeAddress: string;
  try {
    safeAddress = getAddress(safeAddressParam);
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

  const failures: Array<{ rpcUrl: string; message: string; code?: string }> = [];
  let sawCallException = false;

  for (const rpcUrl of rpcUrls) {
    try {
      const provider = getProvider(rpcUrl);
      const data = erc20Interface.encodeFunctionData('balanceOf', [safeAddress]);
      const raw = await provider.call({
        to: collateralAddress,
        data,
      });
      const [balanceBN] = erc20Interface.decodeFunctionResult('balanceOf', raw) as [BigNumber];
      const balanceFloat = Number(formatUnits(balanceBN, USDC_DECIMALS));
      return NextResponse.json({
        balance: balanceFloat,
        raw: balanceBN.toString(),
        collateralAddress,
      });
    } catch (error) {
      const sanitizedMessage =
        error instanceof Error ? sanitizeRpcMessage(error.message) : 'RPC request failed';
      const label =
        env.relayerRpcUrl && rpcUrl === env.relayerRpcUrl ? 'custom' : 'public fallback';
      const code = extractErrorCode(error);
      failures.push({ rpcUrl: label, message: sanitizedMessage, code });
      if (
        code === 'CALL_EXCEPTION' ||
        sanitizedMessage.includes('missing revert data in call exception')
      ) {
        sawCallException = true;
      }
      logger.error('safeBalance.rpc.failed', {
        rpc: label,
        message: sanitizedMessage,
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

