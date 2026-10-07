# Current status

**Last updated:** 2026-10-07
**Phase:** 2 — core PMS: front-desk actions live; **responsive desktop tier added**
**Current focus:** Early-departure fix (check-out before the planned date must release the room), then housekeeping board, cash handover, daily report, then the admin console.

## Where we are
- **Responsive desktop layout (2026-10-07).** Mobile (< 768px) is unchanged: top bar, bottom tabs, floating "+". Desktop (≥ `md`): fixed left sidebar with property names, vertical nav and a New booking button; no top bar/tabs; content widens to `md:max-w-5xl`; Today shows 4 KPIs in a row with arrivals / departures / in-house side by side; Bookings' two groups side by side; Rooms as a 2–3 column card grid; booking detail and New Booking in two columns; the Calendar shows **28 days** at full viewport height (`useIsDesktop()` hook). Verified in the browser at desktop and phone widths.
- **Booking actions live (2026-10-07).** Migration 7: SECURITY INVOKER `create_booking()` (optional new guest, number from `tenant_settings.booking_prefix` + series, room under the no-double-book constraint, room charge auto-posted) and `set_booking_status()` (allowed transitions; check-out blocked while balance due, then folio closed + room dirty). App: New Booking screen (returning-guest search, free-room filter, base rate default, live total), detail actions with two-tap confirm, inline Add payment / Add charge, "+" button. Verified live as the demo owner: CR-1015 created → checked in → PKR 15,000 cash → checked out (now in the demo data). Folio timestamps format in local time.
- **Regression suites** (`supabase/tests/`): platform 15, operational 11, booking actions 5 = **31 checks**, computing expected counts / next number at run time.
- **App ↔ DB wired:** `/t/<slug>/login`, `set_active_tenant()` claim + JWT refresh, guards, tenant picker; all core screens read through RLS via React Query. Generated DB types in `packages/shared` (client not yet generic-typed).
- **Database live:** project `hotel-digital` (`wdwvnhqtzeivdylhtwxq`, ap-south-1); seven migrations applied + mirrored (`docs/architecture/data-model.md`).
- **Seeded:** platform admin; Paramount Hospitality → Central Residence (4 room types, 17 rooms, 15 bookings, folios); test tenant Seaview. Seed dates relative to 2026-10-06.
- **GitHub:** `hassanateeq-collab/htldgtl` (**public**). Desktop layout to be committed next.
- `apps/admin` not scaffolded yet.

## Demo sign-in
- Link (dev server on Hassan's Mac): `http://localhost:5173/t/paramount/login` — hotel code `paramount`.
- Hassan's own account is an owner member of Paramount. Demo owner `owner@demo.test`; dev password in gitignored `supabase/.env.local`. Rotate/remove the demo account before real customers go live.

## Decisions locked with Hassan
- Product **Hotel Digital**; operator **Hamsun**. Fresh start on the new spec; old Next.js prototype left untouched.
- Tooling: npm workspaces; React 18 / Vite 5 / TS 5.6 pinned. **Mobile-first with a desktop tier at `md` (768px)** — one codebase, no separate desktop app.
- **Reuse the `hotel-digital` Supabase project** ($0 extra).
- Tenancy: common Vercel domain + slug login-link now; subdomains/custom domains later. Active tenant in the JWT via a **SECURITY DEFINER RPC** (no edge function).
- **Write actions as SECURITY INVOKER SQL functions** — RLS applies as the caller; atomic, validated once; stable error phrases mapped to friendly messages.
- Entitlements: feature flags + plans + overrides. Signup: request → operator approves. Booking engine kept as `addon.booking_engine`. Payment rails incl. Raast.
- Schema refinements: tenant reads require membership; no-show releases the room; child rows derive tenancy via fill triggers; stored folio totals via trigger; trigger functions not RPC-callable.

## Next steps
1. **Early departure releases the room:** in `set_booking_status('checked_out')`, truncate `check_out` (booking + room assignment) to today when checking out before the planned date, so the EXCLUDE constraint frees the remaining nights; client occupancy counts completed stays only for past nights. Add to the actions suite.
2. **Housekeeping board** (room status updates by the housekeeping role), **cash handover**, **daily report**.
3. **Admin console** (`apps/admin`): provision tenant, plans/add-on overrides, record payments, approve signup requests, audit views.
4. Type the client with the generated `Database` type; route-level code splitting (~500 KB bundle warning).
5. Billing job (`pg_cron` daily 06:00 PKT) + reminders.
6. Demo-data freshness helper (shift seed dates to today); folio charge adjustments (credits) for early departures.

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
