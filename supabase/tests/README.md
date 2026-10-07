# Database regression suites

Three SQL suites prove tenant isolation, the booking lifecycle, the append-only folio and the operations functions under Row Level Security. **Run all three after every migration; every row must have `pass = true`.**

| Suite | Checks | Covers |
|---|---|---|
| `isolation.sql` | 37 | visibility by claim, cross-tenant writes, the six roles, no-claim picker, platform admin, forged claims, features and overrides, read-only / suspended / deactivated tenants, composite foreign keys, membership rules, plan limits, no deletes, trigger functions not callable, public signup form |
| `bookings_folio.sql` | 26 | create (numbering, nightly rows, receipt numbers, attribution, phone/CNIC normalisation), no double booking, deposits, out-of-order rooms, check-in rules (ID, dates window, stamps, room sync), walk-in + same-day departure (first night kept, unstayed nights released), balance-due guard and manager override, credit guard, cancel/no-show/reinstate, edits (re-posting, room move, locked check-in, closed bookings), direct writes, folio immutability, void, reopen/close, late departure, tax exclusive/inclusive |
| `operations.sql` | 9 | cash shifts (open, link payments, expected vs declared, self-confirm refused, discrepancy, validation, RPC-only), housekeeping history, daily report, billing job transitions, tenant provisioning |

## How they work
- Each file is **self-contained**: it opens a transaction, creates its own fixtures (two tenants, one property each, rooms, a guest, one user per role as rows in `auth.users`), runs the checks, and rolls everything back. Nothing depends on the demo seed or on the calendar date.
- Users are impersonated by setting `request.jwt.claims` and switching to the `authenticated` / `anon` role, exactly as PostgREST does (`pg_temp.as_user(user, tenant)`).
- Every check that writes does so inside a sub-transaction that is rolled back (`ROLLBACK_PROBE`), so checks are independent; the few that need to share state do it inside one block.
- **Dates come from the hotel day** (`d0 := property_today(p_a)`), never `current_date`: Supabase runs in UTC, so between midnight and 05:00 in Karachi the two differ by a day and every check-in / check-out window would be off by one.
- Call a suite function **once** per transaction. `as_user()` leaves `request.jwt.claims` set, so a second call would create its fixture as the last impersonated user and fail on the owner-only membership rule.

## Running
Paste a whole file into the Supabase MCP `execute_sql` tool for project `wdwvnhqtzeivdylhtwxq` (the trailing `rollback` is part of the file and the tool still returns the `select` results), or:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/isolation.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/bookings_folio.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/operations.sql
```
