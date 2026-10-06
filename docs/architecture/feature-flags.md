# Feature flags & plans

Gated by: this *is* the gating mechanism (ADR 0002). Every other feature doc names the key that gates it.

## Feature keys (the single source)
Defined once in `packages/shared` as a TypeScript constant and mirrored by a DB check constraint on `platform_features.key`.

### Core (every plan)
| Key | What |
|---|---|
| `core.frontdesk` | Room grid / today view: arrivals, departures, in-house |
| `core.bookings` | Create, modify, cancel, no-show |
| `core.guests` | Guest profiles: name, phone, CNIC/passport |
| `core.folio` | Charges, payments, balance, receipt PDF |
| `core.housekeeping` | Room clean/dirty status + simple task list |
| `core.reports.daily` | Daily arrivals, occupancy, cash collected |
| `core.cash_handover` | Shift cash declaration and handover (accountability) |

### Add-ons (via plan or per-tenant override)
| Key | What |
|---|---|
| `addon.channel_wubook` | WuBook connection, rates, availability, OTA reservations (ADR 0005) |
| `addon.whatsapp` | Booking confirmation, pre-arrival, check-out messages |
| `addon.booking_engine` | Direct pay-at-hotel booking page on the tenant (kept per Hassan, 2026-10-06) |
| `addon.multi_property` | More than one property under a tenant |
| `addon.rate_plans` | Multiple rate plans, seasonal pricing |
| `addon.invoicing` | Tax invoices, company billing, credit accounts |
| `addon.expenses` | Simple expense log per property |
| `addon.custom_fields` | Tenant-defined fields on guests and bookings |

## Plans (initial; prices are data, PKR/month, seeded at 0)
| Plan | Features | Properties | Trial |
|---|---|---|---|
| **Trial** | all core | 1 | 14 days |
| **Basic** | all core | 1 | — |
| **Connected** | Basic + `addon.channel_wubook` + `addon.whatsapp` | 1 | — |

Any add-on (including `addon.booking_engine`, `addon.multi_property`) can also be granted individually as a per-tenant override. `addon.multi_property` lifts `platform_plans.max_properties`.

## Effective features
```
effective(tenant) =
   features(plan of tenant)
 ∪ overrides where enabled = true  and now ∈ [starts_at, ends_at]
 ∖ overrides where enabled = false and now ∈ [starts_at, ends_at]
```
Exposed as:
- SQL `tenant_has_feature(key)` — used by RLS write policies and edge-function guards (the real boundary).
- `useFeature(key)` React hook — gates routes, nav items, and buttons in both apps (convenience).

## Adding a feature (checklist)
1. Add the key to the `packages/shared` constant (and the DB check constraint migration).
2. Insert a `platform_features` row; attach to plans via `platform_plan_features` if bundled.
3. Gate writes: `tenant_has_feature('addon.x')` in RLS / edge function.
4. Gate UI: `useFeature('addon.x')` on route + nav + buttons.
5. Document the feature and name its key in the feature's doc.
6. Never gate by tenant name/id.
