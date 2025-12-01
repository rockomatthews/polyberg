import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { getSafeStatus } from '@/lib/services/safeOnboardingService';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const status = await getSafeStatus(session.user.id);
  return NextResponse.json(status);
}


