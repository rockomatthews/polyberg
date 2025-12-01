# Gasless Safe Rollout Plan

## Phase 0 – Internal QA
- Use builder creds + staging relayer to request Safes for test accounts.
- Exercise Safe status API, trade ticket gating, and autonomy panel alerts.
- Monitor logs for `safe.request.*` and `strategies.safe.unavailable` to ensure telemetry flows.

## Phase 1 – Invite-only Beta
- Enable `POLYMARKET_REQUIRE_SAFE=true` and keep `AUTONOMY_TRADING_ENABLED=false`.
- Hand out dashboard access to a handful of power users; walk them through the Safe request CTA.
- Collect feedback on onboarding copy + watchlist relevance and verify relay pays gas for their snipes.

## Phase 2 – Public Launch
- Flip `AUTONOMY_TRADING_ENABLED=true` once funds land in operator Safe and kill switch remains off.
- Announce “gasless sniping” in product marketing + Discord; highlight no private keys required.
- Add pricing blurb (eg. 15% performance fee or maker spread share) to FAQ.

## Ongoing Ops
- Keep `docs/gasless-risk-controls.md` handy for incident response.
- Set up alerts on relayer failures, Safe deployment errors, and stale Safe statuses (>10 min old).
- Review autonomy run logs daily; export notable wins for social proof.

