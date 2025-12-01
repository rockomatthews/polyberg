import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { markSafeFeePaid } from '@/lib/services/safeFeeService';
import { getSafeStatus } from '@/lib/services/safeOnboardingService';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const txHash =
    typeof body?.txHash === 'string' && body.txHash.trim().length ? body.txHash.trim() : null;

  try {
    await markSafeFeePaid(session.user.id, txHash);
    const status = await getSafeStatus(session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to confirm fee';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


