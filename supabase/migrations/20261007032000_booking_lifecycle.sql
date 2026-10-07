-- =============================================================================
-- Hotel Digital — booking lifecycle (migration 12, Release A part 3 of 5)
--
-- The state machine moves into the database so it holds for every path, not
-- only the RPCs:
-- * bookings_guard (BEFORE INSERT/UPDATE) validates transitions and edits,
--   stamps checked_in_at / checked_out_at / cancelled_at / no_show_at and the
--   actor, requires the guest's ID at check-in (property setting), refuses
--   check-in outside the stay or into an out-of-order room, releases unstayed
--   nights on early departure (property policy), charges extra nights on late
--   departure, voids room charges on cancellation / no-show, and blocks
--   check-out with a balance due unless an owner/manager records a reason
--   (the folio then stays open as a receivable). Credit balances must be
--   refunded before check-out.
-- * bookings_effects (AFTER UPDATE) keeps the room assignment in step, closes
--   the folio when settled and marks the room dirty.
-- * booking_rooms is written only by _assign_room(); folio room charges only
--   by _post_room_nights() / _void_room_nights(). The RPCs lock the booking
--   row (for update) so concurrent actions serialise.
-- * guests gain an identity document (id_type, id_number, id_expiry, address);
--   cnic / passport stay as legacy columns until the app has moved over.
-- =============================================================================

-- ------------------------------------------------------------- columns ----
alter table public.bookings
  add column if not exists checked_in_at            timestamptz,
  add column if not exists checked_out_at           timestamptz,
  add column if not exists cancelled_at             timestamptz,
  add column if not exists cancelled_by             uuid,
  add column if not exists cancellation_reason      text,
  add column if not exists no_show_at               timestamptz,
  add column if not exists checkout_override_reason text,
  add column if not exists checkout_override_by     uuid,
  add column if not exists updated_by               uuid;

update public.bookings set checked_in_at  = coalesce(checked_in_at,  updated_at) where status in ('checked_in', 'checked_out');
update public.bookings set checked_out_at = coalesce(checked_out_at, updated_at) where status = 'checked_out';
update public.bookings set cancelled_at   = coalesce(cancelled_at,   updated_at) where status = 'cancelled';
update public.bookings set no_show_at     = coalesce(no_show_at,     updated_at) where status = 'no_show';

-- v1: exactly one room per booking (multi-room arrives with room-level RPCs)
alter table public.booking_rooms add constraint booking_rooms_booking_id_key unique (booking_id);

alter table public.guests
  add column if not exists id_type   text,
  add column if not exists id_number text,
  add column if not exists id_expiry date,
  add column if not exists address   text;
update public.guests set id_type = 'cnic',     id_number = cnic     where id_number is null and cnic is not null;
update public.guests set id_type = 'passport', id_number = passport where id_number is null and passport is not null;
alter table public.guests
  add constraint guests_id_type_check check (id_type is null or id_type in ('cnic', 'nicop', 'poc', 'passport', 'other')),
  add constraint guests_id_pair_check check ((id_type is null) = (id_number is null)),
  add constraint guests_cnic_format_check check (id_type is distinct from 'cnic' or id_number ~ '^[0-9]{5}-[0-9]{7}-[0-9]$'),
  add constraint guests_phone_check check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');

