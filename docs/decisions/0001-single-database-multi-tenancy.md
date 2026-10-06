# ADR 0001 — Single database, multi-tenant by RLS

**Status:** Accepted — 2026-10-06
**Deciders:** Hassan Ateeq, Claude

## Context
Hotel Digital serves many hotels (tenants) from one product. We must isolate each tenant's data strongly while keeping operations (migrations, deploys, support, backups) simple for a solo-operator team.

## Decision
One Supabase project, one Postgres database. Every tenant's rows live in shared tables, isolated by **Row Level Security** keyed on `tenant_id`. Never schema-per-tenant or database-per-tenant, and never per-customer deployments.

- Every tenant-owned table has `tenant_id uuid not null`. Operational tables also carry `property_id`.
- `auth.users` is global. A user reaches a tenant through `memberships (tenant_id, user_id, role)`; a user may belong to several tenants.
- The **active tenant** is carried in the JWT (`app_metadata.active_tenant`), set by an edge function on login/switch. RLS compares `tenant_id` to `current_tenant_id()` (reads the claim).
- Platform operators (`platform_admins`) bypass tenant RLS **only** through `SECURITY DEFINER` functions that write a `platform_audit_log` entry. No service-role key in the browser.

### Tenant resolution (v1 and later)
- **v1 (Vercel domain):** a common domain. Each tenant has a unique `slug`; users reach their panel via a per-tenant login link (`/t/<slug>/login`). After login the active tenant rides in the JWT. Vercel's `*.vercel.app` does **not** support wildcard subdomains, so real subdomains are not possible until a custom domain is owned.
- **Later (owned domain):** enable `*.<domain>` wildcard subdomains and per-tenant `custom_domain`. Both only *preselect* the tenant; the JWT remains the source of truth. The schema reserves `tenants.slug` and `tenants.custom_domain` now, so this is configuration, not a migration.

## Consequences
- Simple ops: one migration set, one deploy, one backup.
- Isolation correctness depends on every policy being right → a mandatory A↔B isolation test suite (see `data-model.md`) using `set_config('request.jwt.claims', …)` inside a rollback block.
- A bug in a shared helper affects all tenants → helpers stay small, tested, reviewed.
- Noisy-neighbour and very-large-tenant scaling are future concerns, acceptable at the 10–30 property target.

## Alternatives rejected
- **Schema/DB per tenant:** heavy ops, migration fan-out, cross-tenant reporting pain. Rejected for a solo operator.
- **Per-customer deployments:** multiplies deploy and secret surface. Rejected.
