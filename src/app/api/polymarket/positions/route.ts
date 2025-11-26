import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { ensureTradingClient } from '@/lib/polymarket/tradingClient';
import { logger } from '@/lib/logger';
import { fetchAggregatedPositions } from '@/lib/polymarket/positionsService';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { positions: [], meta: { error: 'Not authenticated' } },
      { status: 401 },
    );
  }

  const ensured = await ensureTradingClient(session.user.id);
  if (!('client' in ensured)) {
    return NextResponse.json(
      {
        positions: [],
        meta: {
          error: ensured.error,
          requiresBuilderSigning: ensured.status === 400,
        },
      },
      { status: ensured.status },
    );
  }

  try {
    const aggregated = await fetchAggregatedPositions(ensured.client);
    const positions = aggregated.map((position) => ({
      market: position.assetId,
      exposure: position.exposure,
      pnl: position.pnl,
      delta: position.delta,
    }));

    return NextResponse.json({ positions });
  } catch (error) {
    logger.error('positions.fetch.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const errorMessage =
      error instanceof Error ? error.message : 'Unable to load builder trades';
    return NextResponse.json(
      {
        positions: [],
        meta: {
          error: errorMessage,
          requiresBuilderSigning: true,
        },
      },
      { status: 200 },
    );
  }
}
