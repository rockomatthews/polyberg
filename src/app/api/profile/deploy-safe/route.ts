import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { hasRelayClient } from '@/lib/relayer/relayClient';
import { logger } from '@/lib/logger';
import { requestSafeDeployment } from '@/lib/services/safeOnboardingService';

export async function POST() {
  if (!hasRelayClient) {
    return NextResponse.json(
      { error: 'Relayer is not configured. Cannot deploy Safe.' },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const status = await requestSafeDeployment(session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deploy Safe';
    logger.error('safe.deploy.failed', {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

