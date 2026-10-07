-- =============================================================================
-- Hotel Digital — early departure releases the room (migration 8)
-- Checking out before the planned date sets the stay's actual end to today on
-- both the booking and its room assignment, so the no-double-book EXCLUDE
-- constraint frees the remaining nights. Same-day departures become zero-night
-- rows (an empty date range never collides); hence the date check relaxes to
-- check_out >= check_in. New bookings still need at least one night —
-- create_booking() enforces that. Room charges already posted are left for
-- the front desk to adjust (credits are a later feature).
-- =============================================================================

do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.bookings'::regclass, 'public.booking_rooms'::regclass)
      and pg_get_constraintdef(oid) ilike '%check_out > check_in%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.bookings      add constraint bookings_dates_check      check (check_out >= check_in);
alter table public.booking_rooms add constraint booking_rooms_dates_check check (check_out >= check_in);

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
    -- early departure: the actual check-out is today; frees the remaining nights
    update public.booking_rooms
       set check_out = current_date
     where booking_id = p_booking_id and check_in <= current_date and check_out > current_date;
    update public.bookings
       set check_out = current_date
     where id = p_booking_id and check_in <= current_date and check_out > current_date;

    if v_folio is not null then
      update public.folios set status = 'closed', closed_at = now() where id = v_folio;
    end if;
    update public.rooms r
       set housekeeping_status = 'dirty'
      from public.booking_rooms br
     where br.booking_id = p_booking_id and r.id = br.room_id;
  end if;
end $$;
