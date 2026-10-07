-- =============================================================================
-- Hotel Digital — isolation & access suite
-- Self-contained: builds two fixture tenants (Alpha / Beta) with one user per
-- role inside a transaction and rolls everything back at the end. Impersonates
-- users the way PostgREST does (request.jwt.claims + SET ROLE authenticated).
-- Run the whole file in one call (Supabase MCP execute_sql, or psql -f).
-- Expected: every row pass = true.
-- =============================================================================
begin;

create or replace function pg_temp.fx() returns jsonb
language plpgsql as $$
declare
  sfx        text := substr(md5(random()::text), 1, 6);
  u_owner    uuid := gen_random_uuid();
  u_mgr      uuid := gen_random_uuid();
  u_fd       uuid := gen_random_uuid();
  u_acc      uuid := gen_random_uuid();
  u_hk       uuid := gen_random_uuid();
  u_ro       uuid := gen_random_uuid();
  u_b        uuid := gen_random_uuid();
  u_stranger uuid := gen_random_uuid();
  u_admin    uuid;
  t_a uuid; t_b uuid; p_a uuid; p_b uuid; rt_a uuid; rt_b uuid; plan_basic uuid;
  r_a1 uuid; r_a2 uuid; r_a3 uuid; r_b1 uuid; g1 uuid; u uuid;
begin
  -- auth.users rows (token columns must be '' for GoTrue); rolled back with the suite
  foreach u in array array[u_owner, u_mgr, u_fd, u_acc, u_hk, u_ro, u_b, u_stranger] loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'fx-' || u::text || '@test.local', '', now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
            '', '', '', '', '', '', '', '');
  end loop;
  select user_id into u_admin from public.platform_admins where role = 'owner' order by created_at limit 1;
  select id into plan_basic from public.platform_plans where key = 'basic';

  insert into public.tenants (name, slug) values ('Fixture Alpha ' || sfx, 'fx-alpha-' || sfx) returning id into t_a;
  insert into public.tenants (name, slug) values ('Fixture Beta ' || sfx,  'fx-beta-' || sfx)  returning id into t_b;
  insert into public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
  values (t_a, plan_basic, 'active', current_date, current_date + 30), (t_b, plan_basic, 'active', current_date, current_date + 30);
  insert into public.tenant_settings (tenant_id, settings) values (t_a, '{"booking_prefix":"FX"}'::jsonb), (t_b, '{}'::jsonb);
  insert into public.tenant_branding (tenant_id, legal_name) values (t_a, 'Fixture Alpha Ltd'), (t_b, 'Fixture Beta');
  insert into public.properties (tenant_id, name, city) values (t_a, 'Alpha House', 'Karachi') returning id into p_a;
  insert into public.properties (tenant_id, name, city) values (t_b, 'Beta Inn', 'Lahore')    returning id into p_b;
  insert into public.rate_plans (tenant_id, property_id, name, is_default) values (t_a, p_a, 'Standard', true), (t_b, p_b, 'Standard', true);
  insert into public.room_types (tenant_id, property_id, name, base_rate_pkr) values (t_a, p_a, 'Standard', 10000) returning id into rt_a;
  insert into public.room_types (tenant_id, property_id, name, base_rate_pkr) values (t_b, p_b, 'Standard', 8000)  returning id into rt_b;
  insert into public.rooms (tenant_id, property_id, room_type_id, label) values (t_a, p_a, rt_a, 'A1') returning id into r_a1;
  insert into public.rooms (tenant_id, property_id, room_type_id, label) values (t_a, p_a, rt_a, 'A2') returning id into r_a2;
  insert into public.rooms (tenant_id, property_id, room_type_id, label, housekeeping_status) values (t_a, p_a, rt_a, 'A3', 'out_of_order') returning id into r_a3;
  insert into public.rooms (tenant_id, property_id, room_type_id, label) values (t_b, p_b, rt_b, 'B1') returning id into r_b1;
  insert into public.guests (tenant_id, name, phone, id_type, id_number) values (t_a, 'Fixture Guest', '+923001234000', 'cnic', '42101-1111111-1') returning id into g1;
  insert into public.memberships (tenant_id, user_id, role) values
    (t_a, u_owner, 'owner'), (t_a, u_mgr, 'manager'), (t_a, u_fd, 'front_desk'), (t_a, u_acc, 'accounts'),
    (t_a, u_hk, 'housekeeping'), (t_a, u_ro, 'read_only'),
    (t_b, u_b, 'owner'), (t_b, u_fd, 'front_desk');   -- the front-desk user also works at Beta

  return jsonb_build_object('t_a', t_a, 't_b', t_b, 'p_a', p_a, 'p_b', p_b, 'rt_a', rt_a, 'rt_b', rt_b,
    'r_a1', r_a1, 'r_a2', r_a2, 'r_a3', r_a3, 'r_b1', r_b1, 'g1', g1,
    'u_owner', u_owner, 'u_mgr', u_mgr, 'u_fd', u_fd, 'u_acc', u_acc, 'u_hk', u_hk, 'u_ro', u_ro,
    'u_b', u_b, 'u_stranger', u_stranger, 'u_admin', u_admin);