-- ------------------------------------------------------------ helpers ----
-- Who may change bookings in this tenant (mirrors the bookings write policy).
create or replace function public._assert_booking_writer(p_tenant_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role public.tenant_role;
begin
  if auth.uid() is null or public.is_platform_admin() then return; end if;
  v_role := public.current_role_in_tenant();
  if p_tenant_id is distinct from public.current_tenant_id()
     or public.tenant_access_level() is distinct from 'full'
     or v_role is null or v_role not in ('owner', 'manager', 'front_desk') then
    raise exception 'bookings: not permitted' using errcode = '42501';
  end if;
end $$;

-- Assign or move the booking's room. Dates are passed explicitly so the
-- no-double-book constraint judges the final room + dates combination.
create or replace function public._assign_room(p_booking_id uuid, p_room_id uuid, p_rate numeric, p_check_in date, p_check_out date) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_b    public.bookings%rowtype;
  v_room public.rooms%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if v_b.id is null then
    raise exception 'bookings: booking not found' using errcode = 'P0002';
  end if;
  perform public._assert_booking_writer(v_b.tenant_id);
  select * into v_room from public.rooms where id = p_room_id and property_id = v_b.property_id;
  if v_room.id is null or not v_room.is_active then
    raise exception 'bookings: unknown or inactive room' using errcode = 'HD008';
  end if;
  if v_room.housekeeping_status = 'out_of_order' then
    raise exception 'bookings: room % is out of order', v_room.label using errcode = 'HD008';
  end if;
  if exists (select 1 from public.booking_rooms where booking_id = p_booking_id) then
    update public.booking_rooms
       set room_id = p_room_id, room_type_id = v_room.room_type_id,
           check_in = p_check_in, check_out = p_check_out,
           nightly_rate_pkr = coalesce(p_rate, 0)
     where booking_id = p_booking_id;
  else
    insert into public.booking_rooms
      (booking_id, tenant_id, property_id, room_id, room_type_id, check_in, check_out, status, nightly_rate_pkr)
    values
      (p_booking_id, v_b.tenant_id, v_b.property_id, p_room_id, v_room.room_type_id, p_check_in, p_check_out, v_b.status, coalesce(p_rate, 0));
  end if;
end $$;

-- Post one room charge per night in [p_from, p_to) while the folio is open.
create or replace function public._post_room_nights(p_booking_id uuid, p_from date, p_to date, p_rate numeric) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_b     public.bookings%rowtype;
  v_br    public.booking_rooms%rowtype;
  v_folio uuid;
  v_rate  numeric;
  d       date;
  n       integer := 0;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if v_b.id is null then
    raise exception 'bookings: booking not found' using errcode = 'P0002';
  end if;
  perform public._assert_booking_writer(v_b.tenant_id);
  select * into v_br from public.booking_rooms where booking_id = p_booking_id;
  v_rate := coalesce(p_rate, v_br.nightly_rate_pkr, 0);
  select id into v_folio from public.folios where booking_id = p_booking_id and status = 'open';
  if v_folio is null or v_rate <= 0 then return 0; end if;
  d := p_from;
  while d < p_to loop
    insert into public.folio_items (folio_id, kind, category, source, description, amount_pkr, service_date, booking_room_id)
    values (v_folio, 'charge', 'room', 'auto', 'Room charge', v_rate, d, v_br.id);
    n := n + 1;
    d := d + 1;
  end loop;
  return n;
end $$;

-- Void the live auto-posted room nights from p_from onwards (null = all).
create or replace function public._void_room_nights(p_booking_id uuid, p_from date, p_reason text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_b     public.bookings%rowtype;
  v_folio uuid;
  n       integer;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if v_b.id is null then
    raise exception 'bookings: booking not found' using errcode = 'P0002';
  end if;
  perform public._assert_booking_writer(v_b.tenant_id);
  select id into v_folio from public.folios where booking_id = p_booking_id and status = 'open';
  if v_folio is null then return 0; end if;
  update public.folio_items
     set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   where folio_id = v_folio and kind = 'charge' and category = 'room' and source = 'auto' and voided_at is null
     and (p_from is null or service_date is null or service_date >= p_from);
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public._assert_booking_writer(uuid)                       from public, anon, authenticated;
revoke execute on function public._assign_room(uuid, uuid, numeric, date, date)       from public, anon;
revoke execute on function public._post_room_nights(uuid, date, date, numeric)        from public, anon;
revoke execute on function public._void_room_nights(uuid, date, text)                 from public, anon;
grant  execute on function public._assign_room(uuid, uuid, numeric, date, date)       to authenticated, service_role;
grant  execute on function public._post_room_nights(uuid, date, date, numeric)        to authenticated, service_role;
grant  execute on function public._void_room_nights(uuid, date, text)                 to authenticated, service_role;

-- --------------------------------------------------------- transitions ----
create or replace function public.booking_transition_allowed(p_from public.booking_status, p_to public.booking_status, p_role public.tenant_role)
returns boolean language sql immutable as $$
  select case
    when p_from = 'confirmed'  and p_to in ('checked_in', 'cancelled', 'no_show') then true
    when p_from = 'checked_in' and p_to = 'checked_out' then true
    -- corrections, owner / manager only
    when p_from = 'checked_in' and p_to = 'confirmed' and p_role in ('owner', 'manager') then true
    when p_from in ('no_show', 'cancelled') and p_to = 'confirmed' and p_role in ('owner', 'manager') then true
    else false
  end
$$;

create or replace function public.bookings_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prop  public.properties%rowtype;
  v_today date;
  v_role  public.tenant_role;
  v_folio public.folios%rowtype;
  v_guest public.guests%rowtype;
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
    if v_today < new.check_out then
      -- early departure: today becomes the departure day; unstayed nights are released
      if v_prop.early_departure_policy = 'release' then
        perform public._void_room_nights(new.id, v_today, 'Early departure');
      end if;
      new.check_out := v_today;
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

create or replace function public.bookings_effects() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.booking_rooms
     set status = new.status, check_in = new.check_in, check_out = new.check_out
   where booking_id = new.id
     and (status, check_in, check_out) is distinct from (new.status, new.check_in, new.check_out);

  if new.status <> old.status then
    if new.status = 'checked_out' then
      update public.folios set status = 'closed', closed_at = now()
       where booking_id = new.id and status = 'open' and balance <= 0;
      update public.rooms r
         set housekeeping_status = 'dirty'
        from public.booking_rooms br
       where br.booking_id = new.id and r.id = br.room_id and r.housekeeping_status <> 'out_of_order';
    elsif new.status in ('cancelled', 'no_show') then
      update public.folios set status = 'closed', closed_at = now()
       where booking_id = new.id and status = 'open' and balance = 0;
    end if;
  end if;
  return null;
end $$;

revoke execute on function public.bookings_guard()   from public, anon, authenticated;
revoke execute on function public.bookings_effects() from public, anon, authenticated;
create trigger lifecycle_guard   before insert or update on public.bookings for each row execute function public.bookings_guard();
create trigger lifecycle_effects after update           on public.bookings for each row execute function public.bookings_effects();

-- ---------------------------------------------------------------- RPCs ----
drop function if exists public.create_booking(uuid, uuid, date, date, integer, public.booking_source, numeric, uuid, text, text, text, numeric, public.payment_method);

create or replace function public.create_booking(
  p_property_id       uuid,
  p_room_id           uuid,
  p_check_in          date,
  p_check_out         date,
  p_adults            integer,
  p_source            public.booking_source,
  p_nightly_rate      numeric,
  p_guest_id          uuid    default null,
  p_guest_name        text    default null,
  p_guest_phone       text    default null,
  p_notes             text    default null,
  p_deposit           numeric default 0,
  p_deposit_method    public.payment_method default null,
  p_children          integer default 0,
  p_check_in_now      boolean default false,
  p_guest_id_type     text    default null,
  p_guest_id_number   text    default null,
  p_guest_nationality text    default null
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_tenant  uuid;
  v_guest   uuid := p_guest_id;
  v_booking uuid;
  v_folio   uuid;
  v_phone   text := nullif(trim(p_guest_phone), '');
  v_id_no   text := nullif(trim(p_guest_id_number), '');
  v_id_type text := case when nullif(trim(p_guest_id_number), '') is null then null else coalesce(p_guest_id_type, 'cnic') end;
begin
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  if v_tenant is null then
    raise exception 'create_booking: property not found' using errcode = 'P0002';
  end if;
  if p_check_out <= p_check_in then
    raise exception 'create_booking: check-out must be after check-in' using errcode = 'HD005';
  end if;
  if coalesce(p_deposit, 0) > 0 and p_deposit_method is null then
    raise exception 'create_booking: deposit needs a payment method' using errcode = 'HD009';
  end if;

  if v_guest is null then
    -- the same person typed again (same phone and name) reuses their profile
    if v_phone is not null and coalesce(trim(p_guest_name), '') <> '' then
      select id into v_guest from public.guests
       where tenant_id = v_tenant and phone = v_phone and lower(name) = lower(trim(p_guest_name))
       limit 1;
    end if;
    if v_guest is null then
      if coalesce(trim(p_guest_name), '') = '' then
        raise exception 'create_booking: guest name required' using errcode = 'HD011';
      end if;
      insert into public.guests (tenant_id, name, phone, id_type, id_number, nationality)
      values (v_tenant, trim(p_guest_name), v_phone, v_id_type, v_id_no, nullif(trim(p_guest_nationality), ''))
      returning id into v_guest;
    end if;
  end if;
  if v_id_no is not null then
    update public.guests set id_type = v_id_type, id_number = v_id_no
     where id = v_guest and id_number is null;
  end if;

  insert into public.bookings
    (tenant_id, property_id, guest_id, booking_no, status, source, check_in, check_out, adults, children, notes)
  values
    (v_tenant, p_property_id, v_guest, public.next_doc_no(p_property_id, 'booking'), 'confirmed', p_source,
     p_check_in, p_check_out, greatest(coalesce(p_adults, 1), 1), greatest(coalesce(p_children, 0), 0), nullif(trim(p_notes), ''))
  returning id into v_booking;

  perform public._assign_room(v_booking, p_room_id, coalesce(p_nightly_rate, 0), p_check_in, p_check_out);
  perform public._post_room_nights(v_booking, p_check_in, p_check_out, coalesce(p_nightly_rate, 0));

  if coalesce(p_deposit, 0) > 0 then
    select id into v_folio from public.folios where booking_id = v_booking;
    insert into public.folio_items (folio_id, kind, category, source, description, amount_pkr, method)
    values (v_folio, 'payment', 'deposit', 'auto', 'Advance payment', p_deposit, p_deposit_method);
  end if;

  if p_check_in_now then
    perform public.set_booking_status(v_booking, 'checked_in', null);
  end if;
  return v_booking;
end $$;

drop function if exists public.update_booking(uuid, uuid, date, date, integer, public.booking_source, numeric, text);

create or replace function public.update_booking(
  p_booking_id   uuid,
  p_room_id      uuid,
  p_check_in     date,
  p_check_out    date,
  p_adults       integer,
  p_source       public.booking_source,
  p_nightly_rate numeric,
  p_notes        text    default null,
  p_children     integer default null
) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_b       public.bookings%rowtype;
  v_br      public.booking_rooms%rowtype;
  v_n       integer;
  v_changed boolean;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if v_b.id is null then
    raise exception 'update_booking: booking not found' using errcode = 'P0002';
  end if;
  if v_b.status not in ('confirmed', 'checked_in') then
    raise exception 'update_booking: cannot go from % — booking is no longer editable', v_b.status using errcode = 'HD003';
  end if;
  if p_check_out <= p_check_in then
    raise exception 'update_booking: check-out must be after check-in' using errcode = 'HD005';
  end if;
  if v_b.status = 'checked_in' and p_check_in <> v_b.check_in then
    raise exception 'update_booking: check-in is locked for an in-house stay' using errcode = 'HD005';
  end if;

  select * into v_br from public.booking_rooms where booking_id = p_booking_id;
  v_changed := (v_br.room_id, v_br.check_in, v_br.check_out, v_br.nightly_rate_pkr)
               is distinct from (p_room_id, p_check_in, p_check_out, coalesce(p_nightly_rate, 0));

  -- room and dates first: the no-double-book constraint judges the final combination
  perform public._assign_room(p_booking_id, p_room_id, coalesce(p_nightly_rate, 0), p_check_in, p_check_out);

  update public.bookings
     set check_in  = p_check_in,
         check_out = p_check_out,
         adults    = greatest(coalesce(p_adults, 1), 1),
         children  = greatest(coalesce(p_children, children), 0),
         source    = p_source,
         notes     = nullif(trim(p_notes), '')
   where id = p_booking_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'update_booking: not permitted' using errcode = '42501';
  end if;

  if v_changed then
    perform public._void_room_nights(p_booking_id, null, 'Stay changed');
    perform public._post_room_nights(p_booking_id, p_check_in, p_check_out, coalesce(p_nightly_rate, 0));
  end if;
end $$;

drop function if exists public.set_booking_status(uuid, public.booking_status);

create or replace function public.set_booking_status(p_booking_id uuid, p_status public.booking_status, p_reason text default null) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_b public.bookings%rowtype;
  v_n integer;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if v_b.id is null then
    raise exception 'set_booking_status: booking not found' using errcode = 'P0002';
  end if;
  update public.bookings
     set status = p_status,
         cancellation_reason      = case when p_status = 'cancelled'   then nullif(trim(p_reason), '') else cancellation_reason end,
         checkout_override_reason = case when p_status = 'checked_out' then nullif(trim(p_reason), '') else checkout_override_reason end
   where id = p_booking_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'set_booking_status: not permitted' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.create_booking(uuid, uuid, date, date, integer, public.booking_source, numeric, uuid, text, text, text, numeric, public.payment_method, integer, boolean, text, text, text) from public, anon;
revoke execute on function public.update_booking(uuid, uuid, date, date, integer, public.booking_source, numeric, text, integer) from public, anon;
revoke execute on function public.set_booking_status(uuid, public.booking_status, text) from public, anon;
grant  execute on function public.create_booking(uuid, uuid, date, date, integer, public.booking_source, numeric, uuid, text, text, text, numeric, public.payment_method, integer, boolean, text, text, text) to authenticated, service_role;
grant  execute on function public.update_booking(uuid, uuid, date, date, integer, public.booking_source, numeric, text, integer) to authenticated, service_role;
grant  execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated, service_role;

-- ------------------------------------------------- privileges & policies ----
-- booking_rooms: read-only for the API role (written by _assign_room and the lifecycle trigger)
revoke insert, update, delete on public.booking_rooms from anon, authenticated;
drop policy if exists booking_rooms_write on public.booking_rooms;
-- bookings: insert and update for front-desk roles; never delete (cancel instead)
revoke delete on public.bookings from anon, authenticated;
drop policy if exists bookings_write on public.bookings;
create policy bookings_insert on public.bookings for insert to authenticated
  with check (
    (tenant_id = (select public.current_tenant_id())
     and (select public.tenant_access_level()) = 'full'
     and (select public.current_role_in_tenant()) in ('owner', 'manager', 'front_desk'))
    or (select public.is_platform_admin())
  );
create policy bookings_update on public.bookings for update to authenticated
  using (
    (tenant_id = (select public.current_tenant_id())
     and (select public.tenant_access_level()) = 'full'
     and (select public.current_role_in_tenant()) in ('owner', 'manager', 'front_desk'))
    or (select public.is_platform_admin())
  )
  with check (
    (tenant_id = (select public.current_tenant_id())
     and (select public.tenant_access_level()) = 'full'
     and (select public.current_role_in_tenant()) in ('owner', 'manager', 'front_desk'))
    or (select public.is_platform_admin())
  );
