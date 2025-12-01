import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { requestSafeDeployment } from '@/lib/services/safeOnboardingService';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const status = await requestSafeDeployment(session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to request Safe';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


