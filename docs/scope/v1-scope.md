# v1 scope

The exact screens in v1, each with the feature key that gates it. Target from the build prompt: under 12 tenant screens, under 8 admin screens. We run slightly over on the tenant side because Hassan kept the booking engine — noted below.

## Tenant app (`apps/pms`)
Mobile-first; every screen works at 375px.

| # | Screen | Gated by | Notes |
|---|---|---|---|
| 1 | Login (per-tenant link `/t/<slug>/login`) | — | Resolves tenant by slug; sets active tenant in JWT |
| 2 | Today / dashboard | `core.frontdesk` | Arrivals, departures, in-house, occupancy, cash snapshot |
| 3 | Room grid (tape calendar) | `core.frontdesk` | Availability + bookings as bars; drag to move/extend |
| 4 | Booking create/edit | `core.bookings` | Walk-in/phone, multi-room, status transitions |
| 5 | Booking + folio detail | `core.folio` | Charges, payments, balance, receipt PDF |
| 6 | Guests | `core.guests` | Profiles, phone `+92`, CNIC/passport |
| 7 | Housekeeping | `core.housekeeping` | Room clean/dirty, simple tasks |
| 8 | Daily report | `core.reports.daily` | Arrivals, occupancy, cash collected, discrepancies |
| 9 | Cash handover | `core.cash_handover` | Declare / confirm shift cash by method |
| 10 | Rates & availability | `core.frontdesk` (+`addon.rate_plans`) | Daily rates editor (bulk ranges); multiple plans behind the add-on |
| 11 | Settings (tabs) | mixed | Property, `tenant_settings`, branding, templates, members; custom fields tab behind `addon.custom_fields` |
| 12 | Channel manager | `addon.channel_wubook` | Sync grid, setup, activity (Phase 4, ported) |
| 13 | Booking engine settings | `addon.booking_engine` | Theme, policies, public link (Phase 4) |
| — | Public booking page `/book` | `addon.booking_engine` | Guest-facing, not a staff screen; pay-at-hotel |

Screens 12–13 are add-on screens that only appear when the flag is on, so a Basic tenant sees 11. **Over the 12-screen target by one** because of the kept booking engine — acceptable, flagged at decision time.

## Admin console (`apps/admin`)
| # | Screen | Notes |
|---|---|---|
| 1 | Login | Platform admins only |
| 2 | Tenants list | Search, status, plan at a glance |
| 3 | Tenant detail | Plan, add-on overrides, subscription status, members, audit, impersonate |
| 4 | Signup requests | Approve/reject → provisions tenant (request→approve) |
| 5 | Billing (per tenant) | Invoices, record payments |
| 6 | Plans & features catalog | Edit plan prices, plan↔feature mapping |
| 7 | Platform audit log | Every operator action |
| 8 | Channel admin | Set `lcode`, mappings, raw XML-RPC errors (Phase 4) |

8 screens — on target.

## Explicitly out of v1
- Card payments / any gateway (manual rails only).
- Self-serve *automatic* tenant creation (we use request → approve).
- Per-property metered billing (flat plan + add-ons for now).
- Multi-property switcher polish beyond the basics (`addon.multi_property` raises the cap; switcher UI minimal).
- Reports beyond the daily report; expenses (`addon.expenses`) and invoicing (`addon.invoicing`) are add-ons, scheduled after the core is solid.
- Urdu translation (keys ready, strings English); RTL.
- Housekeeping beyond clean/dirty + simple tasks.

## Build order (phases, from the build prompt)
- **Phase 1** — platform skeleton: monorepo, Supabase project, migrations + RLS + isolation tests, admin screens 1–7, signup request→approve.
- **Phase 2** — core PMS: screens 2–11, the no-double-book constraint on day one, folio truth, receipt PDF, cash handover; verified at 375px.
- **Phase 3** — billing enforcement: daily job, reminders, read-only/suspended enforcement, billing page for suspended tenants, data export.
- **Phase 4** — add-ons behind flags: `addon.channel_wubook` (port), `addon.whatsapp`, `addon.booking_engine`, `addon.multi_property`, `addon.rate_plans`. One ADR per add-on.

Each phase ends at a CHECKPOINT for Hassan.
