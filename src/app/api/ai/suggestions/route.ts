import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { logCopilotEntry } from '@/lib/services/copilotService';
import { getPineconeIndex, pineconeNamespace } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/ai/embeddings';
import { hasPinecone } from '@/lib/env';
import { logger } from '@/lib/logger';

const aiKey = process.env.AI_SDK_API_KEY ?? process.env.VERCEL_AI_API_KEY ?? '';
if (!process.env.AI_SDK_API_KEY && aiKey) {
  process.env.AI_SDK_API_KEY = aiKey;
}

type MarketContext = {
  question: string;
  conditionId: string;
  bestBid?: number | null;
  bestAsk?: number | null;
  liquidity?: number | null;
  tag?: string | null;
};

type PositionContext = {
  market: string;
  exposure: number;
  pnl: number;
  delta: 'Long' | 'Short';
};

async function loadTradeMemories(userId: string, queryText: string) {
  if (!hasPinecone) {
    return [];
  }
  try {
    const index = getPineconeIndex();
    if (!index) {
      return [];
    }
    const queryEmbedding = await createEmbedding(queryText);
    if (!queryEmbedding) {
      return [];
    }
    const namespace = index.namespace(pineconeNamespace);
    const result = await namespace.query({
      vector: queryEmbedding,
      topK: 4,
      includeMetadata: true,
      filter: {
        userId,
      },
    });
    return result.matches?.map((match) => match.metadata ?? {}) ?? [];
  } catch (error) {
    logger.warn('ai.memory.failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function buildPrompt(params: {
  markets: MarketContext[];
  positions: PositionContext[];
  watchlist: string[];
  tradeMemories: Array<Record<string, unknown>>;
}) {
  const marketLines = params.markets
    .map(
      (market) =>
        `• ${market.question} (${market.tag ?? 'untagged'}) bid ${market.bestBid ?? '—'}¢ / ask ${
          market.bestAsk ?? '—'
        }¢ liquidity ${market.liquidity ?? '—'}`,
    )
    .join('\n');
  const positionLines = params.positions
    .map(
      (pos) => `• ${pos.market}: ${pos.delta} exposure ${pos.exposure.toFixed(2)} · PnL $${pos.pnl}`,
    )
    .join('\n');
  const watchlistLine = params.watchlist.length
    ? params.watchlist.join(', ')
    : 'No favorites recorded';
  const memoryLines = params.tradeMemories
    .map((memory) => {
      const market = memory.market ?? memory.tokenId ?? 'unknown market';
      const side = memory.side ?? 'trade';
      const size = memory.sizeThousands ? `${memory.sizeThousands}k` : 'size n/a';
      const price = memory.priceCents ? `${memory.priceCents}¢` : 'price n/a';
      return `• ${market}: ${side} ${size} @ ${price}`;
    })
    .join('\n');

  return [
    'You are an elite Polymarket sniper copilot. Provide concise, actionable guidance on where to deploy capital next.',
    '',
    `Watchlist: ${watchlistLine}`,
    '',
    'Open positions:',
    positionLines || '• None',
    '',
    'Live markets:',
    marketLines || '• No market data loaded',
    '',
    'Recent personal trades:',
    memoryLines || '• No recent trades available',
    '',
    'Highlight 2-3 opportunities with entry price ranges, rationale, and quick risk notes. Format in short bullet paragraphs.',
  ].join('\n');
}

export async function POST(request: Request) {
  if (!aiKey) {
    logger.error('ai.missingApiKey');
    return NextResponse.json(
      {
        text: 'AI suggestions unavailable until VERCEL_AI_API_KEY or OPENAI_API_KEY is configured.',
        suggestions: [],
        meta: { error: 'AI gateway key missing' },
      },
      { status: 200 },
    );
  }

  const body = await request.json();
  const markets: MarketContext[] = body?.context?.markets ?? [];
  const positions: PositionContext[] = body?.context?.positions ?? [];
  const watchlist: string[] = body?.context?.watchlist ?? [];
  const session = await getServerSession(authOptions);

  let tradeMemories: Array<Record<string, unknown>> = [];
  if (session?.user?.id && hasPinecone) {
    tradeMemories = await loadTradeMemories(session.user.id, 'Find relevant past trades.');
  }

  const prompt = buildPrompt({ markets, positions, watchlist, tradeMemories });

  const schema = z.object({
    summary: z.string(),
    suggestions: z
      .array(
        z.object({
          market: z.string(),
          entry: z.string(),
          thesis: z.string(),
          risk: z.string(),
        }),
      )
      .max(4),
  });

  let result;
  try {
    result = await generateObject({
      model: 'openai/gpt-4o-mini',
      prompt,
      schema,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Strategy Copilot could not reach the AI gateway.';
    logger.error('ai.copilot.failed', {
      error: message,
    });
    return NextResponse.json(
      {
        text: 'Strategy Copilot is cooling down. Try again in a few seconds.',
        suggestions: [],
        meta: { error: message },
      },
      { status: 200 },
    );
  }

  const summary = result.object.summary ?? 'No insight generated.';
  const suggestions = result.object.suggestions ?? [];
  const logText =
    summary +
    (suggestions.length
      ? `\n\n${suggestions
          .map(
            (idea) =>
              `${idea.market}: entry ${idea.entry}, thesis ${idea.thesis}, risk ${idea.risk}`,
          )
          .join('\n')}`
      : '');

  if (session?.user?.id) {
    await logCopilotEntry(session.user.id, prompt, logText);
    logger.info('ai.copilot.generated', {
      userId: session.user.id,
      suggestions: suggestions.length,
    });
  } else {
    logger.warn('ai.copilot.anonymous', { suggestions: suggestions.length });
  }

  return NextResponse.json({ text: summary, suggestions });
}

