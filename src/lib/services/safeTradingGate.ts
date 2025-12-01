import { env, requiresSafe } from '@/lib/env';
import { getSafeStatus, type SafeStatusPayload } from '@/lib/services/safeOnboardingService';

export class SafeNotReadyError extends Error {
  constructor(
    message: string,
    public payload: SafeStatusPayload,
  ) {
    super(message);
    this.name = 'SafeNotReadyError';
  }
}

export async function ensureUserSafeReady(userId: string) {
  if (!requiresSafe) {
    return env.safeAddress ?? null;
  }
  const status = await getSafeStatus(userId);
  if (status.state !== 'ready' || !status.safeAddress) {
    throw new SafeNotReadyError('Safe is not ready for gasless execution.', status);
  }
  return status.safeAddress;
}

export function ensureOperatorSafeReady() {
  if (!requiresSafe) {
    return { ready: true, safeAddress: env.safeAddress ?? null, reason: null as string | null };
  }
  if (env.safeAddress) {
    return { ready: true, safeAddress: env.safeAddress, reason: null as string | null };
  }
  return { ready: false, safeAddress: null, reason: 'Operator Safe address missing' };
}


