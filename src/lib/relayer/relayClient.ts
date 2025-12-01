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

const relaySigner =
  env.relayerRpcUrl && env.relayerPrivateKey
    ? new Wallet(
        env.relayerPrivateKey,
        new JsonRpcProvider(env.relayerRpcUrl, env.relayerChainId ?? env.polymarketChainId),
      )
    : undefined;

export const relayClient = env.relayerUrl
  ? new RelayClient(
      env.relayerUrl,
      env.relayerChainId ?? env.polymarketChainId,
      relaySigner,
      builderConfig,
    )
  : undefined;

export const hasRelayClient = Boolean(relayClient);
export const hasRelaySigner = Boolean(relaySigner);
const contractConfig =
  env.relayerChainId || env.polymarketChainId
    ? getContractConfig(env.relayerChainId ?? env.polymarketChainId)
    : undefined;

export function ensureRelayClient(action = 'relayer operation'): RelayClient {
  if (!relayClient) {
    throw new Error(`Polymarket relayer is not configured. Cannot perform ${action}.`);
  }
  if (!relaySigner) {
    throw new Error(`Relayer signer (RPC URL + private key) missing. Cannot perform ${action}.`);
  }
  return relayClient;
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

