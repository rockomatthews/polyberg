import { create } from 'zustand';

type ExecutionMode = 'aggressive' | 'passive';

type TerminalState = {
  selectedMarketId: string | null;
  selectedTokenId: string | null;
  selectedMarketQuestion: string | null;
  selectedOutcomeLabel: string | null;
  depthOverlayOpen: boolean;
  executionMode: ExecutionMode;
  setSelection: (payload: {
    marketId: string | null;
    tokenId: string | null;
    question?: string | null;
    outcomeLabel?: string | null;
    openDepthOverlay?: boolean;
  }) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setDepthOverlayOpen: (open: boolean) => void;
};

export const useTerminalStore = create<TerminalState>((set) => ({
  selectedMarketId: null,
  selectedTokenId: null,
  selectedMarketQuestion: null,
  selectedOutcomeLabel: null,
  depthOverlayOpen: false,
  executionMode: 'aggressive',
  setSelection: ({ marketId, tokenId, question, outcomeLabel, openDepthOverlay }) =>
    set((state) => ({
      selectedMarketId: marketId,
      selectedTokenId: tokenId,
      selectedMarketQuestion: question ?? null,
      selectedOutcomeLabel: outcomeLabel ?? null,
      depthOverlayOpen:
        typeof openDepthOverlay === 'boolean' ? openDepthOverlay : state.depthOverlayOpen,
    })),
  setExecutionMode: (mode) => set({ executionMode: mode }),
  setDepthOverlayOpen: (open) => set({ depthOverlayOpen: open }),
}));

