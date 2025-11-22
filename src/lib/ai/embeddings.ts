import { embed, openai } from 'ai';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const apiKey = process.env.OPENAI_API_KEY ?? process.env.VERCEL_AI_API_KEY;

const embeddingModelId = env.embeddingModel ?? 'text-embedding-3-small';

export async function createEmbedding(text: string): Promise<number[] | null> {
  if (!apiKey) {
    logger.warn('embeddings.missingApiKey');
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed.length) {
    return null;
  }
  const model = openai.embedding(embeddingModelId, { apiKey });
  const result = await embed({
    model,
    value: trimmed,
  });
  return result.embedding;
}

