# ADR 0004 — Subscription state machine and access gating

**Status:** Accepted — 2026-10-06
**Deciders:** Hassan Ateeq, Claude

## Context
Billing is collected manually in PKR; there is no card processor. Access must follow payment state reliably and be enforced below the UI.

## Decision
One `subscriptions` row per tenant with an explicit status, plus a daily job (06:00 Asia/Karachi, via `pg_cron`) that evaluates transitions and records each one in `subscription_events`.

States and transitions:
```
trialing  --payment recorded-->            active
trialing  --trial_ends_at passed-->        past_due
active    --current_period_end passed-->   past_due
past_due  --grace_days elapsed-->          read_only     (staff can view, cannot write)
read_only --read_only_days elapsed-->      suspended     (login shows billing page only)
past_due|read_only|suspended --payment-->  active        (period extended)
suspended --90 days-->                     cancelled     (export offered, then purge policy)
any       --operator action-->             cancelled
```

Enforcement — a SQL function `tenant_access_level()` returns `full | read_only | none` from the subscription state:
- every **write** policy includes `tenant_access_level() = 'full'`
- every **read** policy includes `tenant_access_level() <> 'none'`
- platform admins are exempt (via `SECURITY DEFINER`).

**Signup is self-serve, operator-approved:** a `platform_signup_requests` row is created from the marketing page (hotel name, city, rooms, contact, email, phone). On approval, an edge function creates the tenant, one property, the owner membership, and a `trialing` subscription, and notifies Hassan on WhatsApp. Rejected requests are kept for audit.

## Consequences
- Access cannot drift from billing state — the DB enforces it even if the UI is wrong.
- Reactivation is one payment record away; data is never deleted on suspension (only after the cancellation purge policy, with export offered first).
- Reminders, invoices, and payment rails are detailed in `docs/architecture/billing.md`.

## Note
This differs from the pasted build prompt (which created tenants automatically on signup); Hassan chose operator approval on 2026-10-06 to keep acquisition sales-led while still capturing leads.
