import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient } from '@polymarket/clob-client';

import { env } from '@/lib/env';
import { clobClient, polymarketChainId } from '@/lib/polymarket/clobClient';
import {
  getUserCredentials,
  type UserCredentialPayload,
} from '@/lib/services/userCredentialsService';

type ClientResolution =
  | { client: ClobClient; source: 'env'; missing?: undefined }
  | { client: ClobClient; source: 'user'; missing?: undefined }
  | { client: null; source: 'user'; missing: string[] };

function buildBuilderConfig(payload: UserCredentialPayload): BuilderConfig | undefined {
  if (payload.builderSignerUrl) {
    return new BuilderConfig({
      remoteBuilderConfig: {
        url: payload.builderSignerUrl,
        token: payload.builderSignerToken,
      },
    });
  }
  if (payload.builderApiKey && payload.builderApiSecret && payload.builderApiPassphrase) {
    return new BuilderConfig({
      localBuilderCreds: {
        key: payload.builderApiKey,
        secret: payload.builderApiSecret,
        passphrase: payload.builderApiPassphrase,
      },
    });
  }
  return undefined;
}

function buildL2Creds(payload: UserCredentialPayload) {
  if (payload.l2Key && payload.l2Secret && payload.l2Passphrase) {
    return {
      key: payload.l2Key,
      secret: payload.l2Secret,
      passphrase: payload.l2Passphrase,
    };
  }
  return undefined;
}

function buildOrderSigner(payload: UserCredentialPayload) {
  const privateKey =
    payload.orderSignerPrivateKey ??
    payload.relayerPrivateKey ??
    env.orderSignerPrivateKey ??
    env.relayerPrivateKey;
  if (!privateKey) {
    return undefined;
  }
  const rpcUrl = payload.relayerRpcUrl ?? env.relayerRpcUrl;
  const provider = rpcUrl ? new JsonRpcProvider(rpcUrl, polymarketChainId) : undefined;
  return new Wallet(privateKey, provider);
}

export async function resolveClobClientForUser(userId?: string): Promise<ClientResolution> {
  if (!userId) {
    return { client: clobClient, source: 'env' };
  }
  const payload = await getUserCredentials(userId);
  if (!payload) {
    return { client: clobClient, source: 'env' };
  }

  const builderConfig = buildBuilderConfig(payload);
  const l2Creds = buildL2Creds(payload);
  const orderSigner = buildOrderSigner(payload);

  const missing: string[] = [];
  if (!builderConfig) missing.push('builder signer');
  if (!l2Creds) missing.push('L2 API credentials');
  if (!orderSigner) missing.push('order signer key');

  if (missing.length) {
    return { client: null, source: 'user', missing };
  }

  const userClient = new ClobClient(
    env.polymarketApiHost,
    polymarketChainId,
    orderSigner,
    l2Creds,
    undefined,
    undefined,
    undefined,
    true,
    builderConfig,
  );

  return { client: userClient, source: 'user' };
}

