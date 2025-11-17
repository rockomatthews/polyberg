import { performance } from 'perf_hooks';
import { AssetType } from '@polymarket/clob-client';
import { NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';
import { env, hasL2Auth, hasRelayer } from '@/lib/env';

export async function GET() {
  try {
    const start = performance.now();
    await clobClient.getServerTime();
    const latencyMs = Math.round(performance.now() - start);

    let walletBalance: number | null = null;
    if (hasL2Auth) {
      try {
        const balance = await clobClient.getBalanceAllowance({
          asset_type: AssetType.COLLATERAL,
        });
        walletBalance = Number(balance.balance);
      } catch (balanceError) {
        console.warn('[api/polymarket/system-status] Balance lookup failed', balanceError);
      }
    }

    let relayerConnected = false;
    if (hasRelayer && env.relayerUrl) {
      try {
        const response = await fetch(`${env.relayerUrl.replace(/\/$/, '')}/health`, {
          method: 'GET',
          cache: 'no-store',
        });
        relayerConnected = response.ok;
      } catch (relayerError) {
        console.warn('[api/polymarket/system-status] Relayer health check failed', relayerError);
      }
    }

    return NextResponse.json({
      latencyMs,
      walletLabel: env.safeAddress ? 'Safe Wallet' : 'Builder Wallet',
      walletBalance,
      relayerConnected,
    });
  } catch (error) {
    console.error('[api/polymarket/system-status] Unexpected failure', error);
    return NextResponse.json(
      {
        latencyMs: null,
        walletLabel: 'Builder Wallet',
        walletBalance: null,
        relayerConnected: false,
        error: 'Unable to fetch Polymarket status',
      },
      { status: 500 },
    );
  }
}

