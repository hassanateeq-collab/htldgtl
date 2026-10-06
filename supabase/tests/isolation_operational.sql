-- =============================================================================
-- Hotel Digital — operational suite
-- No-double-book semantics, folio triggers under RLS, role matrix, add-on gate,
-- cross-tenant writes. Run as postgres; every write is rolled back.
-- Assumes the demo seed (Central Residence with bookings CR-1001..CR-1014).
-- Expected: every row pass = true.
-- =============================================================================
create or replace function pg_temp.operational_suite()
returns table (test text, pass boolean, detail text)
language plpgsql as $$
declare
  u_demo uuid; t_a uuid; t_b uuid; p_a uuid; p_b uuid;
  r301 uuid; rt301 uuid; r303 uuid; rt303 uuid; g1 uuid; folio1004 uuid; folio1006 uuid;
  bal numeric; n int; n2 int; ok boolean; err text; v_bk uuid;
begin
  -- lookups as postgres
  select id into u_demo from auth.users where email = 'owner@demo.test';
  select id into t_a from public.tenants where slug = 'paramount';
  select id into t_b from public.tenants where slug = 'seaview';
  select id into p_a from public.properties where tenant_id = t_a order by created_at limit 1;
  select id into p_b from public.properties where tenant_id = t_b order by created_at limit 1;
  select r.id, r.room_type_id into r301, rt301 from public.rooms r where r.property_id = p_a and r.label = '301';
  select r.id, r.room_type_id into r303, rt303 from public.rooms r where r.property_id = p_a and r.label = '303';
  select g.id into g1 from public.guests g where g.tenant_id = t_a and g.name = 'Ahmed Raza';
  select f.id into folio1004 from public.folios f join public.bookings b on b.id = f.booking_id
    where b.booking_no = 'CR-1004' and b.property_id = p_a;
  select f.id into folio1006 from public.folios f join public.bookings b on b.id = f.booking_id
    where b.booking_no = 'CR-1006' and b.property_id = p_a;

  -- become the owner of A
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_a))::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.bookings;
  select count(*) into n2 from public.rooms;
  test := 'A: owner sees all 14 bookings and 17 rooms'; pass := (n = 14 and n2 = 17);
  detail := format('bookings=%s rooms=%s', n, n2); return next;

  -- no-double-book: 301 is occupied T-2..T+1 by CR-1001 -> overlapping stay rejected
  ok := false; err := null;
  begin
    insert into public.bookings (tenant_id, property_id, guest_id, booking_no, status, source, check_in, check_out, adults)
    values (t_a, p_a, g1, 'CR-TEST-OVERLAP', 'confirmed', 'walk_in', current_date - 1, current_date, 1) returning id into v_bk;
    insert into public.booking_rooms (booking_id, tenant_id, property_id, room_id, room_type_id, check_in, check_out, status, nightly_rate_pkr)
    values (v_bk, t_a, p_a, r301, rt301, current_date - 1, current_date, 'confirmed', 17000);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'no-double-book: overlapping stay rejected'; pass := (not ok and coalesce(err, '') like '%booking_rooms_no_overlap%');
  detail := coalesce(err, 'insert succeeded'); return next;

  -- same-day turnover: 301 checks out T+1, so a stay T+1..T+3 must be allowed
  ok := false; err := null;
  begin
    insert into public.bookings (tenant_id, property_id, guest_id, booking_no, status, source, check_in, check_out, adults)
    values (t_a, p_a, g1, 'CR-TEST-TURNOVER', 'confirmed', 'walk_in', current_date + 1, current_date + 3, 1) returning id into v_bk;
    insert into public.booking_rooms (booking_id, tenant_id, property_id, room_id, room_type_id, check_in, check_out, status, nightly_rate_pkr)
    values (v_bk, t_a, p_a, r301, rt301, current_date + 1, current_date + 3, 'confirmed', 17000);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'no-double-book: same-day turnover allowed'; pass := ok; detail := coalesce(err, 'ok'); return next;

  -- cancelled stays do not block: 303 holds cancelled CR-1012 for T+1..T+2
  ok := false; err := null;
  begin
    insert into public.bookings (tenant_id, property_id, guest_id, booking_no, status, source, check_in, check_out, adults)
    values (t_a, p_a, g1, 'CR-TEST-CANCELLED', 'confirmed', 'walk_in', current_date + 1, current_date + 2, 1) returning id into v_bk;
    insert into public.booking_rooms (booking_id, tenant_id, property_id, room_id, room_type_id, check_in, check_out, status, nightly_rate_pkr)
    values (v_bk, t_a, p_a, r303, rt303, current_date + 1, current_date + 2, 'confirmed', 17000);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'no-double-book: cancelled stay does not block the room'; pass := ok; detail := coalesce(err, 'ok'); return next;

  -- folio: a staff-posted payment flows through fill + recompute (SECURITY DEFINER, EXECUTE revoked)
  ok := false; err := null; bal := null;
  begin
    insert into public.folio_items (folio_id, tenant_id, property_id, kind, description, amount_pkr, method)
    values (folio1004, t_a, p_a, 'payment', 'Cash on arrival', 5000, 'cash');
    select balance into bal from public.folios where id = folio1004;
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'folio: payment recomputes stored balance (37000 -> 32000)'; pass := (ok and bal = 32000);
  detail := coalesce(err, format('balance=%s', bal)); return next;

  -- folio: closed folio rejects new items
  ok := false; err := null;
  begin
    execute 'reset role';
    update public.folios set status = 'closed', closed_at = now() where id = folio1006;
    perform set_config('role', 'authenticated', true);
    insert into public.folio_items (folio_id, tenant_id, property_id, kind, description, amount_pkr)
    values (folio1006, t_a, p_a, 'charge', 'Late charge', 500);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'folio: closed folio rejects new items'; pass := (not ok and coalesce(err, '') like '%is closed%');
  detail := coalesce(err, 'insert succeeded'); return next;

  -- cross-tenant write: claim A cannot create a booking for B
  ok := false; err := null;
  begin
    insert into public.bookings (tenant_id, property_id, guest_id, booking_no, status, source, check_in, check_out, adults)
    values (t_b, p_b, g1, 'CR-TEST-X', 'confirmed', 'walk_in', current_date, current_date + 1, 1);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'A: cannot create a booking for B'; pass := (not ok); detail := coalesce(err, 'insert succeeded'); return next;

  -- add-on gate: Trial has no addon.rate_plans -> second (non-default) rate plan denied
  ok := false; err := null;
  begin
    insert into public.rate_plans (tenant_id, property_id, name, is_default) values (t_a, p_a, 'Corporate', false);
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'feature gate: extra rate plan denied without addon.rate_plans'; pass := (not ok);
  detail := coalesce(err, 'insert succeeded'); return next;

  -- same user, claim B (front_desk): none of A's data; cannot create room types
  perform set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_b))::text, true);
  select count(*) into n from public.bookings;
  select count(*) into n2 from public.rooms;
  test := 'B: front_desk sees none of A''s bookings or rooms'; pass := (n = 0 and n2 = 0);
  detail := format('bookings=%s rooms=%s', n, n2); return next;
  ok := false; err := null;
  begin
    insert into public.room_types (tenant_id, property_id, name) values (t_b, p_b, 'Standard');
    ok := true; raise exception 'ROLLBACK_PROBE';
  exception when others then if sqlerrm <> 'ROLLBACK_PROBE' then err := sqlerrm; end if; end;
  test := 'B: front_desk cannot create room types'; pass := (not ok); detail := coalesce(err, 'insert succeeded'); return next;

  -- stranger with a forged claim for A
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
            'app_metadata', json_build_object('active_tenant', t_a))::text, true);
  select count(*) into n from public.bookings;
  test := 'stranger with forged claim A sees no bookings'; pass := (n = 0); detail := format('rows=%s', n); return next;

  execute 'reset role';
  return;
end $$;

select * from pg_temp.operational_suite();
