-- =============================================================================
-- Hotel Digital — front-desk booking actions (migration 7)
-- SECURITY INVOKER functions: they run as the caller, so RLS (role, access
-- level, membership) gates every write, while each action is atomic and
-- validated in one place. Errors are raised with stable phrases the app maps
-- to friendly messages: "booking_rooms_no_overlap", "balance due",
-- "cannot go from", "not permitted".
-- =============================================================================

-- <prefix>-<n>: prefix from tenant_settings.settings->>'booking_prefix' (default BK),
-- n = highest existing numeric suffix for that prefix + 1 (series starts at 1001).
-- The unique (property_id, booking_no) constraint is the backstop under concurrency.
create or replace function public.next_booking_no(p_property_id uuid) returns text
language plpgsql stable security invoker set search_path = public as $$
declare
  v_prefix text;
  v_max    int;
begin
  select coalesce(ts.settings ->> 'booking_prefix', 'BK') into v_prefix
  from public.properties p
  left join public.tenant_settings ts on ts.tenant_id = p.tenant_id
  where p.id = p_property_id;
  v_prefix := coalesce(v_prefix, 'BK');

  select coalesce(max(((regexp_match(b.booking_no, '(\d+)$'))[1])::int), 1000) into v_max
  from public.bookings b
  where b.property_id = p_property_id and b.booking_no like v_prefix || '-%';

  return v_prefix || '-' || (v_max + 1);
end $$;

create or replace function public.create_booking(
  p_property_id  uuid,
  p_room_id      uuid,
  p_check_in     date,
  p_check_out    date,
  p_adults       int,
  p_source       public.booking_source,
  p_nightly_rate numeric,
  p_guest_id     uuid default null,
  p_guest_name   text default null,
  p_guest_phone  text default null,
  p_notes        text default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_tenant    uuid;
  v_guest     uuid := p_guest_id;
  v_room_type uuid;
  v_booking   uuid;
  v_folio     uuid;
  v_no        text;
  v_nights    int;
  v_try       int := 0;
begin
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  if v_tenant is null then
    raise exception 'create_booking: unknown property';
  end if;
  if p_check_out <= p_check_in then
    raise exception 'create_booking: check-out must be after check-in';
  end if;

  select room_type_id into v_room_type
  from public.rooms where id = p_room_id and property_id = p_property_id and is_active;
  if v_room_type is null then
    raise exception 'create_booking: unknown or inactive room';
  end if;

  if v_guest is null then
    if coalesce(trim(p_guest_name), '') = '' then
      raise exception 'create_booking: guest name required';
    end if;
    insert into public.guests (tenant_id, name, phone)
    values (v_tenant, trim(p_guest_name), nullif(trim(p_guest_phone), ''))
    returning id into v_guest;
  end if;

  v_nights := p_check_out - p_check_in;

  loop
    v_try := v_try + 1;
    v_no  := public.next_booking_no(p_property_id);
    begin
      insert into public.bookings
        (tenant_id, property_id, guest_id, booking_no, status, source, check_in, check_out, adults, notes, created_by)
      values
        (v_tenant, p_property_id, v_guest, v_no, 'confirmed', p_source, p_check_in, p_check_out,
         greatest(coalesce(p_adults, 1), 1), nullif(trim(p_notes), ''), auth.uid())
      returning id into v_booking;
      exit;
    exception when unique_violation then
      if v_try >= 3 then raise; end if;
    end;
  end loop;

  -- the no-double-book EXCLUDE constraint fires here if the room is taken
  insert into public.booking_rooms
    (booking_id, tenant_id, property_id, room_id, room_type_id, check_in, check_out, status, nightly_rate_pkr)
  values
    (v_booking, v_tenant, p_property_id, p_room_id, v_room_type, p_check_in, p_check_out, 'confirmed',
     coalesce(p_nightly_rate, 0));

  -- auto-post the room charge for the stay (folio was created by trigger)
  select id into v_folio from public.folios where booking_id = v_booking;
  if v_folio is not null and coalesce(p_nightly_rate, 0) > 0 then
    insert into public.folio_items (folio_id, tenant_id, property_id, kind, description, amount_pkr)
    values (v_folio, v_tenant, p_property_id, 'charge',
            format('Room charge · %s night%s', v_nights, case when v_nights = 1 then '' else 's' end),
            v_nights * p_nightly_rate);
  end if;

  return v_booking;
end $$;

create or replace function public.set_booking_status(p_booking_id uuid, p_status public.booking_status)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_cur     public.booking_status;
  v_folio   uuid;
  v_balance numeric;
  v_n       int;
begin
  select status into v_cur from public.bookings where id = p_booking_id;
  if v_cur is null then
    raise exception 'set_booking_status: booking not found';
  end if;

  if not (
       (v_cur = 'confirmed'  and p_status in ('checked_in', 'cancelled', 'no_show'))
    or (v_cur = 'checked_in' and p_status = 'checked_out')
  ) then
    raise exception 'set_booking_status: cannot go from % to %', v_cur, p_status;
  end if;

  if p_status = 'checked_out' then
    select id, balance into v_folio, v_balance from public.folios where booking_id = p_booking_id;
    if coalesce(v_balance, 0) > 0 then
      raise exception 'set_booking_status: balance due % must be settled before check-out', v_balance;
    end if;
  end if;

  update public.bookings set status = p_status where id = p_booking_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'set_booking_status: not permitted';
  end if;
  update public.booking_rooms set status = p_status where booking_id = p_booking_id;

  if p_status = 'checked_out' then
    if v_folio is not null then
      update public.folios set status = 'closed', closed_at = now() where id = v_folio;
    end if;
    update public.rooms r
       set housekeeping_status = 'dirty'
      from public.booking_rooms br
     where br.booking_id = p_booking_id and r.id = br.room_id;
  end if;
end $$;

revoke execute on function public.next_booking_no(uuid) from public, anon;
revoke execute on function public.create_booking(uuid, uuid, date, date, int, public.booking_source, numeric, uuid, text, text, text) from public, anon;
revoke execute on function public.set_booking_status(uuid, public.booking_status) from public, anon;
grant  execute on function public.next_booking_no(uuid) to authenticated, service_role;
grant  execute on function public.create_booking(uuid, uuid, date, date, int, public.booking_source, numeric, uuid, text, text, text) to authenticated, service_role;
grant  execute on function public.set_booking_status(uuid, public.booking_status) to authenticated, service_role;
