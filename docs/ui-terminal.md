# Trader Terminal UI & Interaction Design

## Design Principles
- Desktop-first Bloomberg-style workspace optimized for dense information, keyboard-driven workflows, and low-latency rendering.
- Built with Next.js App Router + Material UI (MUI v6) to leverage server components, theming, and composable layout primitives.
- Real-time data via React Query + WebSocket hooks; optimistic updates for snipes.

## Layout Blueprint
```
┌────────────────────────────────────────────────────────────┐
│ Global App Bar (search, account, latency indicator)        │
├──────────────┬──────────────────────────┬──────────────────┤
│ Watchlists   │ Order Book / Depth View  │ Positions / PnL  │
│ & Markets    │ + Trade Ticket           │ + Order Blotter  │
├──────────────┴──────────────────────────┴──────────────────┤
│ Alerts & News Ticker | Historical Chart | Activity Feed    │
└────────────────────────────────────────────────────────────┘
```

### Workspaces & Panels
- **Watchlist Grid (`<MarketGrid />`)**: Virtualized table showing prices, spread, liquidity, event timers, custom tags. Supports multi-select + drag into ladder.
- **Order Book Ladder (`<DepthLadder />`)**: Dual-column ladder with color-coded liquidity heatmap, keyboard navigation, and inline quick-size chips.
- **Trade Ticket (`<SniperTicket />`)**: Mode toggle (Aggressive/Passive), price knobs, quantity presets, hotkeys (e.g., `Shift+Enter` submit).
- **Positions & Blotter (`<PortfolioPane />`)**: Real-time PnL, exposure bars, execution history with filter chips.
- **Alerts Center (`<AlertDrawer />`)**: Rule list + creation modal, toggles for push/email/webhook.
- **Activity Feed**: Stream of fills, news, protocol notifications.

## Interaction Flows
1. **Market Scan → Snipe**
   - User selects market(s) in watchlist, pushes to ladder.
   - Ladder auto-focuses; user adjusts price via scroll/arrow keys, selects size hotkey, submits.
   - Confirmation toast with fill progress + ability to modify/cancel.
2. **One-Click Re-entry**
   - From blotter, user hits `R` to reload same order params into ticket.
3. **Alert-to-Action**
   - Alert fires (spread crossed threshold); inline notification centers ladder on relevant market.

## State Management
- React Query handles server cache (markets, positions) with normalized keys.
- Zustand store for UI-local ephemeral state (selected panels, hotkeys, theme).
- WebSocket hook pushes order book deltas directly into ladder store for <100ms renders.

## Component System & Theming
- Use Material UI theme overrides for dark terminal palette, typography reminiscent of trading terminals.
- Provide layout primitives (`<DockPanel />`, `<SplitPane />`) for draggable/resizable panes; persist layout via local storage + server sync.
- Keyboard shortcut manager (`<HotkeyProvider />`) centralizes command palette + focus management.

## Accessibility & Feedback
- High-contrast color ramps meeting WCAG AA even in dense tables.
- All hotkey actions mirrored with clickable controls/tooltips.
- Inline latency indicator (green/yellow/red) tied to order round-trip metrics.

## Next.js Integration
- Use App Router for streaming server components; server actions submit trade instructions to backend API routes wrapping the relayer.
- Edge-ready API routes for read-heavy endpoints (watchlist, quotes) and Node runtimes for execution endpoints requiring signing server access.

