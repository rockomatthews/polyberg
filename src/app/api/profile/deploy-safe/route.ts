import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { ensureRelayClient, hasRelayClient } from '@/lib/relayer/relayClient';
import { upsertUserSafe } from '@/lib/services/userService';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

type RelayerError = {
  response?: {
    status?: number;
    data?: unknown;
  };
};

function extractRelayerMeta(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as RelayerError).response;
    return {
      relayerStatus: response?.status ?? null,
      relayerResponse: response?.data ?? null,
    };
  }
  return null;
}

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
    const relayerTransaction = await response.wait();
    if (!relayerTransaction) {
      const transactions = await response.getTransaction().catch(() => null);
      logger.error('safe.deploy.failed', {
        error: 'Relayer transaction failed',
        transactionId: response.transactionID,
        relayerState: response.state,
        relayerResponse: transactions,
      });
      throw new Error(
        `Relayer did not confirm Safe deployment (transaction ${response.transactionID}).`,
      );
    }

    const safeAddress = relayerTransaction.proxyAddress;
    if (!safeAddress) {
      throw new Error('Relayer did not return a Safe address');
    }
    const taskId =
      typeof relayerTransaction === 'object' && 'transactionID' in relayerTransaction
        ? relayerTransaction.transactionID
        : null;

    await upsertUserSafe(session.user.id, {
      safeAddress,
      deploymentTxHash: relayerTransaction.transactionHash ?? null,
      status: relayerTransaction.state ?? 'deployed',
      ownershipType: 'per-user',
      metadata: {
        taskId,
        relayerUrl: env.relayerUrl ?? null,
      },
    });
    return NextResponse.json({
      safeAddress,
      transactionHash: relayerTransaction.transactionHash ?? null,
      status: relayerTransaction.state ?? 'deployed',
      relayerTransactionId: response.transactionID,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deploy Safe';
    const relayerMeta = extractRelayerMeta(error);
    logger.error('safe.deploy.failed', {
      error: message,
      relayerMeta,
    });
    return NextResponse.json({ error: message, meta: relayerMeta }, { status: 500 });
  }
}

