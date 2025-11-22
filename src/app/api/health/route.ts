import { NextResponse } from 'next/server';

import { getDb, hasDatabase } from '@/lib/db';
import { env, hasRelayer } from '@/lib/env';
import { redisClient } from '@/lib/redis';
import { getPineconeIndex } from '@/lib/pinecone';
import { logger } from '@/lib/logger';

const aiConfigured = Boolean(
  process.env.AI_SDK_API_KEY || process.env.VERCEL_AI_API_KEY || process.env.OPENAI_API_KEY,
);

async function checkDatabase() {
  if (!hasDatabase) {
    return { ok: false, message: 'DATABASE_URL not configured' };
  }
  const db = getDb();
  const start = Date.now();
  await db`SELECT 1`;
  return { ok: true, latencyMs: Date.now() - start };
}

async function checkRedis() {
  if (!redisClient) {
    return { ok: false, message: 'Redis client not configured' };
  }
  const start = Date.now();
  await redisClient.ping();
  return { ok: true, latencyMs: Date.now() - start };
}

async function checkRelayer() {
  if (!hasRelayer || !env.relayerUrl) {
    return { ok: false, message: 'Relayer URL missing' };
  }
  try {
    const response = await fetch(`${env.relayerUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Relayer health check failed',
    };
  }
}

async function checkRpc() {
  if (!env.relayerRpcUrl) {
    return { ok: false, message: 'POLYMARKET_RELAYER_RPC_URL missing' };
  }
  try {
    const response = await fetch(env.relayerRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });
    const json = await response.json();
    return { ok: Boolean(json?.result), status: response.status };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'RPC ping failed',
    };
  }
}

async function checkPinecone() {
  const index = getPineconeIndex();
  if (!index) {
    return { ok: false, message: 'Pinecone not configured' };
  }
  try {
    await index.describeIndexStats();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Pinecone check failed',
    };
  }
}

export async function GET() {
  try {
    const [database, redis, relayer, rpc, pinecone] = await Promise.all([
      checkDatabase().catch((error) => ({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })),
      checkRedis().catch((error) => ({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })),
      checkRelayer(),
      checkRpc(),
      checkPinecone(),
    ]);

    const ai = {
      ok: aiConfigured,
      message: aiConfigured ? undefined : 'AI gateway key missing',
    };

    const statuses = { database, redis, relayer, rpc, ai, pinecone };
    const failing = Object.entries(statuses)
      .filter(([, status]) => !status.ok)
      .map(([key]) => key);
    logger.info('health.check', { failing });

    return NextResponse.json({
      ok: failing.length === 0,
      checkedAt: new Date().toISOString(),
      statuses,
    });
  } catch (error) {
    logger.error('health.check.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: 'Health check failed catastrophically' },
      { status: 500 },
    );
  }
}

