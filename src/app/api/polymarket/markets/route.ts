import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { loadMarketSnapshots } from '@/lib/polymarket/marketService';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = params.get('limit');
    const query = params.get('q') ?? undefined;
    const mode = query ? 'search' : 'featured';
    const markets = await loadMarketSnapshots({
      limit: limit ? Number(limit) : undefined,
      query,
      mode,
    });
    return NextResponse.json({ markets });
  } catch (error) {
    logger.error('markets.fetch.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to load Polymarket markets' },
      { status: 500 },
    );
  }
}

