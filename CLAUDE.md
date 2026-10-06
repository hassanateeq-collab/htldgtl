# Hotel Digital — engineering guide

Multi-tenant Property Management System (PMS) sold as SaaS to small and mid-size hotels and guesthouses in Pakistan. Operated by **Hamsun** (Hassan Ateeq and staff), who onboards and supports every customer. This is a new, standalone codebase and Supabase project. It shares **no** database with Hamsun PMS (Hassan's in-house system for his own hotels).

> **Read `docs/state/CURRENT.md` at the start of every session** — it is the live status and the next step. This file is the map; `docs/` holds the decisions and the design.

## What this is
- **Customers:** owners/managers of 8–60 room hotels, guesthouses and serviced apartments in Pakistan. Most run on paper, Excel and WhatsApp today. Staff use phones more than laptops. Every core screen must be usable by a night receptionist after a ten-minute WhatsApp video.
- **Positioning:** simplicity, WhatsApp-native workflows, local payments, Urdu-ready, and a founder who runs hotels. We do not compete on feature count.
- **Business model:** monthly subscription in PKR, collected manually (bank transfer, Raast, JazzCash, Easypaisa, cash) and recorded by the operator. No card processor. A trial converts to paid when the operator records the first payment.

## Navigation
- `docs/decisions/` — ADRs (append-only). 0001 multi-tenancy · 0002 feature flags · 0003 data-only customization · 0004 subscription state machine · 0005 one WuBook account.
- `docs/architecture/` — `data-model.md` (ERD + RLS patterns) · `feature-flags.md` · `billing.md`.
- `docs/scope/v1-scope.md` — the exact screen list for v1.
- `docs/state/CURRENT.md` — live status, **read first** each session.
- `apps/pms` — tenant app (built Phase 2). `apps/admin` — operator console (Phase 1). `packages/` — shared types, feature keys, UI primitives, i18n (Phase 1).

## Non-negotiable constraints
1. **One Supabase project, one Postgres DB, every tenant inside it.** Isolation is Row Level Security keyed on `tenant_id`. Never a schema or database per tenant; never per-customer deployments. (ADR 0001)
2. **One WuBook account for the whole platform.** A single Wired API token in Vault; each channel-enabled property is a separate `lcode` under that account, mapped in our DB. Customers never see WuBook. (ADR 0005)
3. **Modular by feature flag, not by code fork.** Every capability beyond core is a named feature granted via plan or per-tenant override. Code checks the effective feature set; it **never** checks a tenant's name or id. One deployed frontend, one set of edge functions, for all tenants. (ADR 0002)
4. **Customization is data, never code.** Branding, settings, custom fields, templates live in tenant-scoped tables with a validated shape. If a customization would need `if tenant_id = …` anywhere, stop and make it a feature flag or a setting instead. (ADR 0003)
5. **Billing state gates access.** `trialing`, `active`, `past_due`, `read_only`, `suspended`, `cancelled` are explicit states with explicit transitions run by a daily job, enforced at the database layer (RLS), not only in the UI. (ADR 0004)
6. **Edge functions and migrations live in git and deploy from git.** No dashboard-only code. (Hamsun PMS once lost fifteen functions to a bulk deploy of stale backups — never repeat it.)

## Locale & formatting
- Currency PKR, shown `PKR 98,000`. Money is `numeric(12,2)`.
- Phone numbers canonical `+92XXXXXXXXXX`; accept `03XX…` and prepend `+92`.
- Timezone `Asia/Karachi`. Hotel-local dates as `date`; instants as `timestamptz`. Display dates `dd MMM yyyy`.
- Date math: use date-fns `differenceInCalendarDays` and `startOfDay`. **Never `differenceInDays`** (rounds down on partial days → wrong nights count).
- All UI strings through the i18n layer (English now, Urdu keys ready). No RTL in v1, but do not design it out.
- Tone: professional. **No emojis** in code, UI, or guest-facing text.

## Tech stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, React Query, React Router. Mobile-first; every core screen works at 375px. Deployed on Vercel.
- **Backend:** Supabase — Postgres 15, RLS, Auth, Edge Functions (Deno), pg_cron, pg_net, Vault.
- **Monorepo:** `apps/pms`, `apps/admin`, shared `packages/` (**npm workspaces** — pnpm isn't installed; npm chosen for simplicity, 2026-10-06).
- **Messaging:** WhatsApp via an adapter (whapi.cloud first; swappable for Meta Cloud API). Email via Resend.
- **Channel:** WuBook Wired API (XML-RPC), ported from the proven Hamsun `channel-hub` (ADR 0005).

## Working rules
- **Ask before committing, pushing, or deploying.** Commit messages: `Type: short sentence.`
- Update `docs/state/CURRENT.md` after every meaningful step.
- Write an ADR for every architectural or business decision. ADRs are append-only — supersede, never edit a decided one.
- Every feature doc records which feature key gates it.
- Verify UI in the browser before reporting it done; check 375px first.
- If these instructions conflict with what you learn from the Hamsun code, keep **these** and flag the conflict to Hassan.
- Every tenant-owned table carries `tenant_id` (operational tables also `property_id`), RLS policies, an `updated_at` trigger, and the generic audit trigger.
