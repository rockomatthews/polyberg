import { providers, Wallet } from 'ethers';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

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
        new providers.JsonRpcProvider(env.relayerRpcUrl, env.relayerChainId ?? env.polymarketChainId),
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

export function ensureRelayClient(action = 'relayer operation'): RelayClient {
  if (!relayClient) {
    throw new Error(`Polymarket relayer is not configured. Cannot perform ${action}.`);
  }
  if (!relaySigner) {
    throw new Error(`Relayer signer (RPC URL + private key) missing. Cannot perform ${action}.`);
  }
  return relayClient;
}

