import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { AssetType } from '@polymarket/clob-client';

import { authOptions } from '@/lib/auth';
import { ensureTradingClient } from '@/lib/polymarket/tradingClient';
import {
  ensureUserTradingCredentials,
  TradingCredentialsError,
} from '@/lib/services/tradingCredentialsService';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    await ensureUserTradingCredentials(session.user.id);
  } catch (error) {
    if (error instanceof TradingCredentialsError) {
      return NextResponse.json(
        { error: error.message, requiresBuilderSigning: true },
        { status: 409 },
      );
    }
    throw error;
  }

  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json(
      { error: ensured.error, status: ensured.status, requiresBuilderSigning: ensured.status === 400 },
      { status: ensured.status },
    );
  }

  try {
    const allowance = await ensured.client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
    const balance = Number(allowance.balance ?? 0);
    const allowanceValue = Number(allowance.allowance ?? 0);
    return NextResponse.json({
      clob: {
        balance,
        allowance: allowanceValue,
        rawBalance: allowance.balance,
        rawAllowance: allowance.allowance,
      },
    });
  } catch (error) {
    logger.error('balances.clob.failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: 'Unable to load builder collateral balance' },
      { status: 502 },
    );
  }
}
