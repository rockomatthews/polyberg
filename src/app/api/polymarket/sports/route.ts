import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { loadSportsMarkets } from '@/lib/polymarket/marketService';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limitParam = params.get('limit');
    const markets = await loadSportsMarkets({
      limit: limitParam ? Number(limitParam) : undefined,
    });
    return NextResponse.json({ markets });
  } catch (error) {
    logger.error('sports.markets.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to load sports markets' },
      { status: 500 },
    );
  }
}

