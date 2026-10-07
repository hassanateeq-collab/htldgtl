-- ---------------------------------------------------------------------------
-- Hotel Digital — minimum one night on early departure (migration 19)
--
-- A guest who checks in and leaves on the same hotel day has still used the
-- room for a night. Early departure now releases unstayed nights only from
-- greatest(today, check_in + 1); the stay keeps at least its first night and
-- check_out never collapses onto check_in. ADR 0006, addendum 2026-10-08.
--
-- Re-declares bookings_guard() from migration 12 with that one change in the
-- checked_out branch; everything else is identical.
-- ---------------------------------------------------------------------------

create or replace function public.bookings_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prop         public.properties%rowtype;
  v_today        date;
  v_release_from date;
  v_role         public.tenant_role;
  v_folio        public.folios%rowtype;
  v_guest        public.guests%rowtype;
begin
  select * into v_prop from public.properties where id = new.property_id;
  if v_prop.id is null then
    raise exception 'bookings: property not found' using errcode = 'P0002';
  end if;
  v_today := (now() at time zone coalesce(v_prop.timezone, 'Asia/Karachi'))::date;
  v_role  := coalesce(public.current_role_in_tenant(),
                      case when auth.uid() is null or public.is_platform_admin() then 'owner'::public.tenant_role end);

  if tg_op = 'INSERT' then
    if new.status <> 'confirmed' then
      raise exception 'bookings: new bookings start as confirmed' using errcode = 'HD003';
    end if;
    if new.check_out <= new.check_in then
      raise exception 'bookings: check-out must be after check-in' using errcode = 'HD005';
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := new.created_by;
    return new;
  end if;

  if (new.tenant_id, new.property_id, new.booking_no) is distinct from (old.tenant_id, old.property_id, old.booking_no) then
    raise exception 'bookings: tenant, property and booking number are immutable' using errcode = 'HD003';
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  -- plain edit (no status change)
  if new.status = old.status then
    if old.status in ('checked_out', 'cancelled', 'no_show')
       and (new.check_in, new.check_out, new.guest_id, new.adults, new.children, new.source)
           is distinct from (old.check_in, old.check_out, old.guest_id, old.adults, old.children, old.source) then
      raise exception 'bookings: a closed booking is no longer editable' using errcode = 'HD003';
    end if;
    if new.status in ('confirmed', 'checked_in') and new.check_out <= new.check_in then
      raise exception 'bookings: check-out must be after check-in' using errcode = 'HD005';
    end if;
    if old.status = 'checked_in' then
      if new.check_in <> old.check_in then
        raise exception 'bookings: check-in is locked for an in-house stay' using errcode = 'HD005';
      end if;
      if new.check_out <= v_today then
        raise exception 'bookings: an in-house stay must end after today — use check-out instead' using errcode = 'HD005';
      end if;
    end if;
    return new;
  end if;

  -- status change
  if not public.booking_transition_allowed(old.status, new.status, v_role) then
    raise exception 'bookings: cannot go from % to %', old.status, new.status using errcode = 'HD003';
  end if;

  if new.status = 'checked_in' then
    if v_today < new.check_in or v_today >= new.check_out then
      raise exception 'bookings: check-in is only possible from the arrival date until the night before departure — change the dates first' using errcode = 'HD005';
    end if;
    if v_prop.require_id_at_check_in then
      select * into v_guest from public.guests where id = new.guest_id;
      if coalesce(v_guest.id_number, v_guest.cnic, v_guest.passport) is null then
        raise exception 'bookings: the guest''s ID document is required before check-in' using errcode = 'HD006';
      end if;
    end if;
    perform 1 from public.booking_rooms br join public.rooms r on r.id = br.room_id
     where br.booking_id = new.id and (not r.is_active or r.housekeeping_status = 'out_of_order');
    if found then
      raise exception 'bookings: the assigned room is out of order — move the booking first' using errcode = 'HD008';
    end if;
    new.checked_in_at := now();

  elsif new.status = 'checked_out' then
    -- The stay keeps at least its first night: a same-day departure still used the room.
    v_release_from := greatest(v_today, new.check_in + 1);
    if v_release_from < new.check_out then
      -- early departure: unstayed nights from v_release_from are released (property policy)
      if v_prop.early_departure_policy = 'release' then
        perform public._void_room_nights(new.id, v_release_from, 'Early departure');
      end if;
      new.check_out := v_release_from;
    elsif v_today > new.check_out then
      -- late departure: the extra nights are charged (the room must still be free)
      perform public._post_room_nights(new.id, old.check_out, v_today, null);
      new.check_out := v_today;
    end if;
    select * into v_folio from public.folios where booking_id = new.id;
    if v_folio.balance > 0 then
      if coalesce(trim(new.checkout_override_reason), '') = '' then
        raise exception 'bookings: balance due % must be settled before check-out', v_folio.balance using errcode = 'HD001';
      end if;
      if v_role not in ('owner', 'manager') then
        raise exception 'bookings: only an owner or manager can check out with a balance due' using errcode = '42501';
      end if;
      new.checkout_override_by := coalesce(auth.uid(), new.checkout_override_by);
    elsif v_folio.balance < 0 then
      raise exception 'bookings: the folio holds a credit of % — refund it before check-out', -v_folio.balance using errcode = 'HD002';
    else
      new.checkout_override_reason := null;
      new.checkout_override_by     := null;
    end if;
    new.checked_out_at := now();

  elsif new.status = 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := coalesce(auth.uid(), new.cancelled_by);
    perform public._void_room_nights(new.id, null, 'Booking cancelled');

  elsif new.status = 'no_show' then
    new.no_show_at := now();
    perform public._void_room_nights(new.id, null, 'No-show');

  elsif new.status = 'confirmed' then
    -- undo check-in, or reinstate a cancelled / no-show booking
    if old.status = 'checked_in' then
      new.checked_in_at := null;
    else
      update public.folios set status = 'open', closed_at = null where booking_id = new.id and status = 'closed';
      perform public._post_room_nights(new.id, new.check_in, new.check_out, null);
      new.cancelled_at := null;
      new.cancelled_by := null;
      new.cancellation_reason := null;
      new.no_show_at := null;
    end if;
  end if;
  return new;
end $$;
