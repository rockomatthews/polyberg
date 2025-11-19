import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redisClient = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  return (await redisClient.get<T>(key)) ?? null;
}

export async function setCached<T>(key: string, value: T, ttlSeconds = 5) {
  if (!redisClient) return;
  await redisClient.set(key, value, { ex: ttlSeconds });
}

