# ADR 0005 — One WuBook account for the whole platform

**Status:** Accepted — 2026-10-06
**Deciders:** Hassan Ateeq, Claude

## Context
The channel-manager add-on syncs availability/rates to OTAs (Booking.com, Agoda, Airbnb) via WuBook's Wired API (XML-RPC). A working integration already exists in Hamsun's `channel-hub` and should be **ported, not rewritten**.

## Decision
The platform holds **one** WuBook account and a single Wired API token (in Supabase Vault). Each property that buys `addon.channel_wubook` is a **separate WuBook property (`lcode`)** under that one account, mapped by `properties.wubook_lcode`. The operator creates the property in WuBook and sets the `lcode` from the admin console. Customers never see WuBook credentials or UI.

- The PMS is the **inventory authority**: it pushes availability/rates to WuBook; OTA reservations flow back onto the calendar.
- **Direct bookings (our booking engine) are not pushed into WuBook as reservations** — that needs WuBook's booking-engine subscription. Direct bookings decrement our inventory, which then pushes availability to WuBook.
- `cm_*` tables (ported from Hamsun) gain `tenant_id` + `property_id`; the availability-queue trigger fires only for properties with the flag enabled. The per-tenant sync log is visible in the tenant app; raw XML-RPC errors are visible only in the admin console.

## Port source (Phase 4)
- `~/hamsun-guest-manager-git/supabase/functions/channel-hub/{index.ts,xmlrpc.ts}` — proven live 2026-10-06 (connect, room/plan sync, 365-day availability push + read-back, push activation, fetch/mark reservations, import with dedupe, price mirror). **Not yet exercised there:** brand-new reservation end-to-end, modification, cancellation, price/restriction pushes — budget test time for these.
- `~/hamsun-channel-hub/src` — the rates/availability grid UI (Vite) to adapt into `apps/pms` behind the flag.
- The live Hamsun `cm_*` DDL is in its Supabase project, not in git — ask Hassan to export it when porting.

## Open risk
A single **regular** WuBook account may cap how many properties it can hold; the corporate/partner model exists to solve this at scale. **Confirm per-account property limits / partner terms before onboarding many channel customers.** Tracked in `docs/state/CURRENT.md`.

## Consequences
- No per-customer WuBook credentials to manage; one token to rotate.
- The operator is the channel middleman (white-glove) while ≤30 properties — acceptable, and matches the positioning.
