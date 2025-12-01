import { redisClient } from '@/lib/redis';
import { clobClient } from '@/lib/polymarket/clobClient';
import { fetchAggregatedPositions } from '@/lib/polymarket/positionsService';
import type { ExecutionIntent } from '@/lib/autonomy/types';

type ManagedPositionRecord = {
  marketId: string;
  tokenId: string;
  outcome?: string | null;
  side: 'BUY' | 'SELL';
  sizeUsd: number;
  entryPriceCents: number;
  enteredAt: string;
  question?: string | null;
};

const REGISTRY_KEY = 'autonomy:managedPositions';
const fallbackStore = new Map<string, ManagedPositionRecord>();

export type ManagedPosition = ManagedPositionRecord & {
  assetId: string;
  exposureUsd: number;
};

export async function getManagedPositions(): Promise<ManagedPosition[]> {
  const [records, aggregated] = await Promise.all([
    readRegistry(),
    fetchAggregatedPositions(clobClient),
  ]);

  const aggregationMap = new Map<string, number>();
  aggregated.forEach((position) => {
    aggregationMap.set(position.assetId, position.exposure);
  });

  const managed: ManagedPosition[] = [];
  for (const record of records.values()) {
    const exposure = aggregationMap.get(record.tokenId) ?? 0;
    if (exposure <= 0) {
      await deleteRecord(record.tokenId);
      continue;
    }
    managed.push({
      ...record,
      assetId: record.tokenId,
      exposureUsd: exposure,
    });
  }

  return managed;
}

export async function recordEntryIntent(intent: ExecutionIntent) {
  if (intent.intent !== 'enter') {
    return;
  }
  const record: ManagedPositionRecord = {
    marketId: intent.marketId,
    tokenId: intent.tokenId,
    outcome: intent.outcome,
    side: intent.side,
    sizeUsd: intent.notionalUsd,
    entryPriceCents: Math.round(intent.limitPrice * 100),
    enteredAt: new Date().toISOString(),
    question: intent.marketQuestion ?? null,
  };
  await writeRecord(record.tokenId, record);
}

export async function clearManagedPosition(tokenId: string) {
  await deleteRecord(tokenId);
}

async function readRegistry() {
  if (redisClient) {
    const entries = await redisClient.hgetall<Record<string, string>>(REGISTRY_KEY);
    if (!entries) {
      return new Map<string, ManagedPositionRecord>();
    }
    return new Map(
      Object.entries(entries)
        .map(([key, value]) => {
          try {
            return [key, JSON.parse(value) as ManagedPositionRecord] as const;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is [string, ManagedPositionRecord] => Boolean(entry)),
    );
  }
  return fallbackStore;
}

async function writeRecord(tokenId: string, record: ManagedPositionRecord) {
  if (redisClient) {
    await redisClient.hset(REGISTRY_KEY, { [tokenId]: JSON.stringify(record) });
  } else {
    fallbackStore.set(tokenId, record);
  }
}

async function deleteRecord(tokenId: string) {
  if (redisClient) {
    await redisClient.hdel(REGISTRY_KEY, tokenId);
  } else {
    fallbackStore.delete(tokenId);
  }
}


