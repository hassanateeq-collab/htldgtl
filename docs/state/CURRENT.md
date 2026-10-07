# Current status

**Last updated:** 2026-10-07
**Phase:** 2 — rewrite in progress (see `docs/reviews/2026-10-07-full-review.md`). **Release A (database) done**; Release B (app foundation) next, then C (front-desk flows) and D (operations & settings).
**Current focus:** Release B — typed client, hotel clock, permissions matrix, scoped queries, design system, error codes, toasts, lazy routes.

## Where we are
- **Release A — integrity, business date, data model (2026-10-07).** Six migrations (10–15) applied and mirrored; ADR 0006. Append-only folio with voids (`void_folio_item`, `reopen_folio`, `close_folio`), per-night room charges, tax per property (none / exclusive / inclusive), hotel business day (`property_today`), atomic document numbers (booking / folio / receipt), lifecycle enforced by triggers (ID at check-in, dates window, early departure releases nights, late departure charges them, balance-due block with owner/manager override, credit block, cancel / no-show / reinstate), tenant-safe composite foreign keys, no deletes through money, regenerated policies (one per command, `(select …)`-wrapped), membership and plan-cap guards, phone / CNIC normalisation, cash-shift RPCs, `daily_report`, `room_status_history`, billing job on `pg_cron`. Stable `HD`-class error codes. Regression suites rebuilt with self-contained fixtures: **72 checks, all passing** (`supabase/tests/`). Types regenerated. Demo tenant marked `active` to 2027-12-31 so the billing job never locks the demo. The current app keeps working against the new schema (interim: voided rows hidden) until Release B replaces it.
- **Booking management (2026-10-07).** Migration 9: folio kinds `discount` / `refund` with net totals, advance payment on `create_booking()`, SECURITY INVOKER `update_booking()` (move room, change dates / rate / adults / source / notes; EXCLUDE re-validates; room charge follows; check-in locked in-house). App: **Calendar** — week back/forward, Today, jump-to-date, tap an empty cell to start a booking for that room and night, balance-due dot on bars, desktop range + hint. **Bookings** — "Balance due" group (in-house / departed guests who owe) with the total, Due badge on rows. **New booking** — optional advance payment (amount + method), prefilled from the calendar. **Booking detail** — Edit, Receipt, View guest; folio posting of charge / payment / discount / refund. **Edit booking** screen. **Receipt** — print view using `tenant_branding` (legal name, address, NTN/STRN) with charges/payments columns and PAID / balance footer. **Guests** — searchable list (name / phone) with stays, last stay and amount due; guest detail with editable profile and booking history.
- **Early departure releases the room (2026-10-07).** Migration 8: checking out before the planned date sets the stay's actual end to today on the booking and its room assignment, so the no-double-book constraint frees the remaining nights; same-day departures become zero-night rows (date checks relaxed to `check_out >= check_in`; `create_booking()` still requires ≥ 1 night). The New Booking free-room filter mirrors the constraint exactly. Applied retroactively to CR-1015.
- **Responsive desktop layout (2026-10-07).** Mobile unchanged; at `md`+ a fixed left sidebar (names, nav, New booking), wider content, Today's lists side by side, Rooms as a card grid, two-column detail/New Booking, 28-day calendar at full height.
- **Booking actions live (2026-10-07).** Migration 7: SECURITY INVOKER `create_booking()` and `set_booking_status()`; New Booking screen, detail actions with two-tap confirm, inline Add payment / Add charge, "+" button. Verified live as the demo owner (CR-1015 created → checked in → paid → checked out).
- **Regression suites** (`supabase/tests/`): isolation 37, bookings & folio 26, operations 9 = **72 checks**, self-contained fixtures.
- **App ↔ DB wired:** `/t/<slug>/login`, `set_active_tenant()` claim + JWT refresh, guards, tenant picker; all core screens read through RLS via React Query. Generated DB types in `packages/shared` (client typed in Release B).
- **Database live:** project `hotel-digital` (`wdwvnhqtzeivdylhtwxq`, ap-south-1); fifteen migrations applied + mirrored (`docs/architecture/data-model.md`).
- **Seeded:** platform admin; Paramount Hospitality → Central Residence (4 room types, 17 rooms, 15 bookings, folios); test tenant Seaview. Seed dates relative to 2026-10-06.
- **GitHub:** `hassanateeq-collab/htldgtl` (**public**), main up to date.
- `apps/admin` not scaffolded yet.

## Demo sign-in
- Link (dev server on Hassan's Mac): `http://localhost:5173/t/paramount/login` — hotel code `paramount`.
- Hassan's own account is an owner member of Paramount. Demo owner `owner@demo.test`; dev password in gitignored `supabase/.env.local`. Rotate/remove the demo account before real customers go live.

## Decisions locked with Hassan
- Product **Hotel Digital**; operator **Hamsun**. Fresh start on the new spec; old Next.js prototype left untouched.
- Tooling: npm workspaces; React 18 / Vite 5 / TS 5.6 pinned. **Mobile-first with a desktop tier at `md` (768px)** — one codebase.
- **Reuse the `hotel-digital` Supabase project** ($0 extra).
- Tenancy: common Vercel domain + slug login-link now; subdomains/custom domains later. Active tenant in the JWT via a **SECURITY DEFINER RPC** (no edge function).
- **Write actions as SECURITY INVOKER SQL functions** — RLS applies as the caller; atomic, validated once; stable error phrases mapped to friendly messages.
- **Room availability = the database's EXCLUDE predicate** (anything not cancelled / no-show blocks its nights); early departures truncate the stay rather than relying on status.
- Entitlements: feature flags + plans + overrides. Signup: request → operator approves. Booking engine kept as `addon.booking_engine`. Payment rails incl. Raast.
- Schema refinements: tenant reads require membership; no-show releases the room; child rows derive tenancy via fill triggers; stored folio totals via trigger; trigger functions not RPC-callable.

## Next steps (the rewrite plan, `docs/reviews/2026-10-07-full-review.md` §2)
1. **Release B — app foundation:** typed Supabase client, `useHotelClock()`, `permissions.ts` matrix asserted against the SQL policies, tenant-scoped query factories with server-side scoping, mutations that await invalidation, `HD` error codes → messages, toasts, error boundaries, lazy routes, design tokens and primitives, forms with react-hook-form + zod, Vitest.
2. **Release C — front-desk flows:** Today (expected / arrived / overdue / in-house, quick actions), Rooms board, Calendar, Bookings search + chips, booking detail with check-in / check-out / payment / move / cancel sheets, walk-in, receipt + registration card, guests.
3. **Release D — operations and settings:** housekeeping board, cash handover, daily report, settings (property, tax, room types & rooms, rates, booking, branding, staff).
4. Admin console (`apps/admin`); billing reminders once messaging accounts exist; drop legacy `guests.cnic` / `guests.passport` after Release C; idle lock for shared reception devices.

## For Hassan
- **Enable leaked-password protection** in Supabase → Authentication → Settings.
- The GitHub repo is **public** — consider making it private.
- Central Residence's **real room numbers/counts** (current 17 are assumed).

## Open items (tracked)
- Per-plan / per-add-on PKR prices (seeded at 0, edited in admin).
- Real platform domain.
- `npm audit` findings; route-level code splitting — before first deploy.
- WuBook per-account property limit / partner terms before scaling the channel add-on (ADR 0005).
- Access to `~/hamsun-guest-manager-git` and `~/hamsun-channel-hub` for the Phase 4 WuBook port.
- Resend (email) + whapi (WhatsApp) accounts/credentials.
