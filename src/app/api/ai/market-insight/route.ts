import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';

import { aiApiKey } from '@/lib/ai/config';
import { logger } from '@/lib/logger';

const insightSchema = z.object({
  headline: z.string(),
  probability: z.string(),
  lean: z.string(),
  rationale: z.string(),
  catalysts: z.array(z.string()).max(5).default([]),
  risks: z.array(z.string()).max(5).default([]),
});

type MarketPayload = {
  question: string;
  tag?: string | null;
  category?: string | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  liquidity?: number | null;
  endDate?: string | null;
};

export async function POST(request: Request) {
  if (!aiApiKey) {
    return NextResponse.json({ error: 'AI gateway not configured' }, { status: 503 });
  }

  let body: { market?: MarketPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const market = body.market;
  if (!market?.question) {
    return NextResponse.json({ error: 'Market question is required' }, { status: 400 });
  }

  const prompt = [
    'You are a Polymarket analyst. Summarize the odds and fundamentals for one prediction market.',
    '',
    `Question: ${market.question}`,
    `Category: ${market.category ?? 'unknown'}`,
    `Tag: ${market.tag ?? 'none'}`,
    `Order book: bid ${market.bestBid ?? '—'}¢ / ask ${market.bestAsk ?? '—'}¢`,
    `Liquidity: ${market.liquidity ?? '—'}`,
    `Time remaining: ${market.endDate ?? 'unspecified'}`,
    '',
    'Provide:',
    '1. A short headline (max 120 chars).',
    '2. Probability (e.g. "41% chance").',
    '3. Lean — 1-2 sentences on which side the data favors.',
    '4. Rationale — 3-4 sentences referencing recent news/data (cite sources generically, no URLs).',
    '5. Up to 4 catalysts to monitor.',
    '6. Up to 4 risks that could flip the market.',
  ].join('\n');

  try {
    const result = await generateObject({
      model: 'openai/gpt-4o-mini',
      prompt,
      schema: insightSchema,
    });
    return NextResponse.json({ insight: result.object });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI insight unavailable';
    logger.error('ai.marketInsight.failed', { error: message });
    return NextResponse.json(
      { error: 'AI insight is cooling down. Try again shortly.' },
      { status: 502 },
    );
  }
}


