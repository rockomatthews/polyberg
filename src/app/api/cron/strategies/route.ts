import { NextRequest, NextResponse } from 'next/server';

import { runScheduledStrategies } from '@/lib/autonomy/strategyEngine';
import { recordStrategyRun } from '@/lib/autonomy/runLog';

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('Authorization');
  if (!secret) {
    return { ok: false, status: 500 as const, body: { error: 'CRON_SECRET missing' } };
  }
  if (header !== `Bearer ${secret}`) {
    return { ok: false, status: 401 as const, body: { error: 'Unauthorized' } };
  }
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const summary = await runScheduledStrategies();
  await recordStrategyRun(summary);
  return NextResponse.json(summary);
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}


