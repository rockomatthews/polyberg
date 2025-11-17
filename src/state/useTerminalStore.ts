import { create } from 'zustand';

type ExecutionMode = 'aggressive' | 'passive';

type TerminalState = {
  selectedMarketId: string | null;
  selectedTokenId: string | null;
  executionMode: ExecutionMode;
  setSelection: (payload: { marketId: string | null; tokenId: string | null }) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
};

export const useTerminalStore = create<TerminalState>((set) => ({
  selectedMarketId: null,
  selectedTokenId: null,
  executionMode: 'aggressive',
  setSelection: ({ marketId, tokenId }) => set({ selectedMarketId: marketId, selectedTokenId: tokenId }),
  setExecutionMode: (mode) => set({ executionMode: mode }),
}));

