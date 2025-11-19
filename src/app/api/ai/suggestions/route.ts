import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createClient } from '@vercel/ai';

const aiClient = createClient({
  apiKey: process.env.VERCEL_AI_API_KEY ?? '',
});

export async function POST(request: Request) {
  if (!process.env.VERCEL_AI_API_KEY) {
    return NextResponse.json({ error: 'AI gateway key missing' }, { status: 500 });
  }

  const body = await request.json();
  const prompt = body?.prompt ?? 'Summarize Polymarket opportunities.';

  const result = await streamText({
    client: aiClient,
    model: 'openai/gpt-4o-mini',
    prompt,
  });

  return NextResponse.json({ text: result.toString() });
}

