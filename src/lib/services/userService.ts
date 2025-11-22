import type { Session } from 'next-auth';

import { getDb, hasDatabase } from '@/lib/db';

export type UserRecord = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSafeRecord = {
  user_id: string;
  safe_address: string;
  deployment_tx_hash: string | null;
  status: string;
  ownership_type: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export async function ensureUserRecord(session: Session | null) {
  if (!session?.user?.id || !hasDatabase) {
    return;
  }

  const db = getDb();

  await db`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await db`
    INSERT INTO users (id, email, name)
    VALUES (${session.user.id}, ${session.user.email ?? null}, ${session.user.name ?? null})
    ON CONFLICT (id)
    DO UPDATE
    SET email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = now()
  `;
}

export async function getUserRecord(userId: string): Promise<UserRecord | null> {
  if (!hasDatabase) {
    return null;
  }
  const db = getDb();
  const rows = (await db`
    SELECT id, email, name, created_at, updated_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `) as UserRecord[];
  return rows[0] ?? null;
}

async function ensureUserSafeTable() {
  if (!hasDatabase) {
    return;
  }
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS user_safes (
      user_id TEXT PRIMARY KEY,
      safe_address TEXT NOT NULL,
      deployment_tx_hash TEXT,
      status TEXT DEFAULT 'unknown',
      ownership_type TEXT DEFAULT 'per-user',
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await db`ALTER TABLE user_safes ADD COLUMN IF NOT EXISTS deployment_tx_hash TEXT`;
  await db`ALTER TABLE user_safes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unknown'`;
  await db`ALTER TABLE user_safes ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'per-user'`;
  await db`ALTER TABLE user_safes ADD COLUMN IF NOT EXISTS notes TEXT`;
  await db`ALTER TABLE user_safes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`;
}

export async function getUserSafe(userId: string): Promise<UserSafeRecord | null> {
  if (!hasDatabase) {
    return null;
  }
  await ensureUserSafeTable();
  const db = getDb();
  const rows = (await db`
    SELECT user_id,
           safe_address,
           deployment_tx_hash,
           status,
           ownership_type,
           notes,
           metadata,
           created_at,
           updated_at
    FROM user_safes
    WHERE user_id = ${userId}
    LIMIT 1
  `) as UserSafeRecord[];
  return rows[0] ?? null;
}

export type UpsertUserSafeInput = {
  safeAddress: string;
  deploymentTxHash?: string | null;
  status?: string | null;
  ownershipType?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function upsertUserSafe(userId: string, input: UpsertUserSafeInput) {
  if (!hasDatabase) {
    return;
  }
  await ensureUserSafeTable();
  const db = getDb();
  await db`
    INSERT INTO user_safes (
      user_id,
      safe_address,
      deployment_tx_hash,
      status,
      ownership_type,
      notes,
      metadata
    )
    VALUES (
      ${userId},
      ${input.safeAddress},
      ${input.deploymentTxHash ?? null},
      ${input.status ?? 'unknown'},
      ${input.ownershipType ?? 'per-user'},
      ${input.notes ?? null},
      ${input.metadata ?? null}
    )
    ON CONFLICT (user_id)
    DO UPDATE
    SET safe_address = EXCLUDED.safe_address,
        deployment_tx_hash = COALESCE(EXCLUDED.deployment_tx_hash, user_safes.deployment_tx_hash),
        status = COALESCE(EXCLUDED.status, user_safes.status),
        ownership_type = COALESCE(EXCLUDED.ownership_type, user_safes.ownership_type),
        notes = COALESCE(EXCLUDED.notes, user_safes.notes),
        metadata = COALESCE(EXCLUDED.metadata, user_safes.metadata),
        updated_at = now()
  `;
}

export async function listUserSafes(userId: string): Promise<UserSafeRecord[]> {
  if (!hasDatabase) {
    return [];
  }
  await ensureUserSafeTable();
  const db = getDb();
  const rows = (await db`
    SELECT user_id,
           safe_address,
           deployment_tx_hash,
           status,
           ownership_type,
           notes,
           metadata,
           created_at,
           updated_at
    FROM user_safes
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `) as UserSafeRecord[];
  return rows;
}