end $$;

-- impersonate a signed-in user with an active-tenant claim (null = no claim)
create or replace function pg_temp.as_user(p_user uuid, p_tenant uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated',
            'app_metadata', case when p_tenant is null then '{}'::json else json_build_object('active_tenant', p_tenant) end)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.isolation_suite()
returns table (test text, pass boolean, detail text)
language plpgsql as $$
declare
  fx    jsonb := pg_temp.fx();
  t_a   uuid := (fx ->> 't_a')::uuid;  t_b  uuid := (fx ->> 't_b')::uuid;
  p_a   uuid := (fx ->> 'p_a')::uuid;  p_b  uuid := (fx ->> 'p_b')::uuid;
  rt_a  uuid := (fx ->> 'rt_a')::uuid; rt_b uuid := (fx ->> 'rt_b')::uuid;
  r_a1  uuid := (fx ->> 'r_a1')::uuid; r_b1 uuid := (fx ->> 'r_b1')::uuid;
  g1    uuid := (fx ->> 'g1')::uuid;
  u_owner uuid := (fx ->> 'u_owner')::uuid; u_mgr uuid := (fx ->> 'u_mgr')::uuid; u_fd uuid := (fx ->> 'u_fd')::uuid;
  u_acc uuid := (fx ->> 'u_acc')::uuid; u_hk uuid := (fx ->> 'u_hk')::uuid; u_ro uuid := (fx ->> 'u_ro')::uuid;
  u_b uuid := (fx ->> 'u_b')::uuid; u_stranger uuid := (fx ->> 'u_stranger')::uuid; u_admin uuid := (fx ->> 'u_admin')::uuid;
  n int; n2 int; ok boolean; err text; code text; b1 boolean; b2 boolean; v_id uuid; v_txt text;
