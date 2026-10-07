-- =============================================================================
-- Hotel Digital — booking actions suite
-- create_booking() and set_booking_status() as the demo owner: numbering,
-- auto-posted charge, no-double-book rejection, transition rules, the
-- balance-due check-out guard, folio close + room dirty on check-out, early
-- departure releasing the room, and cross-tenant denial. Every write is rolled
-- back. Assumes the demo seed (Central Residence, booking_prefix CR; CR-1004
-- confirmed with a balance due, CR-1006 checked out, CR-1009 checked in on a
-- multi-night stay in room 305, room 203 free a week out, room 301 occupied
-- yesterday). Expected: every row pass = true.
-- =============================================================================
create or replace function pg_temp.booking_actions_suite()
returns table (test text, pass boolean, detail text)
language plpgsql as $$
declare
  u_demo uuid; t_a uuid; t_b uuid; p_a uuid;
  r203 uuid; r301 uuid; r305 uuid;
  bk1001 uuid; bk1004 uuid; bk1006 uuid; bk1009 uuid; folio1004 uuid; folio1009 uuid;
  v_id uuid; v_no text; v_expected text; v_charges numeric;
  v_status text; v_folio_status text; v_hk text; v_out date; v_room_out date;
  ok boolean; err text;
begin
  select id into u_demo from auth.users where email = 'owner@demo.test';
  select id into t_a from public.tenants where slug = 'paramount';
  select id into t_b from public.tenants where slug = 'seaview';
  select id into p_a from public.properties where tenant_id = t_a order by created_at limit 1;
  select id into r203 from public.rooms where property_id = p_a and label = '203';
  select id into r301 from public.rooms where property_id = p_a and label = '301';
  select id into r305 from public.rooms where property_id = p_a and label = '305';
  select id into bk1001 from public.bookings where property_id = p_a and booking_no = 'CR-1001';
  select id into bk1004 from public.bookings where property_id = p_a and booking_no = 'CR-1004';
  select id into bk1006 from public.bookings where property_id = p_a and booking_no = 'CR-1006';
  select id into bk1009 from public.bookings where property_id = p_a and booking_no = 'CR-1009';
  select id into folio1004 from public.folios where booking_id = bk1004;
  select id into folio1009 from public.folios where booking_id = bk1009;

  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_a))::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1) free room: created, numbered next in the series, room charge auto-posted
  ok := false; err := null; v_no := null; v_charges := null;
  v_expected := public.next_booking_no(p_a);
  begin
    v_id := public.create_booking(p_a, r203, current_date + 5, current_date + 7, 2, 'phone', 15000,
                                  null, 'Test Guest', '03001234567', null);
    select booking_no into v_no from public.bookings where id = v_id;
    select total_charges into v_charges from public.folios where booking_id = v_id;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'create_booking: free room -> created, next number, charge 30000';
  pass := (ok and v_no = v_expected and v_charges = 30000);
  detail := coalesce(err, format('no=%s expected=%s charges=%s', v_no, v_expected, v_charges)); return next;

  -- 2) overlapping room -> exclusion violation surfaces
  ok := false; err := null;
  begin
    v_id := public.create_booking(p_a, r301, current_date - 1, current_date, 1, 'walk_in', 17000,
                                  null, 'Overlap Guest', null, null);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'create_booking: overlapping room rejected';
  pass := (not ok and coalesce(err, '') like '%booking_rooms_no_overlap%');
  detail := coalesce(err, 'created'); return next;

  -- 3) check-in, check-out blocked while balance due, settle, check-out closes folio + dirties room
  ok := false; err := null; v_status := null; v_folio_status := null; v_hk := null;
  begin
    perform public.set_booking_status(bk1004, 'checked_in');
    begin
      perform public.set_booking_status(bk1004, 'checked_out');
      err := 'check-out allowed with balance due';
    exception when others then
      if sqlerrm not like '%balance due%' then err := sqlerrm; end if;
    end;
    insert into public.folio_items (folio_id, kind, description, amount_pkr, method)
    select folio1004, 'payment', 'Settle', f.balance, 'cash' from public.folios f where f.id = folio1004;
    perform public.set_booking_status(bk1004, 'checked_out');
    select status::text into v_status from public.bookings where id = bk1004;
    select status::text into v_folio_status from public.folios where id = folio1004;
    select housekeeping_status::text into v_hk from public.rooms where property_id = p_a and label = '401';
    ok := (err is null); raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := coalesce(err, sqlerrm); end if; end;
  test := 'set_booking_status: check-in, balance guard, settle, check-out';
  pass := (ok and v_status = 'checked_out' and v_folio_status = 'closed' and v_hk = 'dirty');
  detail := coalesce(err, format('status=%s folio=%s room401=%s', v_status, v_folio_status, v_hk)); return next;

  -- 4) invalid transition (CR-1006 is checked_out)
  ok := false; err := null;
  begin
    perform public.set_booking_status(bk1006, 'checked_in');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'set_booking_status: invalid transition rejected';
  pass := (not ok and coalesce(err, '') like '%cannot go from%');
  detail := coalesce(err, 'allowed'); return next;

  -- 5) early departure: CR-1009 (in-house, planned beyond today) checks out today ->
  --    stay truncated to today on booking + room, and room 305 is bookable tonight
  ok := false; err := null; v_out := null; v_room_out := null;
  begin
    insert into public.folio_items (folio_id, kind, description, amount_pkr, method)
    select folio1009, 'payment', 'Settle', f.balance, 'cash' from public.folios f where f.id = folio1009 and f.balance > 0;
    perform public.set_booking_status(bk1009, 'checked_out');
    select check_out into v_out from public.bookings where id = bk1009;
    select check_out into v_room_out from public.booking_rooms where booking_id = bk1009;
    v_id := public.create_booking(p_a, r305, current_date, current_date + 1, 1, 'walk_in', 17000,
                                  null, 'Rebook Tonight', null, null);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'early departure: stay truncated to today, room rebookable tonight';
  pass := (ok and v_out = current_date and v_room_out = current_date);
  detail := coalesce(err, format('check_out=%s room_check_out=%s', v_out, v_room_out)); return next;

  -- 6) same user with claim B (front_desk of Seaview) cannot touch A's booking
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_b))::text, true);
  ok := false; err := null;
  begin
    perform public.set_booking_status(bk1001, 'checked_out');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'cross-tenant: B user cannot change an A booking';
  pass := (not ok); detail := coalesce(err, 'changed'); return next;

  execute 'reset role';
  return;
end $$;

select * from pg_temp.booking_actions_suite();
