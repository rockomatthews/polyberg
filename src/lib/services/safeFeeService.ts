import { getDb, hasDatabase } from '@/lib/db';

export type SafeFeeRecord = {
  user_id: string;
  paid: boolean;
  tx_hash: string | null;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
};

async function ensureSafeFeeTable() {
  if (!hasDatabase) {
    return;
  }
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS user_safe_fees (
      user_id TEXT PRIMARY KEY,
      paid BOOLEAN DEFAULT false,
      tx_hash TEXT,
      paid_at TIMESTAMPTZ DEFAULT now(),
      metadata JSONB DEFAULT '{}'::jsonb
    )
  `;
  await db`ALTER TABLE user_safe_fees ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false`;
  await db`ALTER TABLE user_safe_fees ADD COLUMN IF NOT EXISTS tx_hash TEXT`;
  await db`ALTER TABLE user_safe_fees ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT now()`;
  await db`ALTER TABLE user_safe_fees ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`;
}

export async function getSafeFeeRecord(userId: string): Promise<SafeFeeRecord | null> {
  if (!hasDatabase) {
    return null;
  }
  await ensureSafeFeeTable();
  const db = getDb();
  const rows = (await db`
    SELECT user_id, paid, tx_hash, paid_at, metadata
    FROM user_safe_fees
    WHERE user_id = ${userId}
    LIMIT 1
  `) as SafeFeeRecord[];
  return rows[0] ?? null;
}

export async function markSafeFeePaid(userId: string, txHash?: string | null) {
  if (!hasDatabase) {
    throw new Error('Database is required to record Safe fees.');
  }
  await ensureSafeFeeTable();
  const db = getDb();
  await db`
    INSERT INTO user_safe_fees (user_id, paid, tx_hash, paid_at)
    VALUES (${userId}, true, ${txHash ?? null}, now())
    ON CONFLICT (user_id)
    DO UPDATE
    SET paid = true,
        tx_hash = COALESCE(EXCLUDED.tx_hash, user_safe_fees.tx_hash),
        paid_at = now()
  `;
}


