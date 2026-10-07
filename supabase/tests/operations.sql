-- =============================================================================
-- Hotel Digital — operations suite
-- Self-contained fixtures (see isolation.sql); run the whole file in one call.
-- Cash shifts (open / close / confirm, expected vs declared), housekeeping
-- history, the daily report, the billing job and tenant provisioning.
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
    (t_b, u_b, 'owner'), (t_b, u_fd, 'front_desk');

  return jsonb_build_object('t_a', t_a, 't_b', t_b, 'p_a', p_a, 'p_b', p_b, 'rt_a', rt_a, 'rt_b', rt_b,
    'r_a1', r_a1, 'r_a2', r_a2, 'r_a3', r_a3, 'r_b1', r_b1, 'g1', g1,
    'u_owner', u_owner, 'u_mgr', u_mgr, 'u_fd', u_fd, 'u_acc', u_acc, 'u_hk', u_hk, 'u_ro', u_ro,
    'u_b', u_b, 'u_stranger', u_stranger, 'u_admin', u_admin);
end $$;

create or replace function pg_temp.as_user(p_user uuid, p_tenant uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated',
            'app_metadata', case when p_tenant is null then '{}'::json else json_build_object('active_tenant', p_tenant) end)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.operations_suite()
returns table (test text, pass boolean, detail text)
language plpgsql as $$
declare
  fx    jsonb := pg_temp.fx();
  t_a   uuid := (fx ->> 't_a')::uuid;  t_b uuid := (fx ->> 't_b')::uuid;
  p_a   uuid := (fx ->> 'p_a')::uuid;
  -- the hotel day, not current_date: Supabase runs in UTC and the suites run at any hour in Karachi
  d0    date := public.property_today((fx ->> 'p_a')::uuid);
  r_a1  uuid := (fx ->> 'r_a1')::uuid; r_a2 uuid := (fx ->> 'r_a2')::uuid;
  g1    uuid := (fx ->> 'g1')::uuid;
  u_owner uuid := (fx ->> 'u_owner')::uuid; u_mgr uuid := (fx ->> 'u_mgr')::uuid; u_fd uuid := (fx ->> 'u_fd')::uuid;
  u_hk  uuid := (fx ->> 'u_hk')::uuid; u_admin uuid := (fx ->> 'u_admin')::uuid; u_stranger uuid := (fx ->> 'u_stranger')::uuid;
  v_shift uuid; v_id uuid; v_id2 uuid; v_res jsonb; v_rep jsonb;
  v_status text; v_txt text;
  n int; ok boolean; err text; code text;
