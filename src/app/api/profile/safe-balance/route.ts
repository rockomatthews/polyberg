import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

import {
  getSafeBalance,
  SafeBalanceError,
} from '@/lib/services/safeBalanceService';

export async function handleSafeBalance(request: NextRequest, safeOverride?: string) {
  const { searchParams } = new URL(request.url);
  const safeAddressParam = safeOverride?.trim() ?? searchParams.get('safe')?.trim();
  if (!safeAddressParam) {
    return NextResponse.json({ error: 'Safe address required' }, { status: 400 });
  }

  try {
    const balance = await getSafeBalance(safeAddressParam);
    return NextResponse.json(balance);
  } catch (error) {
    if (error instanceof SafeBalanceError) {
      return NextResponse.json(
        { error: error.message, meta: error.meta },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: 'Safe balance lookup failed unexpectedly' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleSafeBalance(request);
}

