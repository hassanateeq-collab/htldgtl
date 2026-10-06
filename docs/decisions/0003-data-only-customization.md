# ADR 0003 — Customization is data, never code

**Status:** Accepted — 2026-10-06
**Deciders:** Hassan Ateeq, Claude

## Context
Hotels want their own branding, document/message wording, extra fields, and policy settings. None of this may require code changes or risk other tenants.

## Decision
All per-tenant customization lives in tenant-scoped tables with a validated shape:

- `tenant_settings` — one row per tenant, `settings jsonb` validated against a **versioned JSON schema** kept in `packages/shared` (check-in/out times, currency display, tax labels, receipt footer, booking-number prefix, which payment methods appear, etc.).
- `tenant_branding` — logo, primary color, legal name, address, NTN/STRN.
- `custom_field_definitions` + a `custom_fields jsonb` column on `guests` and `bookings` (behind `addon.custom_fields`).
- `message_templates` / `document_templates` per tenant with a safe placeholder syntax (`{{guest_name}}`, `{{check_in}}`), falling back to platform defaults when absent.

**Rule:** if a requested customization would need `if tenant_id = …` anywhere in code, stop — design it as a feature flag (ADR 0002) or a validated setting.

## Consequences
- New customization = a new validated setting/field, not a new code path.
- The JSON schema is versioned, so settings migrate forward safely.
- Templates degrade gracefully to platform defaults when a tenant hasn't set one.
- Validation happens in `packages/shared` so both apps and edge functions agree on shape.
