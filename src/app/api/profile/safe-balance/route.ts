import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider, StaticJsonRpcProvider } from '@ethersproject/providers';
import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { getAddress } from '@ethersproject/address';
import { formatUnits } from '@ethersproject/units';

import { env, hasRelayer } from '@/lib/env';

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

  const failures: Array<{ rpcUrl: string; message: string }> = [];

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
      failures.push({ rpcUrl: label, message: sanitizedMessage });
      console.error('[api/profile/safe-balance] rpc failed', {
        rpcUrl: label,
        message: sanitizedMessage,
      });
    }
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

