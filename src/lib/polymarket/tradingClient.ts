import { ClobClient } from '@polymarket/clob-client';

import { hasBuilderSigning, hasL2Auth, hasOrderSigner } from '@/lib/env';
import { resolveClobClientForUser } from '@/lib/polymarket/clientFactory';
import { clobClient } from '@/lib/polymarket/clobClient';

export type TradingClientResolution =
  | { client: ClobClient }
  | { error: string; status: number };

export async function ensureTradingClient(userId?: string): Promise<TradingClientResolution> {
  const resolution = await resolveClobClientForUser(userId);
  if (resolution.source === 'env') {
    if (!hasOrderSigner || !hasL2Auth || !hasBuilderSigning) {
      return {
        error:
          'Global builder credentials missing. Configure POLYMARKET_* env vars or add per-user credentials.',
        status: 400,
      };
    }
    return { client: clobClient };
  }
  if (!resolution.client && resolution.missing?.length) {
    return {
      error: `Add ${resolution.missing.join(', ')} in your profile credentials before trading.`,
      status: 400,
    };
  }
  return { client: resolution.client ?? clobClient };
}

