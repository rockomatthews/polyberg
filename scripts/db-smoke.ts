import 'dotenv/config';

import { getDb } from '@/lib/db';

async function main() {
  try {
    const db = getDb();
    const rows = (await db`select now() as now`) as Array<{ now: string }>;
    console.log('✅ Connected to Neon. Server time:', rows[0]?.now);
  } catch (error) {
    console.error('❌ Neon smoke test failed:', error);
    process.exitCode = 1;
  }
}

void main();

