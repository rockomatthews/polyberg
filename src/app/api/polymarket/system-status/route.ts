import { performance } from 'perf_hooks';
import { AssetType } from '@polymarket/clob-client';
import { NextResponse } from 'next/server';

import { clobClient } from '@/lib/polymarket/clobClient';
import { env, hasL2Auth, hasRelayer } from '@/lib/env';
import { logger } from '@/lib/logger';

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
        logger.warn('systemStatus.balance.failed', {
          error: balanceError instanceof Error ? balanceError.message : String(balanceError),
        });
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
        logger.warn('systemStatus.relayer.failed', {
          error: relayerError instanceof Error ? relayerError.message : String(relayerError),
        });
      }
    }

    return NextResponse.json({
      latencyMs,
      walletLabel: env.safeAddress ? 'Safe Wallet' : 'Builder Wallet',
      walletBalance,
      relayerConnected,
    });
  } catch (error) {
    logger.error('systemStatus.fetch.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
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

