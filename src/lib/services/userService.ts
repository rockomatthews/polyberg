import type { Session } from 'next-auth';

import { getDb, hasDatabase } from '@/lib/db';

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