begin
  -- a booking in A to use as a target for cross-tenant probes (as postgres)
  v_id := public.create_booking(p_a, r_a1, current_date + 20, current_date + 21, 1, 'phone', 10000, g1);

  -- ---- visibility by claim --------------------------------------------------
  perform pg_temp.as_user(u_owner, t_a);
  select count(*), count(*) filter (where tenant_id <> t_a) into n, n2 from public.properties;
  test := 'A owner sees exactly own property'; pass := (n = 1 and n2 = 0); detail := format('rows=%s foreign=%s', n, n2); return next;
  select count(*) into n from public.rooms;
  test := 'A owner sees own rooms'; pass := (n = 3); detail := format('rooms=%s', n); return next;
  select count(*) into n from public.bookings;
  test := 'A owner sees own bookings'; pass := (n = 1); detail := format('bookings=%s', n); return next;

  perform pg_temp.as_user(u_fd, t_b);
  select count(*), count(*) filter (where tenant_id <> t_b) into n, n2 from public.rooms;
  test := 'same front-desk user with claim B sees only B'; pass := (n = 1 and n2 = 0); detail := format('rows=%s foreign=%s', n, n2); return next;
  select count(*) into n from public.bookings;
  test := 'claim B: none of A''s bookings'; pass := (n = 0); detail := format('bookings=%s', n); return next;

  -- ---- cross-tenant writes --------------------------------------------------
  perform pg_temp.as_user(u_owner, t_a);
  ok := false; err := null;
  begin
    insert into public.rooms (tenant_id, property_id, room_type_id, label) values (t_b, p_b, rt_b, 'X1');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'A owner cannot insert a room for B'; pass := (not ok); detail := coalesce(err, 'inserted'); return next;

  update public.rooms set label = label where tenant_id = t_b;
  get diagnostics n = row_count;
  test := 'A owner update on B affects 0 rows'; pass := (n = 0); detail := format('updated=%s', n); return next;

  perform pg_temp.as_user(u_b, t_b);
  ok := false; err := null; code := null;
  begin
    perform public.set_booking_status(v_id, 'cancelled', 'probe');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'B owner cannot act on an A booking (not found)'; pass := (not ok and code = 'P0002'); detail := coalesce(err, 'changed'); return next;

  -- ---- role matrix ------------------------------------------------------------
  perform pg_temp.as_user(u_fd, t_a);
  ok := false; err := null;
  begin
    insert into public.room_types (tenant_id, property_id, name) values (t_a, p_a, 'Suite');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'front_desk cannot create room types'; pass := (not ok); detail := coalesce(err, 'inserted'); return next;

  ok := false; err := null;
  begin
    perform public.create_booking(p_a, r_a1, current_date + 30, current_date + 31, 1, 'walk_in', 10000, null, 'FD Guest', '03001234567');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'front_desk can create bookings'; pass := ok; detail := coalesce(err, 'ok'); return next;

  perform pg_temp.as_user(u_acc, t_a);
  ok := false; err := null;
  begin
    insert into public.folio_items (folio_id, kind, description, amount_pkr, method)
    select f.id, 'payment', 'Bank', 5000, 'bank_transfer' from public.folios f where f.booking_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'accounts can post a payment'; pass := ok; detail := coalesce(err, 'ok'); return next;
  ok := false; err := null;
  begin
    perform public.create_booking(p_a, r_a1, current_date + 40, current_date + 41, 1, 'walk_in', 10000, null, 'Acc Guest', null);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'accounts cannot create bookings'; pass := (not ok); detail := coalesce(err, 'created'); return next;

  perform pg_temp.as_user(u_hk, t_a);
  ok := false; err := null;
  begin
    update public.rooms set housekeeping_status = 'clean' where id = r_a1;
    get diagnostics n = row_count;
    ok := (n = 1); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'housekeeping can set room status'; pass := ok; detail := coalesce(err, 'ok'); return next;
  ok := false; err := null; code := null;
  begin
    update public.rooms set label = 'A1-renamed' where id = r_a1;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'housekeeping cannot rename a room'; pass := (not ok and code = '42501'); detail := coalesce(err, 'renamed'); return next;

  perform pg_temp.as_user(u_ro, t_a);
  select count(*) into n from public.bookings;
  ok := false; err := null;
  begin
    insert into public.guests (tenant_id, name) values (t_a, 'RO Guest');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'read_only role: can read, cannot write'; pass := (n = 1 and not ok); detail := format('bookings=%s write_blocked=%s', n, not ok); return next;

  -- ---- no claim / admin / stranger -------------------------------------------
  perform pg_temp.as_user(u_fd, null);
  select count(*) into n from public.properties;
  select count(*) into n2 from public.memberships;
  test := 'no claim: no properties, own memberships visible'; pass := (n = 0 and n2 = 2); detail := format('properties=%s memberships=%s', n, n2); return next;
  select count(*) into n from public.my_memberships();
  test := 'no claim: my_memberships lists both hotels'; pass := (n = 2); detail := format('rows=%s', n); return next;

  perform pg_temp.as_user(u_admin, null);
  select count(*) into n from public.properties where id in (p_a, p_b);
  test := 'platform admin sees both fixture properties'; pass := (n = 2); detail := format('rows=%s', n); return next;

  perform pg_temp.as_user(u_stranger, t_a);
  select count(*) into n from public.properties;
  select count(*) into n2 from public.my_tenant_access();
  test := 'stranger with forged claim A sees nothing, learns no billing state'; pass := (n = 0 and n2 = 0); detail := format('properties=%s access_rows=%s', n, n2); return next;
  select public.tenant_has_feature('core.frontdesk') into b1;
  test := 'stranger with forged claim: features read false'; pass := (not b1); detail := format('core=%s', b1); return next;

  -- ---- features and billing state --------------------------------------------
  perform pg_temp.as_user(u_owner, t_a);
  select public.tenant_has_feature('core.frontdesk'), public.tenant_has_feature('addon.channel_wubook') into b1, b2;
  test := 'features: core on, add-on off on Basic'; pass := (b1 and not b2); detail := format('core=%s addon=%s', b1, b2); return next;

  execute 'reset role';
  insert into public.tenant_feature_overrides (tenant_id, feature_key, enabled, reason) values (t_a, 'addon.channel_wubook', true, 'test');
  perform pg_temp.as_user(u_owner, t_a);
  select public.tenant_has_feature('addon.channel_wubook') into b1;
  test := 'features: per-tenant override grants an add-on'; pass := b1; detail := format('addon=%s', b1); return next;

  n := -1; n2 := -1; ok := true; err := null;
  begin
    execute 'reset role';
    update public.subscriptions set status = 'read_only' where tenant_id = t_a;
    perform pg_temp.as_user(u_owner, t_a);
    select count(*) into n from public.properties;
    begin
      insert into public.guests (tenant_id, name) values (t_a, 'probe-ro');
      ok := false; raise exception 'INNER';
    exception when others then null; end;
    execute 'reset role';
    update public.subscriptions set status = 'suspended' where tenant_id = t_a;
    perform pg_temp.as_user(u_owner, t_a);
    select count(*) into n2 from public.properties;
    raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'read_only subscription: can read, cannot write'; pass := (n = 1 and ok); detail := format('rows=%s write_blocked=%s err=%s', n, ok, coalesce(err, '-')); return next;
  test := 'suspended subscription: cannot read'; pass := (n2 = 0); detail := format('rows=%s', n2); return next;

  n := -1; err := null;
  begin
    execute 'reset role';
    update public.tenants set is_active = false where id = t_a;
    perform pg_temp.as_user(u_owner, t_a);
    select count(*) into n from public.properties;
    raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'deactivated tenant: members read nothing'; pass := (n = 0); detail := coalesce(err, format('rows=%s', n)); return next;

  -- ---- tenant-safe references (composite FKs) ---------------------------------
  execute 'reset role';
  ok := false; err := null; code := null;
  begin
    perform public._assign_room(v_id, r_b1, 10000, current_date + 20, current_date + 21);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'a booking cannot reference another tenant''s room'; pass := (not ok and code in ('23503', 'HD008')); detail := coalesce(err, 'assigned'); return next;

  ok := false; err := null; code := null;
  begin
    insert into public.rooms (tenant_id, property_id, room_type_id, label) values (t_a, p_a, rt_b, 'Z9');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'a room cannot use another property''s room type'; pass := (not ok and code = '23503'); detail := coalesce(err, 'inserted'); return next;

  -- ---- membership rules --------------------------------------------------------
  perform pg_temp.as_user(u_mgr, t_a);
  ok := false; err := null; code := null;
  begin
    insert into public.memberships (tenant_id, user_id, role) values (t_a, u_stranger, 'owner');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'manager cannot grant the owner role'; pass := (not ok and code = 'HD013'); detail := coalesce(err, 'granted'); return next;
  ok := false; err := null;
  begin
    insert into public.memberships (tenant_id, user_id, role) values (t_a, u_stranger, 'front_desk');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'manager can add front-desk staff'; pass := ok; detail := coalesce(err, 'ok'); return next;
  ok := false; err := null; code := null;
  begin
    update public.memberships set role = 'owner' where tenant_id = t_a and user_id = u_mgr;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'nobody changes their own role'; pass := (not ok and code = 'HD013'); detail := coalesce(err, 'changed'); return next;
  perform pg_temp.as_user(u_owner, t_a);
  ok := false; err := null; code := null;
  begin
    delete from public.memberships where tenant_id = t_a and user_id = u_owner;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'the last owner cannot be removed'; pass := (not ok and code = 'HD013'); detail := coalesce(err, 'removed'); return next;

  -- ---- plan limits ------------------------------------------------------------
  ok := false; err := null; code := null;
  begin
    insert into public.properties (tenant_id, name) values (t_a, 'Second House');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'Basic plan: a second property is refused'; pass := (not ok and code = 'HD014'); detail := coalesce(err, 'inserted'); return next;

  -- ---- deletes through money are impossible ------------------------------------
  ok := false; err := null; code := null;
  begin
    delete from public.bookings where id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'owner cannot delete a booking'; pass := (not ok and code = '42501'); detail := coalesce(err, 'deleted'); return next;
  ok := false; err := null; code := null;
  begin
    delete from public.properties where id = p_a;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'owner cannot delete a property'; pass := (not ok and code = '42501'); detail := coalesce(err, 'deleted'); return next;

  -- ---- trigger functions are not RPCs ------------------------------------------
  ok := false; err := null; code := null;
  begin
    perform public.recompute_folio();
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'trigger function not executable by signed-in users'; pass := (not ok and code = '42501'); detail := coalesce(err, 'executed'); return next;

  -- ---- public signup form --------------------------------------------------------
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
  test := 'anon can submit a signup request, cannot read requests'; pass := (ok and n = 0); detail := format('inserted=%s visible=%s err=%s', ok, n, coalesce(err, '-')); return next;
  ok := false; err := null;
  begin
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    perform set_config('role', 'anon', true);
    insert into public.platform_signup_requests (hotel_name, city, rooms, contact_name, email, phone, notes)
    values ('Probe Hotel', 'Lahore', 12, 'Probe', 'probe@example.com', '+923000000000', 'admin field');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'anon cannot write the admin notes field'; pass := (not ok); detail := coalesce(err, 'inserted'); return next;

  execute 'reset role';
  return;
end $$;

select * from pg_temp.isolation_suite();
rollback;
