import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from '@/lib/services/watchlistService';
import { logger } from '@/lib/logger';

const payloadSchema = z.object({
  conditionId: z.string().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ watchlist: [] }, { status: 200 });
  }
  const watchlist = await getWatchlist(session.user.id);
  logger.info('watchlist.fetch', { userId: session.user.id, count: watchlist.length });
  return NextResponse.json({ watchlist });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  try {
    const json = await request.json();
    const { conditionId } = payloadSchema.parse(json);
    await addToWatchlist(session.user.id, conditionId);
    logger.info('watchlist.added', { userId: session.user.id, conditionId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.flatten() : 'Unable to save watchlist';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  try {
    const json = await request.json();
    const { conditionId } = payloadSchema.parse(json);
    await removeFromWatchlist(session.user.id, conditionId);
    logger.info('watchlist.removed', { userId: session.user.id, conditionId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.flatten() : 'Unable to update watchlist';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

