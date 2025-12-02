import { create } from 'zustand';

import type { Market } from '@/lib/api/types';

type ExecutionMode = 'aggressive' | 'passive';

type TerminalState = {
  selectedMarketId: string | null;
  selectedTokenId: string | null;
  selectedMarketQuestion: string | null;
  selectedOutcomeLabel: string | null;
  selectedMarketOverride: Market | null;
  depthOverlayOpen: boolean;
  executionMode: ExecutionMode;
  setSelection: (payload: {
    marketId: string | null;
    tokenId: string | null;
    question?: string | null;
    outcomeLabel?: string | null;
    openDepthOverlay?: boolean;
    market?: Market | null;
  }) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setDepthOverlayOpen: (open: boolean) => void;
};

export const useTerminalStore = create<TerminalState>((set) => ({
  selectedMarketId: null,
  selectedTokenId: null,
  selectedMarketQuestion: null,
  selectedOutcomeLabel: null,
  selectedMarketOverride: null,
  depthOverlayOpen: false,
  executionMode: 'aggressive',
  setSelection: ({ marketId, tokenId, question, outcomeLabel, openDepthOverlay, market }) =>
    set((state) => ({
      selectedMarketId: marketId,
      selectedTokenId: tokenId,
      selectedMarketQuestion: question ?? null,
      selectedOutcomeLabel: outcomeLabel ?? null,
      selectedMarketOverride: market ?? null,
      depthOverlayOpen:
        typeof openDepthOverlay === 'boolean' ? openDepthOverlay : state.depthOverlayOpen,
    })),
  setExecutionMode: (mode) => set({ executionMode: mode }),
  setDepthOverlayOpen: (open) => set({ depthOverlayOpen: open }),
}));

