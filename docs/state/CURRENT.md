# Current status

**Last updated:** 2026-10-07
**Phase:** 1 → 2 — database live; **app wired to the database** (auth, tenant switching, every core screen reads real rows)
**Current focus:** Write actions behind RLS — new booking, check-in / check-out / no-show, post folio payments — then housekeeping, cash handover, daily report; then the admin console.

## Where we are
- **App ↔ DB wired (2026-10-07).** `apps/pms` signs in with Supabase Auth at `/t/<slug>/login`, calls `set_active_tenant(slug)` (verifies membership, stamps `app_metadata.active_tenant`), refreshes the JWT, and every screen reads through RLS with React Query: Today, Calendar (tape chart), Bookings, Booking detail + folio, Rooms. Verified in the browser against the seeded Central Residence data. Mock data removed.
  - Auth: `src/auth/` (SessionProvider, `RequireAuth` / `RequireTenant` guards, last-hotel memory, `/login` hotel-code entry, `/select-tenant` picker). Tenant context: `src/data/tenant.tsx`. Hooks + view models: `src/data/`. Generated DB types: `packages/shared/src/database.types.ts` (client not yet generic-typed — next).
  - Demo sign-in: hotel code `paramount`. Hassan's own account is an **owner member** of Paramount (added 2026-10-07). The demo owner `owner@demo.test` has a dev password recorded in gitignored `supabase/.env.local`.
- **Database live:** project `hotel-digital` (`wdwvnhqtzeivdylhtwxq`, ap-south-1). Six migrations applied + mirrored in `supabase/migrations/`; 26/26 regression checks in `supabase/tests/`; see `docs/architecture/data-model.md`.
- **Seeded:** platform admin; **Paramount Hospitality → Central Residence** (4 room types, 17 rooms, default rate plan, 14 guests, 14 bookings + rooms, folios with charges/payments); test tenant **Seaview Guesthouse**. Seed dates are relative to the seed day (2026-10-06), so "cash today" reads 0 from the 7th onward until a payment is posted.
- **GitHub:** `hassanateeq-collab/htldgtl` (**public**). DB layer committed; app wiring to be committed next.
- `apps/admin` not scaffolded yet.

## Decisions locked with Hassan
- Product **Hotel Digital**; operator **Hamsun**. Fresh start on the new spec; old Next.js prototype left untouched.
- Tooling: npm workspaces; React 18 / Vite 5 / TS 5.6 pinned.
- **Reuse the `hotel-digital` Supabase project** ($0 extra) rather than a new one.
- Tenancy: common Vercel domain + slug login-link now; subdomains/custom domains later. Active tenant in the JWT.
- **Tenant switching via a SECURITY DEFINER RPC** that writes `auth.users.raw_app_meta_data` — no edge function needed, works on the hosted project without Docker/Deno.
- Entitlements: feature flags + plans + overrides. Signup: request → operator approves. Booking engine kept as `addon.booking_engine`. Payment rails incl. Raast.
- Schema refinements: tenant reads require membership; no-show releases the room; child rows derive tenancy via fill triggers; stored folio totals via trigger; trigger functions not RPC-callable.

## Next steps
1. Type the Supabase client with the generated `Database` type; code-split routes (`vite build` warns at 504 KB).
2. **Actions behind RLS:** new booking (guest + room + dates; surface the no-double-book error cleanly), check-in / check-out / no-show, post payment / charge; booking-number generation from `tenant_settings`.
3. **Housekeeping board** (room status updates), **cash handover**, **daily report**.
4. **Admin console** (`apps/admin`): provision tenant via `provision_tenant`, plans/add-on overrides, record payments, approve signup requests, audit views.
5. Billing job (`pg_cron` daily 06:00 PKT) + reminders (ADR 0004 / billing.md).
6. Demo-data freshness: a re-seed script (or a daily shift for the demo tenant) so sample dates stay relative to today.

## For Hassan
- **Sign in:** open the app → hotel code `paramount` → your own email + password. (Or `owner@demo.test` with the password in `supabase/.env.local`.)
- **Enable leaked-password protection** in Supabase → Authentication → Settings.
- The GitHub repo is **public** — consider making it private.
- Central Residence's **real room numbers/counts** (current 17 are assumed).

## Open items (tracked)
- Per-plan / per-add-on PKR prices (seeded at 0, edited in admin).
- Real platform domain.
- `npm audit`: 4 vulnerabilities reported at install — review before first deploy. Route-level code splitting before deploy.
- WuBook per-account property limit / partner terms before scaling the channel add-on (ADR 0005).
- Access to `~/hamsun-guest-manager-git` and `~/hamsun-channel-hub` for the Phase 4 WuBook port.
- Resend (email) + whapi (WhatsApp) accounts/credentials.
