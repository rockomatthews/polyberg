import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { loadSportsEventGroups } from '@/lib/polymarket/sportsService';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limitParam = params.get('limit');
    const events = await loadSportsEventGroups({
      limit: limitParam ? Number(limitParam) : undefined,
      now: Date.now(),
    });
    return NextResponse.json({ events });
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

