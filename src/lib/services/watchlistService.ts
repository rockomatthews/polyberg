import { getDb, hasDatabase } from '@/lib/db';

async function ensureTable() {
  if (!hasDatabase) {
    return;
  }
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS user_watchlist (
      user_id TEXT NOT NULL,
      condition_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, condition_id)
    )
  `;
}

export async function getWatchlist(userId: string): Promise<string[]> {
  if (!hasDatabase) {
    return [];
  }
  await ensureTable();
  const db = getDb();
  const rows = (await db`
    SELECT condition_id
    FROM user_watchlist
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `) as { condition_id: string }[];
  return rows.map((row) => row.condition_id);
}

export async function addToWatchlist(userId: string, conditionId: string) {
  if (!hasDatabase) {
    return;
  }
  await ensureTable();
  const db = getDb();
  await db`
    INSERT INTO user_watchlist (user_id, condition_id)
    VALUES (${userId}, ${conditionId})
    ON CONFLICT (user_id, condition_id) DO NOTHING
  `;
}

export async function removeFromWatchlist(userId: string, conditionId: string) {
  if (!hasDatabase) {
    return;
  }
  await ensureTable();
  const db = getDb();
  await db`
    DELETE FROM user_watchlist
    WHERE user_id = ${userId} AND condition_id = ${conditionId}
  `;
}

