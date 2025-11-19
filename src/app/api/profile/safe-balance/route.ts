import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';

import { env, hasRelayer } from '@/lib/env';

const erc20Interface = new Interface(['function balanceOf(address owner) view returns (uint256)']);
const USDC_DECIMALS = 6;

export async function GET(request: NextRequest) {
  if (!hasRelayer || !env.relayerRpcUrl) {
    return NextResponse.json({ error: 'Relayer RPC not configured' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const safeAddress = searchParams.get('safe');
  if (!safeAddress) {
    return NextResponse.json({ error: 'Safe address required' }, { status: 400 });
  }

  try {
    const provider = new JsonRpcProvider(env.relayerRpcUrl, env.relayerChainId);
    const data = erc20Interface.encodeFunctionData('balanceOf', [safeAddress]);
    const raw = await provider.call({
      to: env.collateralAddress,
      data,
    });
    const [balanceBN] = erc20Interface.decodeFunctionResult('balanceOf', raw) as [BigNumber];
    const balanceFloat = Number(balanceBN.toString()) / 10 ** USDC_DECIMALS;
    return NextResponse.json({
      balance: balanceFloat,
      raw: balanceBN.toString(),
      collateralAddress: env.collateralAddress,
    });
  } catch (error) {
    console.error('[api/profile/safe-balance]', error);
    const message = error instanceof Error ? error.message : 'Unable to fetch Safe balance';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

