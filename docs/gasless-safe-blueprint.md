# Gasless Safe Sniping Blueprint

## Value Proposition
- Deliver a terminal that lets users snipe Polymarket markets without handling private keys or paying gas.
- Builder deploys and operates user-specific Safes through the Polymarket relayer; all trades settle through these custodial wallets.
- Users focus on strategy (manual or autonomous) while the platform manages custody, execution, and fees.

## Customer Journey
1. **Request Safe** – User clicks “Enable gasless trading” on profile; backend queues a deploySafe job via relayer.
2. **Safe Deployment** – Relayer spins up a Safe funded/authorized under the builder account; gas costs absorbed by program.
3. **Ready State** – UI shows Safe address, balances, status (pending/ready/error). User can copy address, view explorer links.
4. **Trading** – Manual ticket, AI strategies, and cron exits submit intents that execute via `executeSafeTransactions` instead of user keys.
5. **Monitoring & Withdrawal** – Users can view historical activity, disable autonomy, or request withdrawal to personal wallets.

## Services & Data Model
- **Safe Registry (Postgres)**: `user_safe(id, user_id, safe_address, status, deployed_at, last_synced_at, metadata jsonb)`.
- **Safe Cache (Redis)**: `safe:status:<userId>` for quick profile loads and autonomy gating.
- **Relayer Client Wrapper**: singleton that knows builder creds + signer; exposes `deployUserSafe`, `executeSafeOrder`, `querySafeBalance`.
- **Autonomy Integration**: strategy engine checks Safe readiness before submitting intents; records safe_id on run logs.

## APIs
- `POST /api/profile/request-safe` → enqueue deployment, return job id/status.
- `GET /api/profile/safe-status` → returns Safe metadata, balances, relayer health.
- `POST /api/polymarket/orders` → updated to route through Safe executor when available, fallback to builder wallet otherwise.
- `POST /api/autonomy/run` → ensures Safe ready before executing.

## UI/UX
- Profile Account card displays Safe status with CTA (request, pending, active, error) and explains gasless benefit.
- Trade ticket banner indicating “Orders execute from your Safe (gasless)”; disable ticket if Safe missing.
- Strategy Admin shows Safe status + toggles for allowing autonomy to use Safe.
- Onboarding modal describing custody implications and opt-in terms.

## Security & Ops
- All L2/builder credentials stay server-side; no local storage in browser.
- Logging for every relayer call (deploy + execute) with correlation id; alerting on failures.
- Emergency kill switch: env flag to disable Safe trading + cron jobs.
- Audit trail: store executed relayer tx hashes + order ids for dispute resolution.

## Rollout Notes
- Phase 1: internal testing with sandbox users; manual Safe deploy via admin script.
- Phase 2: limited beta – invite-only Safe requests, monitor relayer load, collect UX feedback.
- Phase 3: GA – expose “Enable gasless trading” to all, market the feature, add pricing (subscription or performance fee on profits).
