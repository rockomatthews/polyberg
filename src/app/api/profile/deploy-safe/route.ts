import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { ensureRelayClient, hasRelayClient } from '@/lib/relayer/relayClient';
import { upsertUserSafe } from '@/lib/services/userService';

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
    const client = ensureRelayClient('deploy user Safe');
    const response = await client.deploy();
    const result = await response.wait();
    const safeAddress = result?.proxyAddress ?? result?.proxyAddress?.toString();
    if (!safeAddress) {
      throw new Error('Relayer did not return a Safe address');
    }
    await upsertUserSafe(session.user.id, safeAddress);
    return NextResponse.json({
      safeAddress,
      transactionHash: result?.transactionHash ?? null,
    });
  } catch (error) {
    console.error('[api/profile/deploy-safe]', error);
    const message = error instanceof Error ? error.message : 'Failed to deploy Safe';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

