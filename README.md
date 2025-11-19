## Overview

Polymarket Snipes is a Bloomberg-style terminal for routing builder flow to Polymarket’s CLOB via the Builder Program. The app is a Next.js (App Router) workspace styled with Material UI and powered by React Query + Zustand for realtime state.

## Environment Setup

Create a `.env.local` in the project root before running the dev server. At minimum, configure the public CLOB endpoint; to unlock authenticated builder data and relayer support, also provide the Builder signer + API credentials.

```bash
POLYMARKET_API_HOST=https://clob.polymarket.com
POLYMARKET_CHAIN_ID=137

# Optional L2 / user auth for open orders + balances
POLYMARKET_L2_API_KEY=...
POLYMARKET_L2_API_SECRET=...
POLYMARKET_L2_API_PASSPHRASE=...

# Builder signing (remote signing server recommended)
POLYMARKET_BUILDER_SIGNER_URL=https://your-signing-service.example.com/sign
POLYMARKET_BUILDER_SIGNER_TOKEN=optional-auth-header
# or local builder creds if you must keep keys in-app
POLYMARKET_BUILDER_API_KEY=...
POLYMARKET_BUILDER_API_SECRET=...
POLYMARKET_BUILDER_API_PASSPHRASE=...

# Polygon relayer (gasless Safe execution)
POLYMARKET_RELAYER_URL=https://relayer.polymarket.com
POLYMARKET_RELAYER_CHAIN_ID=137
POLYMARKET_SAFE_ADDRESS=0xYourSafe
POLYMARKET_RELAYER_RPC_URL=https://polygon-rpc.com
POLYMARKET_RELAYER_PRIVATE_KEY=0xyourexecutorprivkey
# Optional dedicated key for signing CLOB orders (falls back to relayer key)
POLYMARKET_ORDER_SIGNER_PRIVATE_KEY=0xyourordersignerkey

# Google Auth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=generate_a_strong_random_string
# Neon Postgres
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
# Upstash Redis
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
# Vercel AI Gateway
VERCEL_AI_API_KEY=...
```

All env vars are validated at boot via `src/lib/env.ts`. Missing optional values simply disable the dependent widgets (positions, blotter, etc.) until credentials are supplied.

### Builder Relayer client

The backend now wraps [`@polymarket/builder-relayer-client`](https://github.com/Polymarket/builder-relayer-client) so you can manage Safe approvals and batched executions from the UI layer. Supply the RPC URL + private key of a Safe owner (or automation key) so the Relay client can sign payloads before forwarding them to the Polygon relayer.

REST endpoints you can call (all under `/api/relayer`):

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/relayer/transactions` | GET | Lists relayer transactions submitted by this builder |
| `/api/relayer/deploy` | POST | Deploys a Safe through the relayer |
| `/api/relayer/execute` | POST | Executes arbitrary Safe transactions (body = `{ transactions: [{ to, data, value?, operation? }] }`) |
| `/api/relayer/approval` | POST | Convenience endpoint to approve an ERC20 spend (`{ tokenAddress, spenderAddress, amount? }`) |

Under the hood we follow the same patterns showcased in Polymarket’s repo—see the Quick Start and approval examples in the official docs for additional context [builder-relayer-client](https://github.com/Polymarket/builder-relayer-client).

### Persistence & Caching

- **Neon Postgres**: provisioned via Vercel Storage. `DATABASE_URL` powers `@neondatabase/serverless` in `src/lib/db.ts`, and `ensureUserRecord` (`src/lib/services/userService.ts`) keeps a `users` table in sync when traders sign in.
- **Upstash Redis**: provisioned alongside Neon. `UPSTASH_REDIS_REST_URL`/`TOKEN` feed `src/lib/redis.ts`, and the market/order book fetchers will cache results for a few seconds to reduce load on the Polymarket APIs.
- **Vercel AI Gateway**: `VERCEL_AI_API_KEY` drives `/api/ai/suggestions`, which powers the upcoming “Strategy Copilot” surface.

## Local Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Deployment

Deploy straight to Vercel; the project is App-Directory compatible and uses the built-in MUI Next.js cache provider so zero extra plumbing is required. Remember to mirror your `.env.local` secrets inside the Vercel project settings before promoting to production.
# polyberg
