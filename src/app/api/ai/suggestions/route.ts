import { NextResponse } from 'next/server';
import { streamText } from 'ai';

const aiKey = process.env.AI_SDK_API_KEY ?? process.env.VERCEL_AI_API_KEY ?? '';
if (!process.env.AI_SDK_API_KEY && aiKey) {
  process.env.AI_SDK_API_KEY = aiKey;
}

export async function POST(request: Request) {
  if (!aiKey) {
    return NextResponse.json({ error: 'AI gateway key missing' }, { status: 500 });
  }

  const body = await request.json();
  const prompt = body?.prompt ?? 'Summarize Polymarket opportunities.';

  const result = await streamText({
    model: 'openai/gpt-4o-mini',
    prompt,
  });

  return NextResponse.json({ text: result.toString() });
}

