import { redisClient } from '@/lib/redis';
import { env, hasRelayer, requiresSafe } from '@/lib/env';
import { ensureRelayClient, hasRelayClient } from '@/lib/relayer/relayClient';
import { getUserSafe, upsertUserSafe, type UserSafeRecord } from '@/lib/services/userService';
import { logger } from '@/lib/logger';
import { hasDatabase } from '@/lib/db';
import { getSafeFeeRecord } from '@/lib/services/safeFeeService';

const CACHE_TTL_SECONDS = 30;
const FEE_USD = env.safeDeploymentFeeUsd ?? 5;

export type SafeStatusState =
  | 'disabled'
  | 'fee-required'
  | 'missing'
  | 'pending'
  | 'ready'
  | 'error';

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
  setupFeePaid: boolean;
  feeUsd: number;
  feeTxHash?: string | null;
  treasuryAddress?: string | null;
};

type CachePayload = SafeStatusPayload & { cachedAt: number };

function cacheKey(userId: string) {
  return `safe:status:${userId}`;
}

export class SafeFeeRequiredError extends Error {
  status = 402;
  constructor(message = 'Safe setup fee required') {
    super(message);
    this.name = 'SafeFeeRequiredError';
  }
}

export async function getSafeStatus(userId: string): Promise<SafeStatusPayload> {
  if (!hasRelayer || !hasRelayClient) {
    return {
      state: 'disabled',
      safeAddress: env.safeAddress ?? null,
      statusLabel: 'Relayer not configured',
      relayer: { configured: false, url: env.relayerUrl ?? null },
      requireSafe: requiresSafe,
      setupFeePaid: true,
      feeUsd: FEE_USD,
      treasuryAddress: env.serviceTreasuryAddress ?? null,
    };
  }

  const cached = await readCache(userId);
  if (cached) {
    return cached;
  }

  const feeRecord = await getSafeFeeRecord(userId);
  const setupFeePaid = !requiresSafe || Boolean(feeRecord?.paid);

  if (!setupFeePaid) {
    const status = buildFeeRequiredStatus(feeRecord?.tx_hash ?? null);
    await writeCache(userId, status);
    return status;
  }

  const record = await getUserSafe(userId);
  const status = record
    ? mapRecordToStatus(record, feeRecord?.tx_hash ?? null)
    : buildMissingStatus(true, feeRecord?.tx_hash ?? null);

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

  const feeRecord = await getSafeFeeRecord(userId);
  const setupFeePaid = !requiresSafe || Boolean(feeRecord?.paid);
  if (!setupFeePaid) {
    throw new SafeFeeRequiredError('Safe setup fee must be paid before deployment.');
  }

  const existing = await getUserSafe(userId);
  if (existing?.safe_address) {
    const status = mapRecordToStatus(existing, feeRecord?.tx_hash ?? null);
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
  const status = updated
    ? mapRecordToStatus(updated, feeRecord?.tx_hash ?? null)
    : buildMissingStatus(true, feeRecord?.tx_hash ?? null);
  await writeCache(userId, status);
  logger.info('safe.request.complete', { userId, safe: status.safeAddress });
  return status;
}

function buildFeeRequiredStatus(txHash: string | null): SafeStatusPayload {
  return {
    state: 'fee-required',
    safeAddress: null,
    statusLabel: `One-time $${FEE_USD.toFixed(2)} Safe fee required`,
    relayer: { configured: hasRelayer && hasRelayClient, url: env.relayerUrl ?? null },
    requireSafe: requiresSafe,
    setupFeePaid: false,
    feeUsd: FEE_USD,
    feeTxHash: txHash ?? undefined,
    treasuryAddress: env.serviceTreasuryAddress ?? null,
  };
}

function buildMissingStatus(
  feePaid: boolean,
  txHash: string | null,
): SafeStatusPayload {
  if (!requiresSafe && env.safeAddress) {
    return {
      state: 'ready',
      safeAddress: env.safeAddress,
      statusLabel: 'Using builder Safe',
      relayer: { configured: hasRelayer && hasRelayClient, url: env.relayerUrl ?? null },
      requireSafe: requiresSafe,
      setupFeePaid: true,
      feeUsd: FEE_USD,
      treasuryAddress: env.serviceTreasuryAddress ?? null,
    };
  }
  return {
    state: 'missing',
    safeAddress: null,
    statusLabel: feePaid ? 'Safe not deployed yet' : 'Safe not requested',
    relayer: { configured: hasRelayer && hasRelayClient, url: env.relayerUrl ?? null },
    requireSafe: requiresSafe,
    setupFeePaid: feePaid,
    feeUsd: FEE_USD,
    feeTxHash: txHash ?? undefined,
    treasuryAddress: env.serviceTreasuryAddress ?? null,
  };
}

function mapRecordToStatus(
  record: UserSafeRecord,
  txHash: string | null,
): SafeStatusPayload {
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
    setupFeePaid: true,
    feeUsd: FEE_USD,
    feeTxHash: txHash ?? undefined,
    treasuryAddress: env.serviceTreasuryAddress ?? null,
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


