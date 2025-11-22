import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getAddress } from '@ethersproject/address';

import { authOptions } from '@/lib/auth';
import { listUserSafes, upsertUserSafe } from '@/lib/services/userService';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const safes = await listUserSafes(session.user.id);
  logger.info('userSafes.list', { userId: session.user.id, count: safes.length });
  return NextResponse.json({ safes });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.safeAddress) {
    return NextResponse.json({ error: 'safeAddress is required' }, { status: 400 });
  }

  let safeAddress: string;
  try {
    safeAddress = getAddress(body.safeAddress);
  } catch {
    return NextResponse.json({ error: 'Invalid safe address' }, { status: 400 });
  }

  await upsertUserSafe(session.user.id, {
    safeAddress,
    deploymentTxHash: body.deploymentTxHash ?? null,
    status: body.status ?? 'registered',
    ownershipType: body.ownershipType ?? 'per-user',
    notes: body.notes ?? null,
    metadata: body.metadata ?? null,
  });

  const safes = await listUserSafes(session.user.id);
  logger.info('userSafes.upserted', {
    userId: session.user.id,
    safeAddress,
    status: body.status ?? 'registered',
  });
  return NextResponse.json({ safes });
}

