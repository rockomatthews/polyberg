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
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export async function getUserSafe(userId: string): Promise<UserSafeRecord | null> {
  if (!hasDatabase) {
    return null;
  }
  await ensureUserSafeTable();
  const db = getDb();
  const rows = (await db`
    SELECT user_id, safe_address, created_at, updated_at
    FROM user_safes
    WHERE user_id = ${userId}
    LIMIT 1
  `) as UserSafeRecord[];
  return rows[0] ?? null;
}

export async function upsertUserSafe(userId: string, safeAddress: string) {
  if (!hasDatabase) {
    return;
  }
  await ensureUserSafeTable();
  const db = getDb();
  await db`
    INSERT INTO user_safes (user_id, safe_address)
    VALUES (${userId}, ${safeAddress})
    ON CONFLICT (user_id)
    DO UPDATE
    SET safe_address = EXCLUDED.safe_address,
        updated_at = now()
  `;
}

