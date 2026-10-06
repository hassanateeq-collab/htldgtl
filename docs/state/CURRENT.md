# Current status

**Last updated:** 2026-10-06
**Phase:** 1 — platform skeleton: **database live and verified**; front-desk core screens built on sample data
**Current focus:** Wire the pms app to the real database — auth + per-tenant login link + the edge function that sets `app_metadata.active_tenant`, then swap the mock data for React Query reads behind RLS, screen by screen.

## Where we are
- **Database live:** Supabase project **`hotel-digital`** (`wdwvnhqtzeivdylhtwxq`, ap-south-1). Reused from the old prototype (schema wiped 2026-10-06, `auth.users` kept) instead of paying for a new project. Five migrations applied and mirrored in `supabase/migrations/` (see `docs/architecture/data-model.md`).
- **Seeded:** Hassan as platform admin; tenant **Paramount Hospitality** (slug `paramount`) → property **Central Residence** with 4 room types, 17 rooms, default rate plan, 14 guests, 14 bookings + room assignments, folios with charges/payments (same data as the mock screens); plus test tenant **Seaview Guesthouse** (slug `seaview`) for A↔B checks. `owner@demo.test` is owner of Paramount and front_desk of Seaview.
- **Verified:** 26/26 checks pass across `supabase/tests/isolation_platform.sql` (15) and `isolation_operational.sql` (11) — tenant isolation by claim and membership, roles, billing-state gating, feature gates, the no-double-book constraint (overlap rejected / same-day turnover allowed / cancelled releases), folio recompute and closed-folio rejection, anon signup path. Security advisor: only intentional warnings remain (documented in data-model.md) plus the Auth leaked-password toggle.
- **GitHub:** `hassanateeq-collab/htldgtl` (**public**) connected; Phase 0 docs, scaffold and front-desk core pushed as three commits. DB work to be committed next.
- **App:** `apps/pms` (React 18 + Vite 5 + Tailwind v4) — Today, tape-chart Calendar, Bookings, Booking detail + folio, Rooms, More; i18n via `t()`; still rendering sample data. Supabase client (`src/lib/supabase.ts`) and `.env.local` (publishable key) are in place but not yet used.
- `apps/admin` not scaffolded yet.

## Decisions locked with Hassan (2026-10-06)
- Product name **Hotel Digital**; operator **Hamsun**. Fresh start on the new spec; old Next.js prototype in `~/Hotel DIgital 1` left untouched.
- Tooling: npm workspaces; React 18 / Vite 5 / TS 5.6 pinned.
- **Reuse the `hotel-digital` Supabase project** ($0 extra) rather than a new one ($10/mo; org already has 7 projects).
- Domain: Vercel domain for now; tenancy = common domain + slug login-link now, subdomains/custom domains later (`slug` + `custom_domain` reserved). Active tenant in the JWT.
- Entitlements: feature flags + plans + per-tenant overrides. Signup: request → operator approves. Booking engine kept as `addon.booking_engine`. Payment rails incl. Raast.
- Schema refinements made while building: tenant **reads require membership** (not just the claim); **no-show releases the room** like cancellation; child rows derive tenancy via fill triggers; stored folio totals via trigger; trigger functions not RPC-callable.

## Next steps
1. **Auth + tenant login:** `/t/<slug>/login` in `apps/pms`; edge function `set-active-tenant` (service role) that writes `app_metadata.active_tenant` after verifying membership; tenant picker for multi-tenant users; `my_tenant_access()` in the shell for read-only/suspended banners.
2. **Data layer:** React Query hooks over Supabase for rooms, room types, bookings (+ rooms), guests, folios; replace `src/mock/*` screen by screen (Today → Calendar → Bookings/detail → Rooms). Keep the mock as Storybook-style fixtures only.
3. **Actions:** booking create/edit, check-in / check-out / no-show, post folio payment — all writing through RLS; booking-number generation from `tenant_settings`.
4. **Core control screens:** housekeeping board, cash handover, daily report.
5. **Admin console** (`apps/admin`): create tenant via `provision_tenant`, plans/add-on overrides, record payments, approve signup requests, audit views.
6. **Billing job:** `pg_cron` daily 06:00 PKT state machine + reminders (ADR 0004 / billing.md).

## For Hassan
- **Enable leaked-password protection** in Supabase → Authentication → Settings (advisor item; a dashboard toggle, not SQL).
- The GitHub repo is **public** — consider making it private for a commercial product (no secrets are committed either way).
- Central Residence's **real room numbers/counts** (current 17 are assumed).

## Open items (tracked)
- Per-plan / per-add-on PKR prices (seeded at 0, edited in admin).
- Real platform domain.
- `npm audit`: 4 vulnerabilities reported at install (3 moderate, 1 high) — review before first deploy.
- WuBook per-account property limit / partner terms before scaling the channel add-on (ADR 0005).
- Access to `~/hamsun-guest-manager-git` and `~/hamsun-channel-hub` for the Phase 4 WuBook port.
- Resend (email) + whapi (WhatsApp) accounts/credentials.
