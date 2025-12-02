import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';

import { env } from '@/lib/env';

const builderConfig =
  env.builderSigner || env.builderLocalCreds
    ? new BuilderConfig({
        remoteBuilderConfig: env.builderSigner,
        localBuilderCreds: env.builderLocalCreds,
      })
    : undefined;

const relayChainId = env.relayerChainId ?? env.polymarketChainId;
const relayProvider =
  env.relayerRpcUrl && relayChainId
    ? new JsonRpcProvider(env.relayerRpcUrl, relayChainId)
    : undefined;

const relaySigner =
  relayProvider && env.relayerPrivateKey ? new Wallet(env.relayerPrivateKey, relayProvider) : undefined;

export const relayClient = env.relayerUrl
  ? new RelayClient(
      env.relayerUrl,
      relayChainId ?? env.polymarketChainId,
      relaySigner,
      builderConfig,
    )
  : undefined;

export const hasRelayClient = Boolean(relayClient);
export const hasRelaySigner = Boolean(relaySigner);
const contractConfig = relayChainId ? getContractConfig(relayChainId) : undefined;

export function ensureRelayClient(action = 'relayer operation'): RelayClient {
  if (!relayClient) {
    throw new Error(`Polymarket relayer is not configured. Cannot perform ${action}.`);
  }
  if (!relaySigner) {
    throw new Error(`Relayer signer (RPC URL + private key) missing. Cannot perform ${action}.`);
  }
  return relayClient;
}

export function createScopedRelayClient(privateKey: string) {
  if (!env.relayerUrl || !relayChainId || !relayProvider) {
    throw new Error('Relayer configuration missing');
  }
  const scopedSigner = new Wallet(privateKey, relayProvider);
  return new RelayClient(env.relayerUrl, relayChainId, scopedSigner, builderConfig);
}

export function deriveOperatorSafeAddress() {
  if (!relaySigner || !contractConfig) {
    return null;
  }
  try {
    return deriveSafe(relaySigner.address, contractConfig.SafeContracts.SafeFactory);
  } catch {
    return null;
  }
}

export function deriveSafeAddressFromPrivateKey(privateKey: string) {
  if (!contractConfig) {
    return null;
  }
  try {
    const wallet = new Wallet(privateKey);
    return deriveSafe(wallet.address, contractConfig.SafeContracts.SafeFactory);
  } catch {
    return null;
  }
}

