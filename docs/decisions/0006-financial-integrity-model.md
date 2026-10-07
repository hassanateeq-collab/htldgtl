# ADR 0006 — Financial integrity model: append-only folio, per-night charges, hotel business date, lifecycle in the database

**Status:** Accepted — 2026-10-07
**Deciders:** Hassan Ateeq, Claude

## Context
The first front-desk release let any front-desk login edit or delete payment rows and write folio totals directly through the API, deleted bookings cascaded through their folios, the server used the UTC date as "today", and the booking state machine lived only inside two SQL functions (see `docs/reviews/2026-10-07-full-review.md`, C1–C4, H1–H6). Cash control is the product's core promise to Pakistani hotel owners, so these rules must hold below the UI for every write path.

## Decision
1. **The folio is append-only.** `folio_items` can be inserted by cashier roles and never updated or deleted through the API (no RLS policy and no table privilege). Corrections are new rows; a manager, owner or accounts user can **void** an item with a reason (`void_folio_item`). Totals ignore voided rows. Folios are read-only for the API: status, totals and numbers are maintained by triggers and by `reopen_folio` / `close_folio` (owner/manager).
2. **Room charges are posted per night** (one row per `service_date`, `category = 'room'`, `source = 'auto'`). Early departure voids the unstayed nights (property policy `release`, or `charge_full`), late departure posts the extra nights, edits void and re-post, cancellation and no-show void the stay. Nothing is matched by description.
3. **Tax is a property setting** (`tax_name`, `tax_rate_pct`, `tax_mode` none | exclusive | inclusive, `tax_applies_to` room | all), computed at posting and stored on the item (`tax_pkr`); folios carry `total_tax`; `balance = charges + tax − payments`, net of discounts and refunds. Legal identity (NTN/STRN) lives on the property.
4. **The hotel business day** is `property_today(property_id)` = today in the property's timezone. Every "today" in SQL uses it; items and shifts carry `business_date`.
5. **The booking lifecycle lives in triggers**, so it holds for direct table writes as well as RPCs: allowed transitions (with owner/manager-only corrections: undo check-in, reinstate no-show/cancelled), check-in only inside the stay, guest ID required at check-in (property setting), out-of-order rooms refused, balance due blocks check-out unless an owner/manager records a reason (the folio stays open as a receivable), credit must be refunded before check-out, side effects (folio close, room dirty, room-row sync) in an AFTER trigger. RPCs lock the booking row (`for update`). `booking_rooms` is written only by `_assign_room()`; room charges only by `_post_room_nights()` / `_void_room_nights()`.
6. **No deletes through money or stays.** Tenant roles have no DELETE on properties, room types, rooms, guests, bookings, booking rooms, folios, items or cash shifts; the chain property → booking → folio → item is `ON DELETE RESTRICT`. Cancellation and deactivation are the only "deletes".
7. **Tenant-safe references.** Composite foreign keys `(tenant_id, …)` / `(property_id, …)` on every leaf reference, so a row can never point at another tenant's room, guest, room type or rate plan.
8. **Document numbers** (booking, folio, receipt) come from `property_counters` through `next_doc_no()` — atomic, prefix from `tenant_settings`, no scans.
9. **Attribution is server-stamped** (`posted_by`, `posted_at`, `business_date`, `created_by`, `updated_by`, `checked_in_at` …). Identity documents are stripped from the audit trail.
10. **Stable error codes.** Functions raise `SQLSTATE` codes in class `HD` (HD001 balance due, HD002 credit, HD003 transition, HD005 dates, HD006 ID required, HD007 folio closed, HD008 room unavailable, HD009 deposit method, HD011 guest required, HD012 cash shift, HD013 membership, HD014 plan limit, HD015 void/immutability) plus `42501`, `P0002`, `23P01`. The app maps codes, never message text.

## Consequences
- Money can only be corrected by visible, attributed voids; the owner can always reconstruct what happened.
- Daily revenue, early/late departures and rate changes fall out of the per-night rows; no description parsing.
- Receptionists cannot bypass any rule by calling the API directly; the UI is a convenience over rules the database enforces.
- Multi-room bookings are deferred (`booking_rooms` is unique per booking in v1); they arrive with room-level RPCs.
- Legacy `guests.cnic` / `guests.passport` columns remain until the app has moved to `id_type` / `id_number`, then a migration drops them.

## Alternatives rejected
- **Correcting rows in place with audit-log reconstruction** — the audit log is readable only by owner/manager/accounts and is not what the receipt shows; voids are the industry norm.
- **A separate `taxes` line table** — pairing tax rows with their charge complicates voids; a `tax_pkr` column on the item keeps one row per economic event.
- **Keeping the rules only in the RPCs** — direct PostgREST writes would still bypass them.

## Addendum 2026-10-08 — minimum one night

Rule 2 released *every* night from today on an early departure, so a guest who checked in and left on the same hotel day paid nothing for the room. From migration 19 (`20261008003000_minimum_one_night.sql`) early departure releases unstayed nights only from `greatest(today, check_in + 1)`: the stay always keeps its first night and `check_out` never collapses onto `check_in`. Day-use pricing, if ever wanted, becomes a separate rate, not a zero bill. The app's check-out sheet mirrors the same rule in its projected balance.
