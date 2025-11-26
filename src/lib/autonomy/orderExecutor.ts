import { OrderType, Side, type UserOrder } from '@polymarket/clob-client/dist/types';

import { clobClient } from '@/lib/polymarket/clobClient';
import { logger } from '@/lib/logger';
import type { ExecutionIntent } from '@/lib/autonomy/types';

const tradingEnabled = process.env.AUTONOMY_TRADING_ENABLED === 'true';

export type OrderExecutionResult = {
  intent: ExecutionIntent;
  status: 'submitted' | 'skipped' | 'error';
  reason?: string;
  orderId?: string;
};

export async function executeIntents(intents: ExecutionIntent[]): Promise<OrderExecutionResult[]> {
  if (!intents.length) {
    return [];
  }

  if (!tradingEnabled) {
    intents.forEach((intent) =>
      logger.info('strategies.order.simulated', {
        strategyId: intent.strategyId,
        marketId: intent.marketId,
        side: intent.side,
        price: intent.limitPrice,
        sizeShares: intent.sizeShares,
      }),
    );
    return intents.map((intent) => ({
      intent,
      status: 'skipped',
      reason: 'autonomy trading disabled',
    }));
  }

  const results: OrderExecutionResult[] = [];
  if (!clobClient) {
    intents.forEach((intent) =>
      results.push({
        intent,
        status: 'error',
        reason: 'clob client unavailable',
      }),
    );
    return results;
  }

  for (const intent of intents) {
    try {
      const order: UserOrder = {
        tokenID: intent.tokenId,
        price: Number(intent.limitPrice.toFixed(4)),
        size: Number(intent.sizeShares.toFixed(4)),
        side: intent.side === 'BUY' ? Side.BUY : Side.SELL,
        expiration: Math.floor(Date.now() / 1000) + 60 * 5,
      };

      const response = await clobClient.createAndPostOrder(order, undefined, OrderType.GTC);
      const orderId = response?.order?.orderID ?? response?.orderID;
      logger.info('strategies.order.submitted', {
        strategyId: intent.strategyId,
        orderId: orderId ?? 'pending',
        marketId: intent.marketId,
      });

      results.push({
        intent,
        status: 'submitted',
        orderId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('strategies.order.failed', {
        strategyId: intent.strategyId,
        marketId: intent.marketId,
        error: message,
      });
      results.push({
        intent,
        status: 'error',
        reason: message,
      });
    }
  }

  return results;
}


