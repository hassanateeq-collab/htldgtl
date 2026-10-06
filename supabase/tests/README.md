# Database regression suites

Two SQL suites prove tenant isolation and core behaviour under Row Level Security. **Run both after every migration; every row must have `pass = true`.**

- `isolation_platform.sql` — 15 checks on the platform layer (tenants, memberships, properties, subscriptions, features, signup).
- `isolation_operational.sql` — 11 checks on the operational layer (bookings, the no-double-book constraint, folios, roles, add-on gate).

## How they work
- Run as `postgres` (the Supabase MCP `execute_sql`, or `psql` against the project).
- Users are impersonated by setting `request.jwt.claims` and switching to the `authenticated` / `anon` role, exactly as PostgREST would.
- Every write (including temporary billing-state changes) is rolled back through a subtransaction, so the suites are safe to run against seeded data.
- They assume the demo seed: tenants `paramount` (owner: `owner@demo.test`) and `seaview` (same user as `front_desk`), one `platform_admins` row with role `owner`, and Central Residence's 14 bookings. Ids are looked up by slug / role / email at runtime.

## Running
Paste a file's contents into the Supabase MCP `execute_sql` tool for project `wdwvnhqtzeivdylhtwxq`, or:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/isolation_platform.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/isolation_operational.sql
```
