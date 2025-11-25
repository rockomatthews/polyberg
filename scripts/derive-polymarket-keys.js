#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Derive or create Polymarket L2 API credentials (key / secret / passphrase)
 * using a locally supplied Polygon private key.
 *
 * Usage:
 *   POLYMARKET_SIGNER_KEY=0xabc123 node scripts/derive-polymarket-keys.js
 *   node scripts/derive-polymarket-keys.js 0xabc123
 */

const { Wallet } = require('@ethersproject/wallet');
const { ClobClient, Chain } = require('@polymarket/clob-client');

async function main() {
  const privateKey = process.argv[2] || process.env.POLYMARKET_SIGNER_KEY;
  if (!privateKey) {
    console.error(
      'Provide your Polygon private key as an argument or via POLYMARKET_SIGNER_KEY environment variable.',
    );
    process.exit(1);
  }

  const apiHost = process.env.POLYMARKET_API_HOST || 'https://clob.polymarket.com';
  const rawChainId = Number(process.env.POLYMARKET_CHAIN_ID || Chain.POLYGON);
  const chainId = rawChainId === Chain.AMOY ? Chain.AMOY : Chain.POLYGON;

  const wallet = new Wallet(privateKey);
  const client = new ClobClient(apiHost, chainId, wallet);

  console.log('🔐 Deriving Polymarket API credentials for address:', wallet.address);

  try {
    const nonce = Date.now();
    const credentials = await client.createOrDeriveApiKey(nonce);
    if (!credentials || !credentials.key || !credentials.passphrase || !credentials.secret) {
      console.error('Failed to derive credentials. Response:', credentials);
      process.exit(1);
    }

    console.log('\nSave these values securely (they are only shown once):\n');
    console.log('POLYMARKET_L2_API_KEY=', credentials.key);
    console.log('POLYMARKET_L2_API_SECRET=', credentials.secret);
    console.log('POLYMARKET_L2_API_PASSPHRASE=', credentials.passphrase);
    console.log('\nDone ✅');
  } catch (error) {
    console.error('Unable to derive API credentials:', error.message || error);
    process.exit(1);
  }
}

main();

