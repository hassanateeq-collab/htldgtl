-- =============================================================================
-- Hotel Digital — bookings & folio suite
-- Self-contained fixtures (see isolation.sql for the fixture description); run
-- the whole file in one call. Exercises create_booking / update_booking /
-- set_booking_status, the lifecycle triggers (ID at check-in, dates window,
-- early and late departure, balance and credit guards, manager override,
-- cancellation and reinstatement), the append-only folio (immutability, void,
-- reopen / close), numbering, tax, and attribution — as front desk, manager,
-- owner and accounts users. Expected: every row pass = true.
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

-- live (non-voided) room nights on a booking's folio
create or replace function pg_temp.live_nights(p_booking uuid) returns int
language sql as $$
  select count(*)::int from public.folio_items fi join public.folios f on f.id = fi.folio_id
  where f.booking_id = p_booking and fi.category = 'room' and fi.voided_at is null
$$;
create or replace function pg_temp.voided_items(p_booking uuid) returns int
language sql as $$
  select count(*)::int from public.folio_items fi join public.folios f on f.id = fi.folio_id
  where f.booking_id = p_booking and fi.voided_at is not null
$$;

create or replace function pg_temp.bookings_suite()
returns table (test text, pass boolean, detail text)
language plpgsql as $$
declare
  fx    jsonb := pg_temp.fx();
  t_a   uuid := (fx ->> 't_a')::uuid;  t_b  uuid := (fx ->> 't_b')::uuid;
  p_a   uuid := (fx ->> 'p_a')::uuid;
  -- the hotel day, not current_date: Supabase runs in UTC and the suites run at any hour in Karachi
  d0    date := public.property_today((fx ->> 'p_a')::uuid);
  r_a1  uuid := (fx ->> 'r_a1')::uuid; r_a2 uuid := (fx ->> 'r_a2')::uuid; r_a3 uuid := (fx ->> 'r_a3')::uuid;
  g1    uuid := (fx ->> 'g1')::uuid;
  u_owner uuid := (fx ->> 'u_owner')::uuid; u_mgr uuid := (fx ->> 'u_mgr')::uuid; u_fd uuid := (fx ->> 'u_fd')::uuid;
  u_acc uuid := (fx ->> 'u_acc')::uuid;
  v_id uuid; v_id2 uuid; v_folio uuid; v_item uuid;
  v_no text; v_no2 text; v_rcpt text; v_guest text; v_status text; v_fstatus text; v_hk text;
  v_nights int; v_voided int; v_bal numeric; v_charges numeric; v_tax numeric;
  v_out date; v_ts timestamptz; v_by uuid; v_by2 uuid;
  n int; ok boolean; err text; code text;
