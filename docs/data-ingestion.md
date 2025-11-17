# Data Ingestion & Storage Blueprint

## Objectives
- Deliver sub-second market visibility for sniping workflows.
- Normalize heterogeneous Polymarket feeds (REST, websockets, historical snapshots) into consistent storage.
- Provide durable history for analytics plus low-latency caches for UI/strategy components.

## Source Inventory
1. **Markets REST API** (metadata, outcomes, fees) — refreshed every 60s or on webhook-like change events.
2. **Order Book Websocket** — streamed per market with depth subscription controls; primary feed for sniping.
3. **Trades/Fills Feed** — records executed swaps for PnL and liquidity analytics.
4. **Liquidity Events** — new market creation, resolution updates, liquidity additions/removals.

## Pipeline Architecture
```
Websocket/REST sources ➜ Ingestion Workers (Edge Functions) ➜
Redis Streams (Upstash) ➜ Normalizer Service ➜ Postgres (Neon) + Hot Caches
```

### Ingestion Workers
- Hosted as Vercel Edge Functions (Deno runtime) for proximity to gateways.
- Maintain persistent websocket connections with automatic resubscribe logic and exponential backoff.
- Publish raw payloads into Redis Streams with topic partitioning (`markets`, `orderbook:<marketId>`, `trades`).

### Normalizer Service
- Runs as a background worker (Vercel scheduled function or Fly.io app) that consumes Redis Streams, validates payload signatures, and enriches data (timestamps, derived metrics).
- Deduplicates messages using Redis bloom filters and sequence numbers to avoid replayed ticks.
- Writes normalized rows into Postgres via batched inserts to minimize connection churn.

## Storage Design (Neon Postgres)

### Core Tables
| Table | Purpose | Key Columns |
| --- | --- | --- |
| `markets` | Static + dynamic metadata | `market_id (PK)`, `question`, `status`, `fee_bps`, `end_ts` |
| `outcomes` | Outcome legs per market | `outcome_id (PK)`, `market_id (FK)`, `name`, `tokens` |
| `order_books` | Point-in-time depth snapshots | `id`, `market_id`, `side`, `price`, `size`, `sequence`, `captured_at`, TTL partition |
| `quotes_live` | Latest top-of-book per market | `market_id (PK)`, `bid_price`, `bid_size`, `ask_price`, `ask_size`, `updated_at` |
| `fills` | Executed trades | `fill_id`, `market_id`, `outcome_id`, `side`, `price`, `size`, `tx_hash`, `builder_header` |
| `positions` | User-level holdings | `position_id`, `user_id`, `outcome_id`, `qty`, `avg_price`, `pnl` |
| `alerts` | User watch/alert rules | `alert_id`, `user_id`, `market_id`, `condition`, `threshold`, `status` |
| `derived_metrics` | Rolling stats (volatility, liquidity) | `metric_id`, `market_id`, `metric_type`, `value`, `window` |

### Sample Schema Snippet
```sql
CREATE TABLE order_books (
  id BIGSERIAL PRIMARY KEY,
  market_id TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  side TEXT CHECK (side IN ('bid','ask')),
  price NUMERIC(18,6) NOT NULL,
  size NUMERIC(24,6) NOT NULL,
  sequence BIGINT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (captured_at);
```

### Caching Strategy
- `quotes_live` mirrored into Upstash Redis hash for millisecond UI reads.
- Order book ladders stored as Redis sorted sets keyed by market/side.
- Set TTL on deep history partitions (>30 days) moving to cold storage (S3) for analytics.

## Reliability & Monitoring
- Use heartbeats per feed; alert if no ticks within configurable window.
- Persist last processed sequence in Postgres `ingestion_offsets` table for restart continuity.
- Instrument latency (`source_ts → DB commit`) and drop rate metrics exposed via Grafana dashboards.

