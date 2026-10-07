# Current status

**Last updated:** 2026-10-08
**Phase:** 2 — rewrite (see `docs/reviews/2026-10-07-full-review.md`). **Releases A, B, C and D are built and verified in the browser at 375 px and desktop.** Next: admin console, staff invitations, idle lock, WuBook port.
**Current focus:** polish from real use by Hassan; then `apps/admin`.

## Where we are
- **Releases B–D — the app rewrite (2026-10-08).** `apps/pms` rebuilt on the Release A schema:
  - **Foundation:** typed Supabase client (`createClient<Database>`), hotel clock (`useHotelToday`, `lib/clock.ts`, never the device date), `permissions.ts` abilities + `can()`, tenant/property-scoped query keys with server-side filtering, search and paging over `v_bookings` / `v_guests` / `v_rooms_board` (migration 16), `tenant_members()` (17), mutations that await invalidation, `HD` error codes → friendly messages (`lib/errors.ts`), toasts (sonner), `ScreenErrorBoundary`, lazy routes, design tokens in OKLCH with semantic status / housekeeping / money roles, 44 px targets, Sheet = vaul drawer on phones / Radix dialog on desktop, `PageHeader` driving the mobile top bar, centre **New** tab (walk-in / new booking) instead of a floating button.
  - **Front desk:** Today (KPIs incl. due / collected / free tonight, *Needs attention* for late arrivals and overstays, quick check-in / check-out / collect), Rooms board + room sheet (status, walk-in here, book here), Bookings (search, filter chips in the URL, grouped list, paging), Calendar (two-week window, HK dot, hatched no-shows, tap a cell to book), Booking detail (guest / stay / folio cards, overflow menu, state-driven action bar), **Check-in sheet** (room readiness, ID capture, early *and late* arrival handling, deposit), **Check-out sheet** (projected balance incl. early / late departure, collect or refund, owner/manager override with reason, print), add charge / payment / discount / refund, void with reason, reopen / close folio, move room, cancel / no-show / reinstate, New booking + walk-in (phone-first guest lookup, room picker that never substitutes silently, deposit, create-and-check-in), Edit booking, Receipt / statement and registration card print views, Guests list + detail with ID editing.
  - **Operations & settings:** Housekeeping board, Cash handover (open / close / confirm with per-method counts and discrepancy, history), Daily report (date nav, share text), Settings: property + tax + policies, room types & rooms, booking prefixes & quick charges, receipts & branding, staff roles.
  - Verified live as the demo owner on 2026-10-08: late arrival checked in with ID (dates moved to tonight, room nights re-posted), minibar charge, same-day check-out collecting the full first night, receipt; walk-in created and checked in; cash shift opened, closed and handed over; sign-out / sign-in.
- **Minimum one night (2026-10-08).** Migration 19 (`20261008003000_minimum_one_night.sql`, ADR 0006 addendum): early departure releases unstayed nights only from `greatest(today, check_in + 1)`, so a same-day departure still pays its first night. Suites updated and **green: isolation 37 · bookings & folio 26 · operations 9 = 72**. Suites now take dates from the hotel day (`property_today`), not `current_date` — see `supabase/tests/README.md`.
- **Release A — integrity, business date, data model (2026-10-07).** Migrations 10–15; ADR 0006. Append-only folio with voids, per-night room charges, tax per property, hotel business day, atomic document numbers, lifecycle enforced by triggers, tenant-safe composite FKs, no deletes through money, regenerated RLS policies, cash-shift RPCs, `daily_report`, `room_status_history`, billing job on `pg_cron`.
- **Database live:** project `hotel-digital` (`wdwvnhqtzeivdylhtwxq`, ap-south-1); nineteen migrations applied + mirrored (`docs/architecture/data-model.md`). Demo tenant marked `active` to 2027-12-31.
- **Seeded:** platform admin; Paramount Hospitality → Central Residence (4 room types, 17 rooms, bookings, folios); test tenant Seaview. Seed dates relative to 2026-10-06.
- **GitHub:** `hassanateeq-collab/htldgtl` (**public**).
- `apps/admin` not scaffolded yet.

## Demo sign-in
- Link (dev server on Hassan's Mac): `http://localhost:5173/t/paramount/login` — hotel code `paramount`.
- Hassan's own account is an owner member of Paramount. Demo owner `owner@demo.test`; dev password in gitignored `supabase/.env.local`. Rotate/remove the demo account before real customers go live.

## Decisions locked with Hassan
- Product **Hotel Digital**; operator **Hamsun**. Fresh start on the new spec; old Next.js prototype left untouched.
- Tooling: npm workspaces; React 18 / Vite 5 / TS 5.6 pinned. **Mobile-first with a desktop tier at `md` (768px)** — one codebase.
- **Reuse the `hotel-digital` Supabase project** ($0 extra).
- Tenancy: common Vercel domain + slug login-link now; subdomains/custom domains later. Active tenant in the JWT via a **SECURITY DEFINER RPC** (no edge function).
- **Write actions as SECURITY INVOKER SQL functions** — RLS applies as the caller; atomic, validated once; stable `HD` error codes mapped to messages (never message text).
- **The database owns the rules** (ADR 0006): append-only folio, lifecycle triggers, hotel day, minimum one night, balance-due block with owner/manager override.
- **Room availability = the database's EXCLUDE predicate**; early departures truncate the stay.
- Product defaults: tax per property (none / exclusive / inclusive), early departure releases unstayed nights (policy), ID required at check-in (setting), same-day departure charges one night.
- Entitlements: feature flags + plans + overrides. Signup: request → operator approves. Booking engine kept as `addon.booking_engine`. Payment rails incl. Raast.

## Next steps
1. Hassan uses the app for a few days at Central Residence; fix what real use surfaces.
2. **Admin console** (`apps/admin`): tenants, plans, subscriptions, manual payments, signup requests.
3. **Staff invitations** (edge function + email) — today Hamsun adds accounts; **idle lock** for shared reception devices.
4. Vitest unit tests for `clock`, `errors`, `permissions` (matrix vs SQL); CI workflow running typecheck, lint, tests.
5. Drop legacy `guests.cnic` / `guests.passport`; dark-mode toggle (tokens are ready); Urdu strings.
6. Phase 4: WuBook port (ADR 0005), WhatsApp / email messaging.

## For Hassan
- **Enable leaked-password protection** in Supabase → Authentication → Settings.
- The GitHub repo is **public** — consider making it private.
- Central Residence's **real room numbers/counts** (current 17 are assumed).
- Note the new rule: a guest who checks in and leaves the same day is charged one night.

## Open items (tracked)
- Per-plan / per-add-on PKR prices (seeded at 0, edited in admin).
- Real platform domain.
- `npm audit` findings — before first deploy.
- WuBook per-account property limit / partner terms before scaling the channel add-on (ADR 0005).
- Access to `~/hamsun-guest-manager-git` and `~/hamsun-channel-hub` for the Phase 4 WuBook port.
- Resend (email) + whapi (WhatsApp) accounts/credentials.
