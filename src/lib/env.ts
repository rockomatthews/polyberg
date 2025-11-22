import { z } from 'zod';

const envSchema = z.object({
  POLYMARKET_API_HOST: z.string().url().default('https://clob.polymarket.com'),
  POLYMARKET_CHAIN_ID: z.coerce.number().default(137),
  POLYMARKET_L2_API_KEY: z.string().optional(),
  POLYMARKET_L2_API_SECRET: z.string().optional(),
  POLYMARKET_L2_API_PASSPHRASE: z.string().optional(),
  POLYMARKET_BUILDER_SIGNER_URL: z.string().url().optional(),
  POLYMARKET_BUILDER_SIGNER_TOKEN: z.string().optional(),
  POLYMARKET_BUILDER_API_KEY: z.string().optional(),
  POLYMARKET_BUILDER_API_SECRET: z.string().optional(),
  POLYMARKET_BUILDER_API_PASSPHRASE: z.string().optional(),
  POLYMARKET_RELAYER_URL: z.string().url().optional(),
  POLYMARKET_RELAYER_CHAIN_ID: z.coerce.number().optional(),
  POLYMARKET_SAFE_ADDRESS: z.string().optional(),
  POLYMARKET_RELAYER_RPC_URL: z.string().url().optional(),
  POLYMARKET_RELAYER_PRIVATE_KEY: z.string().optional(),
  POLYMARKET_ORDER_SIGNER_PRIVATE_KEY: z.string().optional(),
  POLYMARKET_COLLATERAL_ADDRESS: z.string().optional(),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().optional(),
  PINECONE_NAMESPACE: z.string().optional(),
  AI_EMBEDDING_MODEL: z.string().optional(),
  LOGTAIL_SOURCE_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration for Polymarket integration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid Polymarket environment configuration. Check .env.local.');
}

const data = parsed.data;

export const env = {
  polymarketApiHost: data.POLYMARKET_API_HOST,
  polymarketChainId: data.POLYMARKET_CHAIN_ID,
  l2ApiCreds:
    data.POLYMARKET_L2_API_KEY && data.POLYMARKET_L2_API_SECRET && data.POLYMARKET_L2_API_PASSPHRASE
      ? {
          key: data.POLYMARKET_L2_API_KEY,
          secret: data.POLYMARKET_L2_API_SECRET,
          passphrase: data.POLYMARKET_L2_API_PASSPHRASE,
        }
      : undefined,
  builderLocalCreds:
    data.POLYMARKET_BUILDER_API_KEY &&
    data.POLYMARKET_BUILDER_API_SECRET &&
    data.POLYMARKET_BUILDER_API_PASSPHRASE
      ? {
          key: data.POLYMARKET_BUILDER_API_KEY,
          secret: data.POLYMARKET_BUILDER_API_SECRET,
          passphrase: data.POLYMARKET_BUILDER_API_PASSPHRASE,
        }
      : undefined,
  builderSigner: data.POLYMARKET_BUILDER_SIGNER_URL
    ? {
        url: data.POLYMARKET_BUILDER_SIGNER_URL,
        token: data.POLYMARKET_BUILDER_SIGNER_TOKEN,
      }
    : undefined,
  relayerUrl: data.POLYMARKET_RELAYER_URL,
  relayerChainId: data.POLYMARKET_RELAYER_CHAIN_ID ?? data.POLYMARKET_CHAIN_ID,
  safeAddress: data.POLYMARKET_SAFE_ADDRESS,
  relayerRpcUrl: data.POLYMARKET_RELAYER_RPC_URL,
  relayerPrivateKey: data.POLYMARKET_RELAYER_PRIVATE_KEY,
  orderSignerPrivateKey:
    data.POLYMARKET_ORDER_SIGNER_PRIVATE_KEY ?? data.POLYMARKET_RELAYER_PRIVATE_KEY,
  collateralAddress: data.POLYMARKET_COLLATERAL_ADDRESS ?? '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  pinecone:
    data.PINECONE_API_KEY && data.PINECONE_INDEX
      ? {
          apiKey: data.PINECONE_API_KEY,
          index: data.PINECONE_INDEX,
          namespace: data.PINECONE_NAMESPACE,
        }
      : undefined,
  embeddingModel: data.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  logtailToken: data.LOGTAIL_SOURCE_TOKEN,
};

export const hasL2Auth = Boolean(env.l2ApiCreds);
export const hasBuilderSigning = Boolean(env.builderSigner || env.builderLocalCreds);
export const hasRelayer = Boolean(env.relayerUrl);
export const hasOrderSigner = Boolean(env.orderSignerPrivateKey);
export const hasCollateralAddress = Boolean(env.collateralAddress);
export const hasPinecone = Boolean(env.pinecone?.apiKey && env.pinecone.index);

