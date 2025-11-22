import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { ClobClient, Chain } from '@polymarket/clob-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

import { env } from '@/lib/env';

export const polymarketChainId = env.polymarketChainId === Chain.AMOY ? Chain.AMOY : Chain.POLYGON;

const builderConfig =
  env.builderSigner || env.builderLocalCreds
    ? new BuilderConfig({
        remoteBuilderConfig: env.builderSigner,
        localBuilderCreds: env.builderLocalCreds,
      })
    : undefined;

const orderSigner =
  env.orderSignerPrivateKey
    ? new Wallet(
        env.orderSignerPrivateKey,
        env.relayerRpcUrl ? new JsonRpcProvider(env.relayerRpcUrl, polymarketChainId) : undefined,
      )
    : undefined;

export const clobClient = new ClobClient(
  env.polymarketApiHost,
  polymarketChainId,
  orderSigner,
  env.l2ApiCreds,
  undefined,
  undefined,
  undefined,
  true,
  builderConfig,
);

