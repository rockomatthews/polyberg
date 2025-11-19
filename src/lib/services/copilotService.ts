import { getDb, hasDatabase } from '@/lib/db';

export type CopilotEntry = {
  id: string;
  user_id: string;
  prompt: string;
  response: string;
  created_at: string;
};

const TABLE = 'user_copilot_history';

async function ensureTable() {
  if (!hasDatabase) {
    return;
  }
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS user_copilot_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export async function logCopilotEntry(userId: string, prompt: string, response: string) {
  if (!hasDatabase) {
    return;
  }
  await ensureTable();
  const db = getDb();
  await db`
    INSERT INTO user_copilot_history (user_id, prompt, response)
    VALUES (${userId}, ${prompt}, ${response})
  `;
}

export async function listCopilotEntries(
  userId: string,
  limit = 5,
): Promise<CopilotEntry[]> {
  if (!hasDatabase) {
    return [];
  }
  await ensureTable();
  const db = getDb();
  const rows = await db`
    SELECT id, user_id, prompt, response, created_at
    FROM user_copilot_history
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows as CopilotEntry[];
}

