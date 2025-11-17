# Strategy & Execution Engine Specification

## Goals
- Identify and execute profitable snipes (pricing inefficiencies, liquidity gaps, sudden fundamental updates) with minimal latency.
- Maintain rigorous risk controls, attribution compliance, and observability for every submitted order.

## Architecture
```
Live Data Bus (Redis Streams) ➜ Signal Engine ➜ Opportunity Evaluators ➜
Risk Gatekeeper ➜ Execution Router ➜ Polymarket Relayer
```

### Signal Engine
- Consumes normalized market data and positions from Postgres or Redis.
- Supports plug-in modules:
  - **Spread Hunter**: monitors bid/ask spread vs theoretical fair value.
  - **Momentum/Event**: ingests external signals (news, social sentiment) and triggers directional entries.
  - **Liquidity Vacuum**: detects when resting liquidity disappears and anticipates price jumps.
- Emits `Opportunity` objects containing market/outcome, target side, size, limit price, confidence score, and expiry.

### Risk Gatekeeper
- Evaluates each opportunity against:
  - Exposure limits per market/outcome.
  - Wallet free balance and treasury policy (per Safe wallet).
  - User-defined kill switches (e.g., suspend strategy during maintenance).
- Computes risk-adjusted size and logs overrides.

### Execution Router
- Converts approved opportunities into Polymarket order payloads.
- Supports routing policies:
  - **Immediate Aggressive**: cross the spread up to a slippage ceiling.
  - **Passive Posting**: place resting orders that improve the book.
  - **Iceberg**: break orders into child slices to avoid detection.
- Manages retries/backoff and fallback routing (direct Polygon RPC) if relayer fails.

## Relayer Integration
- Use the official TypeScript `@polymarket/builder-relayer-client` in the Next.js backend worker to submit orders via the Polygon relayer, leveraging gasless execution when Safe Wallets are used [Builder Intro](https://docs.polymarket.com/developers/builders/builder-intro).
- Include builder attribution headers on all POST requests so Polymarket credits the platform and leaderboard metrics stay accurate [Builder Intro](https://docs.polymarket.com/developers/builders/builder-intro).
- Safe Wallet lifecycle:
  1. Deploy Safe per trader via relayer API.
  2. Fund wallets using treasury policy.
  3. Store Safe addresses in Postgres `wallets` table along with signer metadata.
- Signing server:
  - Runs in a hardened environment (e.g., AWS Nitro enclave or managed HSM) holding builder keys.
  - Signs attribution headers and sensitive relayer payloads via REST RPC to the strategy engine.
  - Enforces rate limits and audit logs for every signing request.

### Failure Handling
- Detect relayer downtime via heartbeat endpoint; switch to direct Polygon transactor with explicit user notification about gas fees.
- Queue pending orders with expiry and attempt replay once relayer recovers.
- Persist execution logs (`orders`, `fills`, `errors`) for reconciliation and grant reporting.

## Observability & Controls
- Structured logging with correlation IDs from signal ➜ execution ➜ relayer response.
- Metrics: hit rate, average slippage, order latency histogram, relayer error codes.
- Alerting: Slack/Webhook when risk limits breached or relayer rejects >X orders in Y minutes.

