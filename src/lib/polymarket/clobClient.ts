import { ClobClient, Chain } from '@polymarket/clob-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

import { env } from '@/lib/env';

const chainId = env.polymarketChainId === Chain.AMOY ? Chain.AMOY : Chain.POLYGON;

const builderConfig =
  env.builderSigner || env.builderLocalCreds
    ? new BuilderConfig({
        remoteBuilderConfig: env.builderSigner,
        localBuilderCreds: env.builderLocalCreds,
      })
    : undefined;

export const clobClient = new ClobClient(
  env.polymarketApiHost,
  chainId,
  undefined,
  env.l2ApiCreds,
  undefined,
  undefined,
  undefined,
  true,
  builderConfig,
);

