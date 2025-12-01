import { redisClient } from '@/lib/redis';
import { env, hasRelayer, requiresSafe } from '@/lib/env';
import { ensureRelayClient, hasRelayClient } from '@/lib/relayer/relayClient';
import { getUserSafe, upsertUserSafe, type UserSafeRecord } from '@/lib/services/userService';
import { logger } from '@/lib/logger';
import { hasDatabase } from '@/lib/db';

const CACHE_TTL_SECONDS = 30;

export type SafeStatusState = 'disabled' | 'missing' | 'pending' | 'ready' | 'error';

export type SafeStatusPayload = {
  state: SafeStatusState;
  safeAddress: string | null;
  statusLabel: string;
  deploymentTxHash?: string | null;
  metadata?: Record<string, unknown> | null;
  updatedAt?: string | null;
  relayer: {
    configured: boolean;
    url?: string | null;
  };
  requireSafe: boolean;
};

type CachePayload = SafeStatusPayload & { cachedAt: number };

function cacheKey(userId: string) {
  return `safe:status:${userId}`;
}

export async function getSafeStatus(userId: string): Promise<SafeStatusPayload> {
  if (!hasRelayer || !hasRelayClient) {
    return {
      state: 'disabled',
      safeAddress: env.safeAddress ?? null,
      statusLabel: 'Relayer not configured',
      relayer: { configured: false, url: env.relayerUrl ?? null },
      requireSafe: requiresSafe,
    };
  }

  const cached = await readCache(userId);
  if (cached) {
    return cached;
  }

  const record = await getUserSafe(userId);
  const status = record ? mapRecordToStatus(record) : buildMissingStatus();

  await writeCache(userId, status);
  return status;
}

export async function requestSafeDeployment(userId: string): Promise<SafeStatusPayload> {
  if (!hasRelayer || !hasRelayClient) {
    throw new Error('Relayer is not configured; cannot deploy Safe.');
  }
  if (!hasDatabase) {
    throw new Error('Database is required to track Safe deployments.');
  }

  const existing = await getUserSafe(userId);
  if (existing?.safe_address) {
    const status = mapRecordToStatus(existing);
    await writeCache(userId, status);
    return status;
  }

  const client = ensureRelayClient('deploy Safe');
  logger.info('safe.request.start', { userId });
  const response = await client.deploy();
  const relayerTx = await response.wait();
  if (!relayerTx?.proxyAddress) {
    logger.error('safe.request.missingAddress', {
      userId,
      state: relayerTx?.state,
      transactionID: response.transactionID,
    });
    throw new Error('Relayer did not return a Safe address');
  }

  await upsertUserSafe(userId, {
    safeAddress: relayerTx.proxyAddress,
    deploymentTxHash: relayerTx.transactionHash ?? null,
    status: relayerTx.state ?? 'deployed',
    ownershipType: 'per-user',
    metadata: {
      taskId: response.transactionID,
      relayerUrl: env.relayerUrl ?? null,
    },
  });

  const updated = await getUserSafe(userId);
  const status = updated ? mapRecordToStatus(updated) : buildMissingStatus();
  await writeCache(userId, status);
  logger.info('safe.request.complete', { userId, safe: status.safeAddress });
  return status;
}

function buildMissingStatus(): SafeStatusPayload {
  if (!requiresSafe && env.safeAddress) {
    return {
      state: 'ready',
      safeAddress: env.safeAddress,
      statusLabel: 'Using builder Safe',
      relayer: { configured: hasRelayer && hasRelayClient, url: env.relayerUrl ?? null },
      requireSafe: requiresSafe,
    };
  }
  return {
    state: 'missing',
    safeAddress: null,
    statusLabel: 'Safe not deployed yet',
    relayer: { configured: hasRelayer && hasRelayClient, url: env.relayerUrl ?? null },
    requireSafe: requiresSafe,
  };
}

function mapRecordToStatus(record: UserSafeRecord): SafeStatusPayload {
  const normalizedState = normalizeState(record.status);
  return {
    state: normalizedState,
    safeAddress: record.safe_address ?? null,
    statusLabel: record.status ?? 'unknown',
    deploymentTxHash: record.deployment_tx_hash,
    metadata: record.metadata ?? undefined,
    updatedAt: record.updated_at,
    relayer: { configured: hasRelayer && hasRelayClient, url: env.relayerUrl ?? null },
    requireSafe: requiresSafe,
  };
}

function normalizeState(status?: string | null): SafeStatusState {
  if (!status) return 'missing';
  const value = status.toLowerCase();
  if (['deployed', 'success', 'ready'].includes(value)) {
    return 'ready';
  }
  if (['pending', 'queued', 'deploying'].includes(value)) {
    return 'pending';
  }
  if (['failed', 'error', 'reverted'].includes(value)) {
    return 'error';
  }
  return 'pending';
}

async function readCache(userId: string) {
  if (!redisClient) return null;
  try {
    const cached = await redisClient.get<CachePayload>(cacheKey(userId));
    if (!cached) return null;
    const { cachedAt, ...payload } = cached;
    void cachedAt;
    return payload;
  } catch (error) {
    logger.warn('safe.cache.readFailed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function writeCache(userId: string, status: SafeStatusPayload) {
  if (!redisClient) return;
  const payload: CachePayload = { ...status, cachedAt: Date.now() };
  try {
    await redisClient.set(cacheKey(userId), payload, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    logger.warn('safe.cache.writeFailed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}


