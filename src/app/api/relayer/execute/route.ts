import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OperationType, SafeTransaction } from '@polymarket/builder-relayer-client';

import { executeTransactions } from '@/lib/relayer/transactions';

const txSchema = z.object({
  to: z.string().min(1, 'to address required'),
  data: z.string().min(1, 'calldata required'),
  value: z.string().optional(),
  operation: z.nativeEnum(OperationType).optional(),
});

const payloadSchema = z.object({
  transactions: z.array(txSchema).min(1),
  metadata: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { transactions, metadata } = payloadSchema.parse(json);
    const formatted: SafeTransaction[] = transactions.map((tx) => ({
      to: tx.to,
      data: tx.data,
      value: tx.value ?? '0',
      operation: tx.operation ?? OperationType.Call,
    }));

    const result = await executeTransactions(formatted, metadata);
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[api/relayer/execute] Failed to execute Safe txs', error);
    const message = error instanceof z.ZodError ? error.flatten() : 'Unable to execute transactions';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

