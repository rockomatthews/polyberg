import { embed, type EmbeddingModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const apiKey = process.env.OPENAI_API_KEY ?? process.env.VERCEL_AI_API_KEY;
const openaiClient = apiKey ? createOpenAI({ apiKey }) : null;

const embeddingModelId = env.embeddingModel ?? 'text-embedding-3-small';

export async function createEmbedding(text: string): Promise<number[] | null> {
  if (!openaiClient) {
    logger.warn('embeddings.missingApiKey');
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed.length) {
    return null;
  }
  const model = openaiClient.embedding(embeddingModelId) as unknown as EmbeddingModel<string>;
  const result = await embed({
    model,
    value: trimmed,
  });
  return result.embedding;
}

