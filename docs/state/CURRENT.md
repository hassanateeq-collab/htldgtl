# Current status

**Last updated:** 2026-10-07
**Phase:** 2 — core PMS: **front-desk actions live** (create booking, check-in / check-out / no-show / cancel, folio payments and charges), all behind RLS
**Current focus:** Responsive desktop layout (Hassan's ask: side navigation, wider content, multi-week calendar), then housekeeping board, cash handover, daily report, then the admin console.

## Where we are
- **Booking actions live (2026-10-07).** Migration 7 adds SECURITY INVOKER functions — `create_booking()` (optional new guest, booking number from `tenant_settings.booking_prefix` + series, room assignment under the no-double-book constraint, room charge auto-posted) and `set_booking_status()` (allowed transitions only; check-out blocked while a balance is due, then closes the folio and marks the room dirty). App: **New Booking** screen (returning-guest search, free-room filter by dates, base rate default, live total), detail-page actions with two-tap confirm, inline **Add payment / Add charge**, a "+" button on Today/Calendar/Bookings. Role-gated in the UI and enforced by RLS.
  - **Verified live in the browser as the demo owner:** CR-1015 (Imran Qureshi, room 102) created → checked in → PKR 15,000 cash → checked out; database confirms folio closed, room 102 dirty, audit actor recorded. That booking now lives in the demo data.
  - Fixed: folio timestamps now format in local time (was slicing the UTC string → "06 Oct" after midnight PKT).
- **Regression suites** (`supabase/tests/`): platform (15), operational (11), booking actions (5) = **31 checks**. Operational/actions suites compute expected counts and the next booking number at run time, so they stay valid as demo data grows.
- **App ↔ DB wired (2026-10-07):** `/t/<slug>/login`, `set_active_tenant()` claim stamping + JWT refresh, guards, tenant picker; Today, Calendar, Bookings, detail + folio, Rooms read through RLS with React Query. Generated DB types in `packages/shared` (client not yet generic-typed).
- **Database live:** project `hotel-digital` (`wdwvnhqtzeivdylhtwxq`, ap-south-1). Seven migrations applied + mirrored; see `docs/architecture/data-model.md`.
- **Seeded:** platform admin; Paramount Hospitality → Central Residence (4 room types, 17 rooms, 15 bookings incl. CR-1015, folios); test tenant Seaview. Seed dates are relative to 2026-10-06.
- **GitHub:** `hassanateeq-collab/htldgtl` (**public**). Actions to be committed next.
- `apps/admin` not scaffolded yet.

## Demo sign-in
- Link (dev server on Hassan's Mac): `http://localhost:5173/t/paramount/login` — hotel code `paramount`.
- Hassan's own account is an owner member of Paramount. Demo owner `owner@demo.test`; dev password in gitignored `supabase/.env.local`. Rotate/remove the demo account before real customers go live.

## Decisions locked with Hassan
- Product **Hotel Digital**; operator **Hamsun**. Fresh start on the new spec; old Next.js prototype left untouched.
- Tooling: npm workspaces; React 18 / Vite 5 / TS 5.6 pinned. **Mobile-first** (375px) — desktop layout is the next pass, not a redesign.
- **Reuse the `hotel-digital` Supabase project** ($0 extra).
- Tenancy: common Vercel domain + slug login-link now; subdomains/custom domains later. Active tenant in the JWT via a **SECURITY DEFINER RPC** (no edge function).
- **Write actions as SECURITY INVOKER SQL functions** — RLS applies as the caller; atomic and validated in one place; stable error phrases mapped to friendly messages in the app.
- Entitlements: feature flags + plans + overrides. Signup: request → operator approves. Booking engine kept as `addon.booking_engine`. Payment rails incl. Raast.
- Schema refinements: tenant reads require membership; no-show releases the room; child rows derive tenancy via fill triggers; stored folio totals via trigger; trigger functions not RPC-callable.

## Next steps
1. **Responsive desktop layout:** side nav ≥ `md`, content widths `md:max-w-3xl lg:max-w-5xl`, Today in two columns, calendar 4 weeks wide, FAB repositioned.
2. **Housekeeping board** (room status updates by housekeeping role), **cash handover**, **daily report**.
3. **Admin console** (`apps/admin`): provision tenant, plans/add-on overrides, record payments, approve signup requests, audit views.
4. Type the client with the generated `Database` type; route-level code splitting (build warns at ~500 KB).
5. Billing job (`pg_cron` daily 06:00 PKT) + reminders.
6. Demo-data freshness helper (shift seed dates to today).

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
