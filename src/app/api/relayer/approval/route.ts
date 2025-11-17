import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createApprovalTransaction, executeTransactions } from '@/lib/relayer/transactions';

const approvalSchema = z.object({
  tokenAddress: z.string().min(1),
  spenderAddress: z.string().min(1),
  amount: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { tokenAddress, spenderAddress, amount } = approvalSchema.parse(json);
    const tx = createApprovalTransaction(tokenAddress, spenderAddress, amount);
    const result = await executeTransactions([tx], 'ERC20 approval');
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[api/relayer/approval] Failed to send approval tx', error);
    const message = error instanceof z.ZodError ? error.flatten() : 'Unable to execute approval transaction';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

