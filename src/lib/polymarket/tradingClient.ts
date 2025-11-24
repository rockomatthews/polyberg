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
      const missing: string[] = [];
      if (!hasBuilderSigning) missing.push('POLYMARKET_BUILDER_SIGNER_URL or builder API keys');
      if (!hasL2Auth) missing.push('POLYMARKET_L2_API_KEY/SECRET/PASSPHRASE');
      if (!hasOrderSigner) missing.push('POLYMARKET_ORDER_SIGNER_PRIVATE_KEY');
      return {
        error:
          missing.length > 0
            ? `Global builder credentials missing: ${missing.join(', ')}`
            : 'Global builder credentials missing. Configure POLYMARKET_* env vars or add per-user credentials.',
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

