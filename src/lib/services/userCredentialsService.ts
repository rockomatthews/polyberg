import { getDb, hasDatabase } from '@/lib/db';
import { decryptPayload, encryptPayload } from '@/lib/crypto';

export type UserCredentialPayload = {
  builderSignerUrl?: string;
  builderSignerToken?: string;
  builderApiKey?: string;
  builderApiSecret?: string;
  builderApiPassphrase?: string;
  l2Key?: string;
  l2Secret?: string;
  l2Passphrase?: string;
  relayerUrl?: string;
  relayerRpcUrl?: string;
  relayerPrivateKey?: string;
  relayerChainId?: number;
  orderSignerPrivateKey?: string;
};

export type UserCredentialStatus = {
  hasBuilderSigner: boolean;
  hasL2Creds: boolean;
  hasRelayerSigner: boolean;
};

type CredentialRow = {
  user_id: string;
  encrypted_payload: string;
  created_at: string;
  updated_at: string;
};

async function ensureCredentialsTable() {
  if (!hasDatabase) return;
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS user_credentials (
      user_id TEXT PRIMARY KEY,
      encrypted_payload TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export async function getUserCredentials(userId: string): Promise<UserCredentialPayload | null> {
  if (!hasDatabase) return null;
  await ensureCredentialsTable();
  const db = getDb();
  const rows = (await db`
    SELECT user_id, encrypted_payload, created_at, updated_at
    FROM user_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `) as CredentialRow[];
  if (!rows[0]) {
    return null;
  }
  return decryptPayload<UserCredentialPayload>(rows[0].encrypted_payload);
}

export async function upsertUserCredentials(userId: string, payload: UserCredentialPayload) {
  if (!hasDatabase) return;
  await ensureCredentialsTable();
  const db = getDb();
  const encrypted = encryptPayload(payload);
  await db`
    INSERT INTO user_credentials (user_id, encrypted_payload)
    VALUES (${userId}, ${encrypted})
    ON CONFLICT (user_id)
    DO UPDATE
    SET encrypted_payload = EXCLUDED.encrypted_payload,
        updated_at = now()
  `;
}

export async function deleteUserCredentials(userId: string) {
  if (!hasDatabase) return;
  await ensureCredentialsTable();
  const db = getDb();
  await db`
    DELETE FROM user_credentials
    WHERE user_id = ${userId}
  `;
}

export function computeCredentialStatus(payload: UserCredentialPayload | null): UserCredentialStatus {
  return {
    hasBuilderSigner: Boolean(
      payload?.builderSignerUrl &&
        (payload.builderSignerToken ||
          (payload.builderApiKey && payload.builderApiSecret && payload.builderApiPassphrase)),
    ),
    hasL2Creds: Boolean(payload?.l2Key && payload.l2Secret && payload.l2Passphrase),
    hasRelayerSigner: Boolean(payload?.relayerPrivateKey && payload.relayerRpcUrl),
  };
}

export async function getUserCredentialStatus(
  userId: string,
): Promise<{ status: UserCredentialStatus; updatedAt?: string }> {
  if (!hasDatabase) {
    return { status: { hasBuilderSigner: false, hasL2Creds: false, hasRelayerSigner: false } };
  }
  await ensureCredentialsTable();
  const db = getDb();
  const rows = (await db`
    SELECT encrypted_payload, updated_at
    FROM user_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `) as Array<{ encrypted_payload: string; updated_at: string }>;
  if (!rows[0]) {
    return {
      status: { hasBuilderSigner: false, hasL2Creds: false, hasRelayerSigner: false },
    };
  }
  const payload = decryptPayload<UserCredentialPayload>(rows[0].encrypted_payload);
  return {
    status: computeCredentialStatus(payload),
    updatedAt: rows[0].updated_at,
  };
}


