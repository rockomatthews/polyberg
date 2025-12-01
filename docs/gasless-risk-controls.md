# Gasless Safe Risk Controls

## Operator Guardrails
- **Kill switch**: set `AUTONOMY_DISABLED=true` to stop cron + manual runs instantly. API + UI surface the flag, and strategy engine returns `skipped` results until cleared.
- **Trading arming**: keep `AUTONOMY_TRADING_ENABLED=false` for simulation. Execution code short-circuits and logs every skipped intent when the flag is unset.
- **Safe enforcement**: `POLYMARKET_REQUIRE_SAFE=true` blocks /orders and autonomy execution until a Safe is deployed. Users see actionable status + CTA.

## Monitoring & Logging
- Safe onboarding logs `safe.request.start/complete` events and caches status in Redis for dashboards.
- Relayer responses (task ids, transaction hashes, Safe states) are stored in Postgres metadata for later audits.
- Strategy engine + executor emit structured logs for skipped runs (kill switch, missing Safe, disabled trading) so alerts can key off them.

## Custody + Access Control
- Builder/API/L2 credentials remain server-side; the browser never sees keys.
- Relayer endpoints are only reachable by authenticated server routes (`getServerSession` enforced everywhere).
- Each user’s Safe lives in `user_safes` with timestamps, status, and ownership type to track custody responsibilities.

## Emergency Playbook
1. Flip `AUTONOMY_DISABLED=true` to freeze automation.
2. If trades still need to be blocked, unset `AUTONOMY_TRADING_ENABLED` so executor simulates only.
3. Optionally revoke Safe usage by clearing `POLYMARKET_REQUIRE_SAFE` and removing per-user Safes in Postgres once funds are withdrawn.

