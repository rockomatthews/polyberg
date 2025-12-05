import { Wallet } from '@ethersproject/wallet';
import { ClobClient } from '@polymarket/clob-client';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { hasDatabase } from '@/lib/db';
import {
  getUserCredentials,
  upsertUserCredentials,
  type UserCredentialPayload,
} from '@/lib/services/userCredentialsService';
import { getUserSafe } from '@/lib/services/userService';

export class TradingCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TradingCredentialsError';
  }
}

type CompleteCreds = Required<
  Pick<UserCredentialPayload, 'orderSignerPrivateKey' | 'l2Key' | 'l2Secret' | 'l2Passphrase'>
>;

function hasCompleteCreds(payload: UserCredentialPayload | null): payload is CompleteCreds {
  return Boolean(
    payload?.orderSignerPrivateKey &&
      payload.l2Key &&
      payload.l2Secret &&
      payload.l2Passphrase,
  );
}

export async function ensureUserTradingCredentials(
  userId: string,
): Promise<UserCredentialPayload | null> {
  if (!hasDatabase) {
    // Without persistence we cannot safely mint per-user API credentials; fall back to env.
    return null;
  }

  const existing = await getUserCredentials(userId);
  if (hasCompleteCreds(existing)) {
    return existing;
  }

  const safeRecord = await getUserSafe(userId);
  if (!safeRecord?.owner_private_key) {
    throw new TradingCredentialsError(
      'Safe owner key missing. Redeploy your Safe from the profile page before trading.',
    );
  }

  const signer = new Wallet(safeRecord.owner_private_key);
  const provisionClient = new ClobClient(env.polymarketApiHost, env.polymarketChainId, signer);

  logger.info('trading.credentials.provision.start', {
    userId,
    safe: safeRecord.safe_address,
  });

  const apiCreds = await provisionClient.createOrDeriveApiKey();

  const payload: UserCredentialPayload = {
    orderSignerPrivateKey: safeRecord.owner_private_key,
    l2Key: apiCreds.key,
    l2Secret: apiCreds.secret,
    l2Passphrase: apiCreds.passphrase,
  };

  await upsertUserCredentials(userId, payload);

  logger.info('trading.credentials.provision.complete', {
    userId,
    safe: safeRecord.safe_address,
  });

  return payload;
}


