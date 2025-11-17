import { NextResponse } from 'next/server';

import { deploySafe } from '@/lib/relayer/transactions';

export async function POST() {
  try {
    const result = await deploySafe();
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[api/relayer/deploy] Failed to deploy Safe', error);
    return NextResponse.json({ error: 'Unable to deploy Safe via relayer' }, { status: 500 });
  }
}

