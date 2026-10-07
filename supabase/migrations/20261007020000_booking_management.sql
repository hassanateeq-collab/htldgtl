-- =============================================================================
-- Hotel Digital — booking management (migration 9)
-- 1) Folio items gain 'discount' (reduces charges) and 'refund' (reduces
--    payments). balance = (charges − discounts) − (payments − refunds).
--    Enum comparisons below use ::text so the new values are safe to reference
--    in the same transaction that adds them.
-- 2) create_booking() accepts an optional advance payment (deposit).
-- 3) update_booking(): move room / change dates, rate, adults, source, notes.
--    The no-double-book EXCLUDE constraint re-validates the new assignment; the
--    auto-posted room charge is kept in step with nights × rate. Check-in is
--    locked once the guest is in-house. SECURITY INVOKER: RLS applies.
-- =============================================================================

alter type public.folio_item_kind add value if not exists 'discount';
alter type public.folio_item_kind add value if not exists 'refund';

-- payments and refunds carry a method; charges and discounts do not
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.folio_items'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%method IS NOT NULL%'
  loop
    execute format('alter table public.folio_items drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.folio_items add constraint folio_items_method_check
  check ((kind::text in ('payment', 'refund')) = (method is not null));

create or replace function public.recompute_folio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_folio uuid := coalesce(new.folio_id, old.folio_id);
begin
  update public.folios f
     set total_charges  = s.charges,
         total_payments = s.payments,
         balance        = s.charges - s.payments
    from (
      select coalesce(sum(case when kind::text = 'charge'   then amount_pkr end), 0)
           - coalesce(sum(case when kind::text = 'discount' then amount_pkr end), 0) as charges,
             coalesce(sum(case when kind::text = 'payment'  then amount_pkr end), 0)
           - coalesce(sum(case when kind::text = 'refund'   then amount_pkr end), 0) as payments
      from public.folio_items
      where folio_id = v_folio
    ) s
   where f.id = v_folio;
  return null;
end $$;

-- ---------------------------------------------- create_booking with deposit ----
drop function if exists public.create_booking(uuid, uuid, date, date, integer, public.booking_source, numeric, uuid, text, text, text);

create or replace function public.create_booking(
  p_property_id    uuid,
  p_room_id        uuid,
  p_check_in       date,
  p_check_out      date,
  p_adults         int,
  p_source         public.booking_source,
  p_nightly_rate   numeric,
  p_guest_id       uuid default null,
  p_guest_name     text default null,
  p_guest_phone    text default null,
  p_notes          text default null,
  p_deposit        numeric default 0,
  p_deposit_method public.payment_method default null
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
  if coalesce(p_deposit, 0) > 0 and p_deposit_method is null then
    raise exception 'create_booking: deposit needs a payment method';
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

  insert into public.booking_rooms
    (booking_id, tenant_id, property_id, room_id, room_type_id, check_in, check_out, status, nightly_rate_pkr)
  values
    (v_booking, v_tenant, p_property_id, p_room_id, v_room_type, p_check_in, p_check_out, 'confirmed',
     coalesce(p_nightly_rate, 0));

  select id into v_folio from public.folios where booking_id = v_booking;
  if v_folio is not null then
    if coalesce(p_nightly_rate, 0) > 0 then
      insert into public.folio_items (folio_id, tenant_id, property_id, kind, description, amount_pkr)
      values (v_folio, v_tenant, p_property_id, 'charge',
              format('Room charge · %s night%s', v_nights, case when v_nights = 1 then '' else 's' end),
              v_nights * p_nightly_rate);
    end if;
    if coalesce(p_deposit, 0) > 0 then
      insert into public.folio_items (folio_id, tenant_id, property_id, kind, description, amount_pkr, method)
      values (v_folio, v_tenant, p_property_id, 'payment', 'Advance payment', p_deposit, p_deposit_method);
    end if;
  end if;

  return v_booking;
end $$;

-- ------------------------------------------------------------ update_booking ----
create or replace function public.update_booking(
  p_booking_id   uuid,
  p_room_id      uuid,
  p_check_in     date,
  p_check_out    date,
  p_adults       int,
  p_source       public.booking_source,
  p_nightly_rate numeric,
  p_notes        text default null
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_b         public.bookings%rowtype;
  v_room_type uuid;
  v_folio     uuid;
  v_charge    uuid;
  v_nights    int;
  v_amount    numeric;
  v_n         int;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if v_b.id is null then
    raise exception 'update_booking: booking not found';
  end if;
  if v_b.status not in ('confirmed', 'checked_in') then
    raise exception 'update_booking: cannot go from % — booking is no longer editable', v_b.status;
  end if;
  if p_check_out <= p_check_in then
    raise exception 'update_booking: check-out must be after check-in';
  end if;
  if v_b.status = 'checked_in' and p_check_in <> v_b.check_in then
    raise exception 'update_booking: check-in is locked for an in-house stay';
  end if;

  select room_type_id into v_room_type
  from public.rooms where id = p_room_id and property_id = v_b.property_id and is_active;
  if v_room_type is null then
    raise exception 'update_booking: unknown or inactive room';
  end if;

  update public.bookings
     set check_in  = p_check_in,
         check_out = p_check_out,
         adults    = greatest(coalesce(p_adults, 1), 1),
         source    = p_source,
         notes     = nullif(trim(p_notes), '')
   where id = p_booking_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'update_booking: not permitted';
  end if;

  -- v1: one room per booking. The EXCLUDE constraint re-validates the move.
  update public.booking_rooms
     set room_id          = p_room_id,
         room_type_id     = v_room_type,
         check_in         = p_check_in,
         check_out        = p_check_out,
         nightly_rate_pkr = coalesce(p_nightly_rate, 0)
   where booking_id = p_booking_id;

  -- keep the auto-posted room charge in step while the folio is open
  v_nights := p_check_out - p_check_in;
  v_amount := v_nights * coalesce(p_nightly_rate, 0);
  select f.id into v_folio from public.folios f where f.booking_id = p_booking_id and f.status = 'open';
  if v_folio is not null then
    select fi.id into v_charge
    from public.folio_items fi
    where fi.folio_id = v_folio and fi.kind::text = 'charge' and fi.description like 'Room charge%'
    order by fi.posted_at
    limit 1;

    if v_charge is not null then
      if v_amount > 0 then
        update public.folio_items
           set amount_pkr  = v_amount,
               description = format('Room charge · %s night%s', v_nights, case when v_nights = 1 then '' else 's' end)
         where id = v_charge;
      else
        delete from public.folio_items where id = v_charge;
      end if;
    elsif v_amount > 0 then
      insert into public.folio_items (folio_id, tenant_id, property_id, kind, description, amount_pkr)
      values (v_folio, v_b.tenant_id, v_b.property_id, 'charge',
              format('Room charge · %s night%s', v_nights, case when v_nights = 1 then '' else 's' end),
              v_amount);
    end if;
  end if;
end $$;

revoke execute on function public.create_booking(uuid, uuid, date, date, int, public.booking_source, numeric, uuid, text, text, text, numeric, public.payment_method) from public, anon;
grant  execute on function public.create_booking(uuid, uuid, date, date, int, public.booking_source, numeric, uuid, text, text, text, numeric, public.payment_method) to authenticated, service_role;
revoke execute on function public.update_booking(uuid, uuid, date, date, int, public.booking_source, numeric, text) from public, anon;
grant  execute on function public.update_booking(uuid, uuid, date, date, int, public.booking_source, numeric, text) to authenticated, service_role;
