# Current status

**Last updated:** 2026-10-07
**Phase:** 2 — core PMS: front-desk actions live, responsive desktop tier, early-departure rule
**Current focus:** Housekeeping board, cash handover and daily report (the remaining core control screens), then the admin console.

## Where we are
- **Early departure releases the room (2026-10-07).** Migration 8: checking out before the planned date sets the stay's actual end to today on the booking and its room assignment, so the no-double-book constraint frees the remaining nights; same-day departures become zero-night rows (date checks relaxed to `check_out >= check_in`; `create_booking()` still requires ≥ 1 night). The New Booking free-room filter mirrors the constraint exactly. Applied retroactively to CR-1015.
- **Responsive desktop layout (2026-10-07).** Mobile unchanged; at `md`+ a fixed left sidebar (names, nav, New booking), wider content, Today's lists side by side, Rooms as a card grid, two-column detail/New Booking, 28-day calendar at full height.
- **Booking actions live (2026-10-07).** Migration 7: SECURITY INVOKER `create_booking()` and `set_booking_status()`; New Booking screen, detail actions with two-tap confirm, inline Add payment / Add charge, "+" button. Verified live as the demo owner (CR-1015 created → checked in → paid → checked out).
- **Regression suites** (`supabase/tests/`): platform 15, operational 11, booking actions 6 = **32 checks**, computing expectations at run time.
- **App ↔ DB wired:** `/t/<slug>/login`, `set_active_tenant()` claim + JWT refresh, guards, tenant picker; all core screens read through RLS via React Query. Generated DB types in `packages/shared` (client not yet generic-typed).
- **Database live:** project `hotel-digital` (`wdwvnhqtzeivdylhtwxq`, ap-south-1); eight migrations applied + mirrored (`docs/architecture/data-model.md`).
- **Seeded:** platform admin; Paramount Hospitality → Central Residence (4 room types, 17 rooms, 15 bookings, folios); test tenant Seaview. Seed dates relative to 2026-10-06.
- **GitHub:** `hassanateeq-collab/htldgtl` (**public**). Early-departure fix to be committed next.
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

## Next steps
1. **Housekeeping board** — rooms by status with one-tap clean/dirty/inspected/out-of-order updates (housekeeping role), today's departures flagged.
2. **Cash handover** — shift declaration per method, next-shift confirmation, discrepancy on the daily report.
3. **Daily report** — arrivals, departures, occupancy, cash by method.
4. **Admin console** (`apps/admin`): provision tenant, plans/add-on overrides, record payments, approve signup requests, audit views.
5. Type the client with the generated `Database` type; route-level code splitting (~500 KB bundle warning).
6. Billing job (`pg_cron` daily 06:00 PKT) + reminders. Folio credits/adjustments for early departures. Demo-data freshness helper.

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