begin
  perform pg_temp.as_user(u_fd, t_a);

  -- 1) create with deposit and ID: prefix numbering, nightly rows, receipt, balance, attribution, normalisation
  ok := false; err := null;
  begin
    v_id  := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 2, 'phone', 10000, null, 'Probe Guest', '0300 111-2233', null, 5000, 'cash', 1, false, 'cnic', '4210112345671', 'Pakistan');
    v_id2 := public.create_booking(p_a, r_a2, d0 + 5, d0 + 6, 1, 'walk_in', 10000, g1);
    select booking_no, created_by into v_no, v_by from public.bookings where id = v_id;
    select booking_no into v_no2 from public.bookings where id = v_id2;
    v_nights := pg_temp.live_nights(v_id);
    select fi.receipt_no, fi.posted_by into v_rcpt, v_by2 from public.folio_items fi join public.folios f on f.id = fi.folio_id where f.booking_id = v_id and fi.kind = 'payment';
    select balance into v_bal from public.folios where booking_id = v_id;
    select g.phone || ' ' || g.id_number into v_guest from public.guests g join public.bookings b on b.guest_id = g.id where b.id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'create: FX-1001/FX-1002, 2 nights, RCT-1001, balance 15000, stamped by front desk, phone/CNIC normalised';
  pass := (ok and v_no = 'FX-1001' and v_no2 = 'FX-1002' and v_nights = 2 and v_rcpt = 'RCT-1001' and v_bal = 15000
           and v_by = u_fd and v_by2 = u_fd and v_guest = '+923001112233 42101-1234567-1');
  detail := coalesce(err, format('no=%s/%s nights=%s rcpt=%s bal=%s by=%s guest=%s', v_no, v_no2, v_nights, v_rcpt, v_bal, (v_by = u_fd), v_guest)); return next;

  -- 2) no double booking
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1);
    perform public.create_booking(p_a, r_a1, d0 + 6, d0 + 8, 1, 'phone', 10000, g1);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'overlapping stay in one room rejected (23P01)'; pass := (not ok and code = '23P01'); detail := coalesce(err, 'created'); return next;

  -- 3) deposit needs a method; out-of-order room refused
  ok := false; err := null; code := null;
  begin
    perform public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1, null, null, null, 5000, null);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'deposit without a method rejected (HD009)'; pass := (not ok and code = 'HD009'); detail := coalesce(err, 'created'); return next;
  ok := false; err := null; code := null;
  begin
    perform public.create_booking(p_a, r_a3, d0 + 5, d0 + 7, 1, 'phone', 10000, g1);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'out-of-order room refused (HD008)'; pass := (not ok and code = 'HD008'); detail := coalesce(err, 'created'); return next;

  -- 4) check-in rules: ID required, dates window, stamps and room sync
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0, d0 + 2, 1, 'walk_in', 10000, null, 'No Id Guest', null);
    perform public.set_booking_status(v_id, 'checked_in');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'check-in without a guest ID rejected (HD006)'; pass := (not ok and code = 'HD006'); detail := coalesce(err, 'checked in'); return next;
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 3, d0 + 5, 1, 'phone', 10000, g1);
    perform public.set_booking_status(v_id, 'checked_in');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'check-in before the arrival date rejected (HD005)'; pass := (not ok and code = 'HD005'); detail := coalesce(err, 'checked in'); return next;
  ok := false; err := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0, d0 + 2, 1, 'walk_in', 10000, g1);
    perform public.set_booking_status(v_id, 'checked_in');
    select status::text, checked_in_at into v_status, v_ts from public.bookings where id = v_id;
    select status::text into v_fstatus from public.booking_rooms where booking_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'check-in stamps checked_in_at and syncs the room row'; pass := (ok and v_status = 'checked_in' and v_ts is not null and v_fstatus = 'checked_in');
  detail := coalesce(err, format('status=%s stamped=%s room=%s', v_status, v_ts is not null, v_fstatus)); return next;

  -- 5) walk-in (create & check in, 10,000 deposit) then same-day departure: the first night is kept
  --    (minimum one night, migration 19), the 2 unstayed nights are released, folio closed, room dirty, dates truncated
  ok := false; err := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0, d0 + 3, 1, 'walk_in', 10000, null, 'Walkin Guest', '03009998877', null, 10000, 'cash', 0, true, 'cnic', '42101-7654321-9', null);
    select status::text into v_status from public.bookings where id = v_id;
    if v_status <> 'checked_in' then raise exception 'walk-in not checked in: %', v_status; end if;
    perform public.set_booking_status(v_id, 'checked_out');
    select status::text, check_out into v_status, v_out from public.bookings where id = v_id;
    select status::text, balance into v_fstatus, v_bal from public.folios where booking_id = v_id;
    select housekeeping_status::text into v_hk from public.rooms where id = r_a1;
    v_voided := pg_temp.voided_items(v_id);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'walk-in check-in; same-day departure keeps the first night, releases 2, closes the folio, dirties the room, truncates the stay';
  pass := (ok and v_status = 'checked_out' and v_out = d0 + 1 and v_fstatus = 'closed' and v_bal = 0 and v_hk = 'dirty' and v_voided = 2);
  detail := coalesce(err, format('status=%s out=%s folio=%s bal=%s hk=%s voided=%s', v_status, v_out, v_fstatus, v_bal, v_hk, v_voided)); return next;

  -- 6) balance due blocks check-out; manager override leaves a receivable; owner closes after payment
  ok := false; err := null; code := null; v_bal := null; v_by := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0, d0 + 1, 1, 'walk_in', 10000, g1, null, null, null, 0, null, 0, true);
    insert into public.folio_items (folio_id, kind, category, description, amount_pkr) select id, 'charge', 'food', 'Dinner', 2500 from public.folios where booking_id = v_id;
    begin
      perform public.set_booking_status(v_id, 'checked_out');
      err := 'front desk checked out with a balance due';
    exception when others then if sqlstate <> 'HD001' then err := sqlerrm; end if; end;
    begin
      perform public.set_booking_status(v_id, 'checked_out', 'Company will pay');
      err := coalesce(err, 'front desk overrode the balance guard');
    exception when others then if sqlstate <> '42501' then err := coalesce(err, sqlerrm); end if; end;
    perform pg_temp.as_user(u_mgr, t_a);
    perform public.set_booking_status(v_id, 'checked_out', 'Company will pay');
    select status::text, checkout_override_by into v_status, v_by from public.bookings where id = v_id;
    select status::text, balance into v_fstatus, v_bal from public.folios where booking_id = v_id;
    begin
      perform public.close_folio((select id from public.folios where booking_id = v_id));
      err := coalesce(err, 'folio closed with a balance due');
    exception when others then if sqlstate <> 'HD001' then err := coalesce(err, sqlerrm); end if; end;
    perform pg_temp.as_user(u_acc, t_a);
    insert into public.folio_items (folio_id, kind, description, amount_pkr, method) select id, 'payment', 'Company transfer', 2500, 'bank_transfer' from public.folios where booking_id = v_id;
    perform public.close_folio((select id from public.folios where booking_id = v_id));
    select status::text into v_no from public.folios where booking_id = v_id;
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'balance due: front desk blocked (HD001), manager overrides with reason -> receivable, closes once paid';
  pass := (ok and v_status = 'checked_out' and v_by = u_mgr and v_fstatus = 'open' and v_bal = 2500 and v_no = 'closed');
  detail := coalesce(err, format('status=%s override_by_mgr=%s folio=%s bal=%s later=%s', v_status, v_by = u_mgr, v_fstatus, v_bal, v_no)); return next;

  -- 7) credit balance blocks check-out
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0, d0 + 2, 1, 'walk_in', 10000, g1, null, null, null, 30000, 'cash', 0, true);
    perform public.set_booking_status(v_id, 'checked_out');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'credit balance blocks check-out (HD002)'; pass := (not ok and code = 'HD002'); detail := coalesce(err, 'checked out'); return next;

  -- 8) cancellation and no-show void the room nights; deposits stay as credit
  ok := false; err := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1, null, null, null, 5000, 'jazzcash');
    perform public.set_booking_status(v_id, 'cancelled', 'Guest changed plans');
    select f.status::text, f.balance into v_fstatus, v_bal from public.folios f where f.booking_id = v_id;
    v_voided := pg_temp.voided_items(v_id);
    select cancellation_reason into v_no from public.bookings where id = v_id;
    v_id2 := public.create_booking(p_a, r_a2, d0 + 5, d0 + 7, 1, 'phone', 10000, g1);
    perform public.set_booking_status(v_id2, 'no_show');
    select f.status::text into v_status from public.folios f where f.booking_id = v_id2;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'cancel with deposit: nights voided, reason kept, folio open with credit; no-show without deposit closes';
  pass := (ok and v_fstatus = 'open' and v_bal = -5000 and v_voided = 2 and v_no = 'Guest changed plans' and v_status = 'closed');
  detail := coalesce(err, format('folio=%s bal=%s voided=%s reason=%s noshow_folio=%s', v_fstatus, v_bal, v_voided, v_no, v_status)); return next;

  -- 9) reinstating a no-show: owner yes (nights re-posted), front desk no
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1);
    perform public.set_booking_status(v_id, 'no_show');
    begin
      perform public.set_booking_status(v_id, 'confirmed');
      err := 'front desk reinstated a no-show';
    exception when others then if sqlstate <> 'HD003' then err := sqlerrm; end if; end;
    perform pg_temp.as_user(u_owner, t_a);
    perform public.set_booking_status(v_id, 'confirmed');
    select status::text into v_status from public.bookings where id = v_id;
    select status::text, balance into v_fstatus, v_bal from public.folios where booking_id = v_id;
    v_nights := pg_temp.live_nights(v_id);
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'reinstate no-show: owner only; folio reopened with 2 nights re-posted';
  pass := (ok and v_status = 'confirmed' and v_fstatus = 'open' and v_nights = 2 and v_bal = 20000);
  detail := coalesce(err, format('status=%s folio=%s nights=%s bal=%s', v_status, v_fstatus, v_nights, v_bal)); return next;

  -- 10) update_booking: extend + new rate re-posts nights; move into an occupied room fails; in-house check-in locked
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1);
    perform public.update_booking(v_id, r_a1, d0 + 5, d0 + 8, 2, 'walk_in', 16000, 'extended', 1);
    v_nights := pg_temp.live_nights(v_id);
    select balance into v_bal from public.folios where booking_id = v_id;
    select check_out, adults, children into v_out, n, v_voided from public.bookings where id = v_id;
    v_id2 := public.create_booking(p_a, r_a2, d0 + 6, d0 + 7, 1, 'phone', 10000, g1);
    begin
      perform public.update_booking(v_id, r_a2, d0 + 5, d0 + 8, 2, 'walk_in', 16000, null);
      err := 'moved into an occupied room';
    exception when others then if sqlstate <> '23P01' then err := sqlerrm; end if; end;
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  test := 'edit: 3 nights at 16000 re-posted (48000), adults/children saved; move into an occupied room rejected';
  pass := (ok and v_nights = 3 and v_bal = 48000 and v_out = d0 + 8 and n = 2 and v_voided = 1);
  detail := coalesce(err, format('nights=%s bal=%s out=%s adults=%s children=%s', v_nights, v_bal, v_out, n, v_voided)); return next;

  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0, d0 + 3, 1, 'walk_in', 10000, g1, null, null, null, 0, null, 0, true);
    perform public.update_booking(v_id, r_a1, d0 + 1, d0 + 3, 1, 'walk_in', 10000, null);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'edit: check-in locked while in-house (HD005)'; pass := (not ok and code = 'HD005'); detail := coalesce(err, 'changed'); return next;

  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1);
    perform public.set_booking_status(v_id, 'cancelled', 'x');
    perform public.update_booking(v_id, r_a1, d0 + 5, d0 + 8, 1, 'phone', 10000, null);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'edit: a cancelled booking is no longer editable (HD003)'; pass := (not ok and code = 'HD003'); detail := coalesce(err, 'changed'); return next;

  -- 11) direct table writes obey the same rules
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0, d0 + 2, 1, 'walk_in', 10000, g1, null, null, null, 0, null, 0, true);
    insert into public.folio_items (folio_id, kind, category, description, amount_pkr) select id, 'charge', 'laundry', 'Laundry', 800 from public.folios where booking_id = v_id;
    update public.bookings set status = 'checked_out' where id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'direct status flip to checked_out with money owed rejected (HD001)'; pass := (not ok and code = 'HD001'); detail := coalesce(err, 'flipped'); return next;
  ok := false; err := null; code := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1);
    update public.bookings set booking_no = 'HACK-1' where id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'booking number is immutable (HD003)'; pass := (not ok and code = 'HD003'); detail := coalesce(err, 'changed'); return next;

  -- 12) the folio is append-only for the API role
  v_id := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 + 5, d0 + 7, 1, 'phone', 10000, g1, null, null, null, 4000, 'cash');
    select fi.id into v_item from public.folio_items fi join public.folios f on f.id = fi.folio_id where f.booking_id = v_id and fi.kind = 'payment';
  exception when others then err := sqlerrm; end;
  ok := false; err := null; code := null;
  begin
    delete from public.folio_items where id = v_item;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'front desk cannot delete a payment (42501)'; pass := (not ok and code = '42501'); detail := coalesce(err, 'deleted'); return next;
  ok := false; err := null; code := null;
  begin
    update public.folio_items set amount_pkr = 1 where id = v_item;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'front desk cannot edit a payment (42501)'; pass := (not ok and code = '42501'); detail := coalesce(err, 'edited'); return next;
  ok := false; err := null; code := null;
  begin
    update public.folios set balance = 0 where booking_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'folio totals cannot be written through the API (42501)'; pass := (not ok and code = '42501'); detail := coalesce(err, 'written'); return next;

  -- 13) void: manager yes, front desk no; totals follow; double void and closed folio refused
  ok := false; err := null; code := null;
  begin
    perform public.void_folio_item(v_item, 'wrong amount');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; code := sqlstate; end if; end;
  test := 'front desk cannot void (42501)'; pass := (not ok and code = '42501'); detail := coalesce(err, 'voided'); return next;
  ok := false; err := null; v_bal := null;
  begin
    perform pg_temp.as_user(u_mgr, t_a);
    perform public.void_folio_item(v_item, 'wrong amount');
    select balance into v_bal from public.folios where booking_id = v_id;
    begin
      perform public.void_folio_item(v_item, 'again');
      err := 'voided twice';
    exception when others then if sqlstate <> 'HD015' then err := sqlerrm; end if; end;
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'manager voids a payment: balance back to 20000; a second void is refused (HD015)'; pass := (ok and v_bal = 20000); detail := coalesce(err, format('bal=%s', v_bal)); return next;

  -- 14) reopen and close a folio (owner); items cannot be posted while closed
  ok := false; err := null; v_fstatus := null; v_status := null;
  begin
    v_id := public.create_booking(p_a, r_a2, d0, d0 + 1, 1, 'walk_in', 10000, g1, null, null, null, 10000, 'cash', 0, true);
    perform public.set_booking_status(v_id, 'checked_out');   -- same-day departure keeps the (paid) first night: balance 0, folio closed
    select id, status::text into v_folio, v_fstatus from public.folios where booking_id = v_id;
    begin
      insert into public.folio_items (folio_id, kind, category, description, amount_pkr) values (v_folio, 'charge', 'other', 'Late item', 100);
      err := 'posted into a closed folio';
    exception when others then if sqlstate <> 'HD007' then err := sqlerrm; end if; end;
    perform pg_temp.as_user(u_owner, t_a);
    perform public.reopen_folio(v_folio, 'Forgot the minibar');
    insert into public.folio_items (folio_id, kind, category, description, amount_pkr, method) values (v_folio, 'payment', 'other', 'Minibar', 500, 'cash');
    insert into public.folio_items (folio_id, kind, category, description, amount_pkr) values (v_folio, 'charge', 'minibar', 'Minibar', 500);
    perform public.close_folio(v_folio);
    select status::text into v_status from public.folios where id = v_folio;
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'closed folio refuses items (HD007); owner reopens, posts, closes again'; pass := (ok and v_fstatus = 'closed' and v_status = 'closed'); detail := coalesce(err, format('after_checkout=%s after_reopen_close=%s', v_fstatus, v_status)); return next;

  -- 15) late departure: extra nights are charged, dates extended
  ok := false; err := null; v_nights := null; v_out := null;
  begin
    v_id := public.create_booking(p_a, r_a1, d0 - 2, d0 - 1, 1, 'phone', 10000, g1);
    execute 'reset role';
    alter table public.bookings disable trigger lifecycle_guard;
    update public.bookings set status = 'checked_in', checked_in_at = now() - interval '2 days' where id = v_id;
    alter table public.bookings enable trigger lifecycle_guard;
    perform pg_temp.as_user(u_fd, t_a);
    insert into public.folio_items (folio_id, kind, description, amount_pkr, method) select id, 'payment', 'Settle', 20000, 'cash' from public.folios where booking_id = v_id;
    perform public.set_booking_status(v_id, 'checked_out');
    select check_out into v_out from public.bookings where id = v_id;
    v_nights := pg_temp.live_nights(v_id);
    select balance into v_bal from public.folios where booking_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'late departure: the extra night is charged and the stay extended to today'; pass := (ok and v_nights = 2 and v_out = d0 and v_bal = 0); detail := coalesce(err, format('nights=%s out=%s bal=%s', v_nights, v_out, v_bal)); return next;

  -- 16) tax: exclusive on rooms only; inclusive on everything
  ok := false; err := null; v_bal := null;
  begin
    execute 'reset role';
    update public.properties set tax_name = 'Sindh Sales Tax', tax_rate_pct = 13, tax_mode = 'exclusive', tax_applies_to = 'room' where id = p_a;
    perform pg_temp.as_user(u_fd, t_a);
    v_id := public.create_booking(p_a, r_a1, d0 + 10, d0 + 11, 1, 'phone', 10000, g1);
    insert into public.folio_items (folio_id, kind, category, description, amount_pkr) select id, 'charge', 'food', 'Lunch', 1000 from public.folios where booking_id = v_id;
    select balance, total_tax into v_bal, v_tax from public.folios where booking_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'tax exclusive 13% on rooms only: 10000 + 1300 tax + 1000 food = 12300'; pass := (ok and v_bal = 12300 and v_tax = 1300); detail := coalesce(err, format('bal=%s tax=%s', v_bal, v_tax)); return next;
  ok := false; err := null; v_bal := null;
  begin
    execute 'reset role';
    update public.properties set tax_name = 'Sindh Sales Tax', tax_rate_pct = 13, tax_mode = 'inclusive', tax_applies_to = 'all' where id = p_a;
    perform pg_temp.as_user(u_fd, t_a);
    v_id := public.create_booking(p_a, r_a1, d0 + 10, d0 + 11, 1, 'phone', 11300, g1);
    select balance, total_charges, total_tax into v_bal, v_charges, v_tax from public.folios where booking_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  perform pg_temp.as_user(u_fd, t_a);
  test := 'tax inclusive 13%: gross 11300 = net 10000 + tax 1300'; pass := (ok and v_bal = 11300 and v_charges = 10000 and v_tax = 1300); detail := coalesce(err, format('bal=%s net=%s tax=%s', v_bal, v_charges, v_tax)); return next;

  execute 'reset role';
  return;
end $$;

select * from pg_temp.bookings_suite();
rollback;
