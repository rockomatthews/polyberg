import type { Side } from '@polymarket/clob-client';

export const MIN_LIMIT_PRICE = 0.001;
export const MAX_LIMIT_PRICE = 0.999;
export const COLLATERAL_TOLERANCE = 0.01; // USD tolerance to smooth rounding gaps

type SideInput = Side | 'BUY' | 'SELL';

export type CollateralEstimateInput = {
  side: SideInput;
  priceDecimals: number;
  sizeThousands: number;
  slippageCents?: number;
};

export type CollateralEstimateResult = {
  sizeInContracts: number;
  worstCasePrice: number;
  requiredCollateral: number;
};

export function clampPrice(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_LIMIT_PRICE;
  }
  return Math.min(MAX_LIMIT_PRICE, Math.max(MIN_LIMIT_PRICE, value));
}

function normalizeSide(side: SideInput): 'BUY' | 'SELL' {
  if (typeof side === 'string') {
    return side.toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
  }
  return side === 'SELL' ? 'SELL' : 'BUY';
}

export function estimateOrderCollateral(
  input: CollateralEstimateInput,
): CollateralEstimateResult {
  const normalizedSide = normalizeSide(input.side);
  const basePrice = clampPrice(input.priceDecimals);
  const slippageDecimal = Math.max(0, (input.slippageCents ?? 0) / 100);
  const adjustment = normalizedSide === 'BUY' ? slippageDecimal : -slippageDecimal;
  const worstCasePrice = clampPrice(basePrice + adjustment);
  const sizeThousands = Number.isFinite(input.sizeThousands) ? Math.max(0, input.sizeThousands) : 0;
  const sizeInContracts = sizeThousands * 1_000;

  if (sizeInContracts <= 0) {
    return { sizeInContracts: 0, worstCasePrice, requiredCollateral: 0 };
  }

  const requiredCollateral =
    normalizedSide === 'BUY'
      ? sizeInContracts * worstCasePrice
      : sizeInContracts * (1 - worstCasePrice);

  return { sizeInContracts, worstCasePrice, requiredCollateral };
}