begin
  perform pg_temp.as_user(u_fd, t_a);

  -- 1) open a shift on the hotel day with a float; a second open shift is refused
  ok := false; err := null;
  begin
    v_shift := public.open_cash_shift(p_a, 2000, 'Morning');
    select status::text, shift_date::text into v_status, v_txt from public.cash_shifts where id = v_shift;
    begin
      perform public.open_cash_shift(p_a, 0);
      err := 'a second shift was opened';
    exception when others then if sqlstate <> 'HD012' then err := sqlerrm; end if; end;
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  test := 'cash: shift opens on the hotel day with its float; a second open shift is refused (HD012)';
  pass := (ok and v_status = 'open' and v_txt = public.property_today(p_a)::text);
  detail := coalesce(err, format('status=%s date=%s', v_status, v_txt)); return next;

  -- 2) payments link to the open shift; expected = float + cash − refunds; self-confirm refused; manager confirms with discrepancy
  ok := false; err := null; v_res := null; v_rep := null; n := null;
  begin
    v_shift := public.open_cash_shift(p_a, 2000);
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1, null, null, null, 7000, 'cash');
    insert into public.folio_items (folio_id, kind, description, amount_pkr, method) select id, 'payment', 'JazzCash', 3000, 'jazzcash' from public.folios where booking_id = v_id;
    insert into public.folio_items (folio_id, kind, description, amount_pkr, method) select id, 'refund',  'Refund',   1000, 'cash'     from public.folios where booking_id = v_id;
    select count(*) into n from public.folio_items where cash_shift_id = v_shift;
    v_res := public.close_cash_shift(v_shift, '{"cash": 8000, "jazzcash": 3000}'::jsonb, 'Closing');
    begin
      perform public.confirm_cash_shift(v_shift, '{"cash": 7900, "jazzcash": 3000}'::jsonb);
      err := 'the closer confirmed their own shift';
    exception when others then if sqlstate <> 'HD012' then err := sqlerrm; end if; end;
    perform pg_temp.as_user(u_mgr, t_a);
    v_rep := public.confirm_cash_shift(v_shift, '{"cash": 7900, "jazzcash": 3000}'::jsonb);
    select status::text into v_status from public.cash_shifts where id = v_shift;
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'cash: 3 movements linked; expected cash 2000+7000-1000 = 8000, jazzcash 3000; self-confirm refused; manager confirms, cash short by 100';
  pass := (ok and n = 3 and (v_res -> 'expected' ->> 'cash')::numeric = 8000 and (v_res -> 'expected' ->> 'jazzcash')::numeric = 3000
           and (v_rep -> 'discrepancy' ->> 'cash')::numeric = -100 and (v_rep -> 'discrepancy' ->> 'jazzcash')::numeric = 0 and v_status = 'confirmed');
  detail := coalesce(err, format('linked=%s expected=%s discrepancy=%s status=%s', n, v_res -> 'expected', v_rep -> 'discrepancy', v_status)); return next;

  -- 3) declarations are validated
  ok := false; err := null; code := null;
  begin
    v_shift := public.open_cash_shift(p_a, 0);
    perform public.close_cash_shift(v_shift, '{"bitcoin": 5}'::jsonb);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'cash: unknown payment method in a declaration refused (HD012)'; pass := (not ok and code = 'HD012'); detail := coalesce(err, 'accepted'); return next;

  -- 4) shifts are RPC-only for the API role
  ok := false; err := null; code := null;
  begin
    insert into public.cash_shifts (tenant_id, property_id, shift_date) values (t_a, p_a, d0);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'cash: shifts cannot be inserted directly (42501)'; pass := (not ok and code = '42501'); detail := coalesce(err, 'inserted'); return next;

  -- 5) housekeeping status changes are recorded with the actor
  ok := false; err := null; n := null;
  begin
    perform pg_temp.as_user(u_hk, t_a);
    update public.rooms set housekeeping_status = 'dirty' where id = r_a2;
    select count(*) into n from public.room_status_history where room_id = r_a2 and to_status = 'dirty' and from_status = 'clean' and changed_by = u_hk;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'housekeeping: status change recorded in room_status_history with the actor'; pass := (ok and n = 1); detail := coalesce(err, format('rows=%s', n)); return next;

  -- 6) daily report
  ok := false; err := null; v_rep := null;
  begin
    v_id  := public.create_booking(p_a, r_a1, d0, d0 + 2, 1, 'walk_in', 10000, g1, null, null, null, 5000, 'cash', 0, true);
    v_id2 := public.create_booking(p_a, r_a2, d0, d0 + 1, 1, 'phone', 10000, g1);
    v_rep := public.daily_report(p_a);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'daily report: arrivals 2 expected / 1 arrived, in-house 1, rooms 2 of 3 sold, room revenue 30000, cash 5000, outstanding 25000';
  pass := (ok and (v_rep -> 'arrivals' ->> 'expected')::int = 2 and (v_rep -> 'arrivals' ->> 'arrived')::int = 1
           and (v_rep ->> 'in_house')::int = 1 and (v_rep -> 'rooms' ->> 'occupied')::int = 2 and (v_rep -> 'rooms' ->> 'total')::int = 3
           and (v_rep -> 'revenue' ->> 'room')::numeric = 30000 and (v_rep -> 'payments' ->> 'cash')::numeric = 5000
           and (v_rep ->> 'outstanding')::numeric = 25000);
  detail := coalesce(err, v_rep::text); return next;

  -- 7) billing job: expired trial -> past_due; past the grace period -> read_only
  ok := false; err := null; v_status := null; v_txt := null;
  begin
    execute 'reset role';
    update public.subscriptions set status = 'trialing', trial_ends_at = now() - interval '1 day' where tenant_id = t_b;
    perform public.run_billing_transitions();
    select status::text into v_status from public.subscriptions where tenant_id = t_b;
    update public.subscription_events set at = now() - interval '8 days' where tenant_id = t_b and to_status = 'past_due';
    perform public.run_billing_transitions();
    select status::text into v_txt from public.subscriptions where tenant_id = t_b;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'billing job: expired trial -> past_due; 8 days past due -> read_only'; pass := (ok and v_status = 'past_due' and v_txt = 'read_only');
  detail := coalesce(err, format('first=%s second=%s', v_status, v_txt)); return next;

  -- 8) provisioning
  ok := false; err := null; code := null;
  begin
    perform pg_temp.as_user(u_owner, t_a);
    perform public.provision_tenant('Probe Hotel', 'fx-probe-' || substr(md5(random()::text), 1, 6), 'Probe House', 'Multan');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'provision_tenant: a tenant owner is refused (42501)'; pass := (not ok and code = '42501'); detail := coalesce(err, 'provisioned'); return next;
  ok := false; err := null; n := null; v_status := null;
  begin
    perform pg_temp.as_user(u_admin, null);
    v_id := public.provision_tenant('Probe Hotel', 'fx-probe-' || substr(md5(random()::text), 1, 6), 'Probe House', 'Multan', 'trial', u_stranger);
    select count(*) into n from public.rate_plans rp join public.properties p on p.id = rp.property_id where p.tenant_id = v_id and rp.is_default;
    select status::text into v_status from public.subscriptions where tenant_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'provision_tenant: platform admin creates a trialing tenant with a default rate plan and an owner';
  pass := (ok and n = 1 and v_status = 'trialing'); detail := coalesce(err, format('rate_plans=%s status=%s', n, v_status)); return next;

  execute 'reset role';
  return;
end $$;

select * from pg_temp.operations_suite();
rollback;
