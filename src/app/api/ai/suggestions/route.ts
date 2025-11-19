import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { logCopilotEntry } from '@/lib/services/copilotService';

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
  const session = await getServerSession(authOptions);

  const result = await streamText({
    model: 'openai/gpt-4o-mini',
    prompt,
  });

  const text = result.toString();
  if (session?.user?.id) {
    await logCopilotEntry(session.user.id, prompt, text);
  }

  return NextResponse.json({ text });
}

