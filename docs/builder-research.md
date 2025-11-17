# Polymarket Builder Program Research

## Overview
- Polymarket’s Builder Program targets third parties who route customer orders through their own interfaces into the Polymarket CLOB, delivering the foundation for a Bloomberg-style terminal experience for traders [Builder Intro](https://docs.polymarket.com/developers/builders/builder-intro).
- Builders benefit from Polygon relayer access (gasless Safe Wallet transactions) and order attribution headers so high-volume platforms can receive recognition and potential grants via the upcoming leaderboard [Builder Intro](https://docs.polymarket.com/developers/builders/builder-intro).

## Key Capabilities & Constraints
- **Polygon Relayer**: Builders can submit trades through Polymarket’s infrastructure while Polymarket funds gas when Safe Wallets are used. This informs our execution layer design (custodial vs user-vaulted wallets) and reduces UX friction for rapid sniping [Builder Intro](https://docs.polymarket.com/developers/builders/builder-intro).
- **Safe Wallet Deployment**: We can programmatically spin up Safe accounts per trader, maintaining custody controls and enabling multi-sig or policy locks for treasury/risk governance.
- **Trading Attribution Headers**: Each order must include builder-specific headers so Polymarket can attribute fills to our platform, which doubles as analytics metadata for internal monitoring.
- **Builder Keys & Signing Server**: We’ll need a secure signing service that holds builder keys to sign attribution headers (per doc references to Builder Keys and Signing Server guides). This enforces separation between frontend clients and sensitive credentials.
- **Relayer Client Libraries**: Official TypeScript and Python packages accelerate integration, especially for the Next.js backend and any off-platform worker processes.

## Compliance & Operational Considerations
- Enforce whitelisted frontends and server-to-server communication so only authenticated strategy components can leverage builder privileges.
- Maintain audit logs for every relayed transaction, including payload, attribution headers, and relayer responses, to satisfy grant eligibility and debugging.
- Design fallback paths (direct Polygon submission) if relayer downtime occurs, with explicit user messaging about gas responsibility switching.

## Next Steps
1. Register as a Builder, obtain keys, and document operational runbooks for key rotation.
2. Stand up the signing server early in development to integrate attribution headers in all API calls.
3. Collaborate with Polymarket to understand rate limits/SLA of the relayer so the sniping engine can pace requests accordingly.

