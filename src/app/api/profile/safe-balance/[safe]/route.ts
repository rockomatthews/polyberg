import { NextRequest } from 'next/server';

import { handleSafeBalance } from '../route';

type Params = { safe: string };

export async function GET(request: NextRequest, context: { params: Promise<Params> }) {
  const params = await context.params;
  return handleSafeBalance(request, params.safe);
}

