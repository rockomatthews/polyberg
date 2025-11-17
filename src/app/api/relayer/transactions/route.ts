import { NextResponse } from 'next/server';

import { listRelayerTransactions } from '@/lib/relayer/transactions';

export async function GET() {
  try {
    const txs = await listRelayerTransactions();
    return NextResponse.json({ transactions: txs ?? [] });
  } catch (error) {
    console.error('[api/relayer/transactions] Failed to list transactions', error);
    return NextResponse.json({ error: 'Unable to list relayer transactions' }, { status: 500 });
  }
}

