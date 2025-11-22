import crypto from 'node:crypto';

import { getDb, hasDatabase } from '@/lib/db';
import { createEmbedding } from '@/lib/ai/embeddings';
import { getPineconeIndex, pineconeNamespace } from '@/lib/pinecone';
import { hasPinecone } from '@/lib/env';
import { logger } from '@/lib/logger';

type TradeInsightInput = {
  userId: string;
  market?: string | null;
  tokenId: string;
  side: 'BUY' | 'SELL';
  priceCents: number;
  sizeThousands: number;
  executionMode: 'aggressive' | 'passive';
  slippage?: number;
  timeInForce?: number;
  orderId?: string;
};

async function ensureTable() {
  if (!hasDatabase) {
    return;
  }
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS user_trades (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      market TEXT,
      token_id TEXT NOT NULL,
      side TEXT NOT NULL,
      price_cents NUMERIC,
      size_thousands NUMERIC,
      execution_mode TEXT,
      slippage NUMERIC,
      time_in_force INTEGER,
      order_id TEXT,
      vector_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

export async function recordTradeInsight(input: TradeInsightInput) {
  const tradeId = crypto.randomUUID();
  const vectorId = crypto.randomUUID();

  if (hasDatabase) {
    await ensureTable();
    const db = getDb();
    await db`
      INSERT INTO user_trades (
        id,
        user_id,
        market,
        token_id,
        side,
        price_cents,
        size_thousands,
        execution_mode,
        slippage,
        time_in_force,
        order_id,
        vector_id
      )
      VALUES (
        ${tradeId},
        ${input.userId},
        ${input.market ?? null},
        ${input.tokenId},
        ${input.side},
        ${input.priceCents},
        ${input.sizeThousands},
        ${input.executionMode},
        ${input.slippage ?? null},
        ${input.timeInForce ?? null},
        ${input.orderId ?? null},
        ${vectorId}
      )
    `;
  }

  if (!hasPinecone) {
    return;
  }

  try {
    const summary = [
      `User ${input.userId} ${input.side === 'BUY' ? 'bought' : 'sold'}`,
      `${input.sizeThousands.toFixed(2)}k contracts`,
      input.market ? `on ${input.market}` : `token ${input.tokenId}`,
      `at ${input.priceCents.toFixed(2)}¢`,
      `(mode ${input.executionMode}`,
      `slippage ${input.slippage ?? 0}¢`,
      `TIF ${input.timeInForce ?? 0}s)`,
    ].join(' ');

    const embedding = await createEmbedding(summary);
    if (!embedding) {
      return;
    }

    const baseIndex = getPineconeIndex();
    if (!baseIndex) {
      return;
    }
    const index = baseIndex.namespace(pineconeNamespace);
    await index.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata: {
          userId: input.userId,
          market: input.market ?? undefined,
          tokenId: input.tokenId,
          side: input.side,
          priceCents: input.priceCents,
          sizeThousands: input.sizeThousands,
          executionMode: input.executionMode,
          slippage: input.slippage ?? undefined,
          timeInForce: input.timeInForce ?? undefined,
          orderId: input.orderId ?? undefined,
          createdAt: new Date().toISOString(),
        },
      },
    ]);
  } catch (error) {
    logger.warn('tradeInsights.pinecone.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

