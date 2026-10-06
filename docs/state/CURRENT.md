# Current status

**Last updated:** 2026-10-06
**Phase:** 1 — platform skeleton (started); front-desk core screens built on sample data
**Current focus:** The daily front-desk core works end-to-end on mock data at 375px. Next: booking create/edit + check-in/check-out actions, housekeeping and cash-handover screens, then migration 0001 + Supabase project (where the sample becomes the demo-tenant seed).

## Where we are
- **Phase 0 docs approved** by Hassan ("start building", 2026-10-06).
- **Monorepo (npm workspaces)** — installs, typechecks, builds clean.
  - `packages/shared` — feature keys, roles, subscription/payment/booking enums, locale helpers (`formatPKR`, `toPakistanE164`, `formatHotelDate`), and the **i18n layer** (`t()`, `en` messages, `setMessages()` for Urdu later). Every UI string in the app goes through `t()`.
  - `apps/pms` — React 18 + Vite 5 + TS 5.6 + Tailwind v4, React Query + React Router, shadcn-style primitives (`Button`, `Badge`, `Panel`, `StatusBadge`).
- **Screens built (mobile-first, verified in the browser at 375px):**
  - `AppShell` — property header + 5-tab bottom nav (Today, Calendar, Bookings, Rooms, More).
  - **Today** — arrivals / departures / in-house / occupancy KPIs, cash collected today by method, arrivals/departures/in-house lists.
  - **Calendar (tape chart)** — rooms × 14 days, booking bars with mid-cell start/end (same-day turnover never overlaps), today highlight, per-night occupancy in the header, sticky labels/header, status legend. Tap a bar → booking detail.
  - **Bookings** — current & upcoming / past lists. **Booking detail** — guest, stay, notes, folio summary (room charges − payments = balance).
  - **Rooms** — room types with rates and room units with housekeeping status. **More** — placeholders for Guests, Housekeeping, Daily report, Cash handover, Settings.
- **Sample data** (`apps/pms/src/mock/`) — Central Residence by Paramount Hospitality (from Booking.com): 4 room types, 17 rooms; 14 guests, 14 bookings (incl. a no-show and a cancellation), 5 payments; dates relative to today so it always looks live. Room unit counts are assumed. Becomes the demo-tenant DB seed at Phase 1.
- `apps/admin` not scaffolded yet. No Supabase project yet. **Nothing committed yet** (ask before committing).

## Decisions locked with Hassan (2026-10-06)
- Product name **Hotel Digital**; operator **Hamsun**.
- Fresh start on the new spec, separate from the old Next.js prototype in `~/Hotel DIgital 1` (untouched).
- Tooling: **npm workspaces** (pnpm not installed). React 18 / Vite 5 / TS 5.6 pinned.
- Domain: Vercel domain for now (`VITE_PLATFORM_DOMAIN`); real domain TBD.
- Tenancy: common domain + slug login-link now; subdomains + custom domains later (schema ready). Active tenant in the JWT.
- Entitlements: feature flags + plans + per-tenant overrides.
- Signup: self-serve **request → operator approves**.
- Booking engine: **kept** as `addon.booking_engine` (pay-at-hotel).
- Payment rails: bank transfer, Raast, JazzCash, Easypaisa, cash.

## Build approach (agreed)
Skeleton → mock the core PMS screens in-repo with sample data (so there's something to see/demo fast, and it becomes the real UI) → wire each screen to real data behind RLS, vertically. Tenancy/RLS foundation written and tested early. Booking engine + WuBook are Phase 4.

## Next steps
1. Booking **create / edit** (guest, room type → room, dates, source) and **check-in / check-out / no-show** actions on Today and detail — still on mock state.
2. **Housekeeping** board and **cash handover** screens (core features), **daily report**.
3. `supabase init` + **migration 0001** (tenancy + billing core, helpers, RLS, seed) mirrored to `supabase/migrations/`; A↔B isolation test suite.
4. Stand up the Supabase project (confirm ~$10/mo, or reuse the dead `hotel-digital` project `wdwvnhqtzeivdylhtwxq`) → apply migration → seed Central Residence as the demo tenant.
5. Wire the pms screens to Supabase (React Query) behind RLS; scaffold `apps/admin` and build the operator console (create tenant → plan → record payment → approve signup).

## Open items (tracked)
- Per-plan / per-add-on PKR prices (seeded at 0, edited in admin).
- Real platform domain.
- Central Residence's **real room numbers/counts** (current ones are assumed).
- `npm audit`: 4 vulnerabilities reported at install (3 moderate, 1 high) — review before first deploy.
- WuBook per-account property limit / partner terms before scaling the channel add-on (ADR 0005).
- Access to `~/hamsun-guest-manager-git` and `~/hamsun-channel-hub` for the Phase 4 WuBook port.
- Resend (email) + whapi (WhatsApp) accounts/credentials.
