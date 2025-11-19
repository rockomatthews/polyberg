import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
let cachedDb: ReturnType<typeof neon> | null = null;

export const hasDatabase = Boolean(connectionString);

export function getDb() {
  if (!connectionString) {
    throw new Error('DATABASE_URL env var is required for Neon connection.');
  }
  if (!cachedDb) {
    cachedDb = neon(connectionString);
  }
  return cachedDb;
}

