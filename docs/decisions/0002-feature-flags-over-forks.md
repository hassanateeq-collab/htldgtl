# ADR 0002 — Features by flag, not by fork

**Status:** Accepted — 2026-10-06
**Deciders:** Hassan Ateeq, Claude

## Context
Customers want different capabilities, and we sell modules à la carte. We must never branch the codebase or special-case a tenant by id.

## Decision
Every capability beyond the core is a **named feature**. A tenant's effective feature set = its plan's features, **plus** enabled per-tenant overrides, **minus** disabled overrides, filtered by date.

- Feature keys are a single TypeScript constant in `packages/shared`, mirrored by a DB check constraint. The catalog lives in `docs/architecture/feature-flags.md`.
- Data lives in `platform_features`, `platform_plans`, `platform_plan_features`, `tenant_feature_overrides`.
- Enforcement is layered and every layer reads the same source of truth:
  - SQL `tenant_has_feature(key)` — used by RLS policies and edge-function guards for writes.
  - `useFeature(key)` hook — gates routes, nav items, buttons in both apps.
- Code **never** reads a tenant's name or id to decide behavior. If something cannot be expressed as a feature plus settings, it becomes a new platform feature, built once for everyone.

## Consequences
- One deployed frontend and one set of edge functions serve all tenants.
- Adding a customer capability = add a feature key + a gate; no fork.
- Turning a feature on/off is a data change (plan or override), effective immediately.
- UI gating is convenience; the **write-side** gate (RLS / edge function) is the real boundary.

## Alternatives rejected
- Per-tenant branches/builds, or `if (tenantId === …)`: unmaintainable and unsafe. Rejected.
