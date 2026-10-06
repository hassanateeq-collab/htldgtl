-- =============================================================================
-- Hotel Digital — tenant isolation suite (platform layer)
-- Run as postgres. Impersonates users via request.jwt.claims + SET ROLE, the
-- same way PostgREST does. Every write is rolled back through a subtransaction.
-- Assumes the demo seed (tenants paramount + seaview, owner@demo.test in both).
-- Expected: every row pass = true.
-- =============================================================================
create or replace function pg_temp.isolation_suite()
returns table (test text, pass boolean, detail text)
language plpgsql as $$
declare
  u_demo uuid; u_admin uuid; t_a uuid; t_b uuid;
  n int; n2 int; b1 boolean; b2 boolean; ok boolean; err text;
begin
  select id into u_demo  from auth.users where email = 'owner@demo.test';
  select user_id into u_admin from public.platform_admins where role = 'owner' order by created_at limit 1;
  select id into t_a from public.tenants where slug = 'paramount';
  select id into t_b from public.tenants where slug = 'seaview';

  -- demo user, active tenant A
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_a))::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*), count(*) filter (where tenant_id <> t_a) into n, n2 from public.properties;
  test := 'A: member sees exactly own properties'; pass := (n = 1 and n2 = 0);
  detail := format('rows=%s foreign=%s', n, n2); return next;

  select count(*) into n from public.subscriptions;
  test := 'A: member sees own subscription'; pass := (n = 1); detail := format('rows=%s', n); return next;

  -- same user, claim switched to B
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_b))::text, true);
  select count(*), count(*) filter (where tenant_id <> t_b) into n, n2 from public.properties;
  test := 'B: same user with claim B sees only B'; pass := (n = 1 and n2 = 0);
  detail := format('rows=%s foreign=%s', n, n2); return next;

  -- claim A: cannot insert into B
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_a))::text, true);
  ok := false; err := null;
  begin
    insert into public.properties (tenant_id, name) values (t_b, 'cross-tenant probe');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'A: cannot insert a row for B'; pass := (not ok); detail := coalesce(err, 'insert succeeded'); return next;

  update public.properties set name = name where tenant_id = t_b;
  get diagnostics n = row_count;
  test := 'A: update on B affects 0 rows'; pass := (n = 0); detail := format('updated=%s', n); return next;

  -- owner of A can write A (rolled back); audit trigger must fire for authenticated
  ok := false; err := null;
  begin
    insert into public.properties (tenant_id, name) values (t_a, 'probe-own');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'A: owner can insert own property (audit trigger fires)'; pass := ok; detail := coalesce(err, 'ok'); return next;

  -- front_desk in B cannot write properties
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_b))::text, true);
  ok := false; err := null;
  begin
    insert into public.properties (tenant_id, name) values (t_b, 'probe-fd');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'B: front_desk cannot insert property'; pass := (not ok); detail := coalesce(err, 'insert succeeded'); return next;

  -- no active tenant: no tenant data, but the picker works
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated')::text, true);
  select count(*) into n from public.properties;
  select count(*) into n2 from public.memberships;
  test := 'no claim: no properties, own memberships visible'; pass := (n = 0 and n2 = 2);
  detail := format('properties=%s memberships=%s', n, n2); return next;
  select count(*) into n from public.tenants;
  test := 'no claim: tenant picker sees both tenants'; pass := (n = 2); detail := format('tenants=%s', n); return next;

  -- platform admin sees everything
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  select count(*) into n from public.tenants;
  select count(*) into n2 from public.properties;
  test := 'admin: sees all tenants and properties'; pass := (n = 2 and n2 = 2);
  detail := format('tenants=%s properties=%s', n, n2); return next;

  -- stranger with a forged claim for A sees nothing (membership required)
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_a))::text, true);
  select count(*) into n from public.properties;
  test := 'stranger with forged claim A sees nothing'; pass := (n = 0); detail := format('rows=%s', n); return next;

  -- features by plan
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_a))::text, true);
  select public.tenant_has_feature('core.frontdesk'), public.tenant_has_feature('addon.channel_wubook') into b1, b2;
  test := 'features: core on, add-on off by plan'; pass := (b1 and not b2); detail := format('core=%s addon=%s', b1, b2); return next;

  -- billing state gates access (all changes rolled back)
  n := -1; n2 := -1; ok := true; err := null;
  begin
    execute 'reset role';
    update public.subscriptions set status = 'read_only' where tenant_id = t_a;
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.properties;
    begin
      insert into public.properties (tenant_id, name) values (t_a, 'probe-ro');
      ok := false; raise exception 'INNER';
    exception when others then null; end;
    execute 'reset role';
    update public.subscriptions set status = 'suspended' where tenant_id = t_a;
    perform set_config('role', 'authenticated', true);
    select count(*) into n2 from public.properties;
    raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'read_only: can read, cannot write'; pass := (n = 1 and ok);
  detail := format('rows=%s write_blocked=%s err=%s', n, ok, coalesce(err, '-')); return next;
  test := 'suspended: cannot read'; pass := (n2 = 0); detail := format('rows=%s', n2); return next;

  -- anon can submit a signup request but cannot read them (rolled back)
  ok := false; err := null; n := -1;
  begin
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    perform set_config('role', 'anon', true);
    insert into public.platform_signup_requests (hotel_name, city, rooms, contact_name, email, phone)
    values ('Probe Hotel', 'Lahore', 12, 'Probe', 'probe@example.com', '+923000000000');
    ok := true;
    select count(*) into n from public.platform_signup_requests;
    raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'anon: can submit signup, cannot read requests'; pass := (ok and n = 0);
  detail := format('inserted=%s visible=%s err=%s', ok, n, coalesce(err, '-')); return next;

  execute 'reset role';
  return;
end $$;

select * from pg_temp.isolation_suite();
