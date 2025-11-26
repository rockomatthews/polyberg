import { clobClient } from '@/lib/polymarket/clobClient';

export type BestPrices = {
  bestBidCents: number | null;
  bestAskCents: number | null;
};

export async function fetchBestPrices(tokenId: string): Promise<BestPrices> {
  try {
    const summary = await clobClient.getOrderBook(tokenId);
    const bestBidCents = summary.bids?.length ? Number(summary.bids[0].price) * 100 : null;
    const bestAskCents = summary.asks?.length ? Number(summary.asks[0].price) * 100 : null;
    return {
      bestBidCents,
      bestAskCents,
    };
  } catch {
    return {
      bestBidCents: null,
      bestAskCents: null,
    };
  }
}


