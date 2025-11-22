import { Pinecone, type Index } from '@pinecone-database/pinecone';

import { env, hasPinecone } from '@/lib/env';

let client: Pinecone | null = null;

function getClient() {
  if (!hasPinecone) {
    return null;
  }
  if (!client) {
    client = new Pinecone({
      apiKey: env.pinecone!.apiKey,
    });
  }
  return client;
}

export function getPineconeIndex(): Index | null {
  const pineconeClient = getClient();
  if (!pineconeClient || !env.pinecone?.index) {
    return null;
  }
  return pineconeClient.index(env.pinecone.index);
}

export const pineconeNamespace = env.pinecone?.namespace ?? 'snipes';

