import { redisClient } from '@/lib/redis';
import { env, hasRelayer, requiresSafe } from '@/lib/env';
import {
  ensureRelayClient,
  hasRelayClient,
  deriveOperatorSafeAddress,
} from '@/lib/relayer/relayClient';
import { getUserSafe, upsertUserSafe, type UserSafeRecord } from '@/lib/services/userService';
import { logger } from '@/lib/logger';
import { hasDatabase } from '@/lib/db';

const CACHE_TTL_SECONDS = 30;
const SAFE_REGISTRY_KEY = 'safe:records';

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

  const record = await readSafeRecord(userId);
  const status = record ? mapRecordToStatus(record) : buildMissingStatus();

  await writeCache(userId, status);
  return status;
}

export async function requestSafeDeployment(userId: string): Promise<SafeStatusPayload> {
  if (!hasRelayer || !hasRelayClient) {
    throw new Error('Relayer is not configured; cannot deploy Safe.');
  }

  const existing = await readSafeRecord(userId);
  if (existing?.safe_address) {
    const status = mapRecordToStatus(existing);
    await writeCache(userId, status);
    return status;
  }

  const client = ensureRelayClient('deploy Safe');
  logger.info('safe.request.start', { userId });
  let relayerTx;
  let transactionID: string | null = null;
  try {
    const deployResponse = await client.deploy();
    transactionID = deployResponse.transactionID;
    relayerTx = await deployResponse.wait();
  } catch (error) {
    const recovered = await recoverExistingSafe(userId, error);
    if (recovered) {
      await writeCache(userId, recovered);
      return recovered;
    }
    throw error;
  }
  if (!relayerTx?.proxyAddress) {
    logger.error('safe.request.missingAddress', {
      userId,
      state: relayerTx?.state,
      transactionID,
    });
    throw new Error('Relayer did not return a Safe address');
  }

  const updated = await storeSafeRecord(userId, {
    safeAddress: relayerTx.proxyAddress,
    deploymentTxHash: relayerTx.transactionHash ?? null,
    status: relayerTx.state ?? 'deployed',
    ownershipType: 'per-user',
    metadata: {
      taskId: transactionID,
      relayerUrl: env.relayerUrl ?? null,
    },
  });
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

async function readSafeRecord(userId: string) {
  if (hasDatabase) {
    return getUserSafe(userId);
  }
  if (redisClient) {
    try {
      const raw = await redisClient.hget<string>(SAFE_REGISTRY_KEY, userId);
      if (raw) {
        return JSON.parse(raw) as UserSafeRecord;
      }
    } catch (error) {
      logger.warn('safe.registry.readFailed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return null;
}

async function storeSafeRecord(
  userId: string,
  input: Parameters<typeof upsertUserSafe>[1],
): Promise<UserSafeRecord | null> {
  if (hasDatabase) {
    await upsertUserSafe(userId, input);
    return getUserSafe(userId);
  }
  if (!input.safeAddress) {
    return null;
  }
  const record: UserSafeRecord = {
    user_id: userId,
    safe_address: input.safeAddress,
    deployment_tx_hash: input.deploymentTxHash ?? null,
    status: input.status ?? 'deployed',
    ownership_type: input.ownershipType ?? 'per-user',
    notes: input.notes ?? null,
    metadata: input.metadata ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (redisClient) {
    try {
      await redisClient.hset(SAFE_REGISTRY_KEY, { [userId]: JSON.stringify(record) });
    } catch (error) {
      logger.warn('safe.registry.writeFailed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return record;
}

async function recoverExistingSafe(userId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message || !/safe already deployed/i.test(message)) {
    return null;
  }
  const fallbackAddress = deriveOperatorSafeAddress();
  if (!fallbackAddress) {
    return null;
  }
  logger.warn('safe.request.alreadyDeployed', {
    userId,
    safe: fallbackAddress,
  });
  const existing = await storeSafeRecord(userId, {
    safeAddress: fallbackAddress,
    status: 'ready',
    ownershipType: 'builder',
    metadata: {
      source: 'relayer-existing',
      relayerUrl: env.relayerUrl ?? null,
    },
  });
  return existing ? mapRecordToStatus(existing) : buildMissingStatus();
}


