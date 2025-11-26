import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { listStrategies, runScheduledStrategies } from '@/lib/autonomy/strategyEngine';
import { fetchRecentStrategyRuns, recordStrategyRun } from '@/lib/autonomy/runLog';

async function ensureSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await ensureSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const [strategies, runs] = await Promise.all([listStrategies(), fetchRecentStrategyRuns(10)]);
  const tradingEnabled = process.env.AUTONOMY_TRADING_ENABLED === 'true';
  const cronConfigured = Boolean(process.env.CRON_SECRET);

  return NextResponse.json({
    strategies,
    runs,
    tradingEnabled,
    cronConfigured,
  });
}

export async function POST() {
  const session = await ensureSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const summary = await runScheduledStrategies();
  await recordStrategyRun(summary);
  return NextResponse.json(summary);
}


