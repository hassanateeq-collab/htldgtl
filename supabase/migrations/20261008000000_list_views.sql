-- =============================================================================
-- Hotel Digital — list views for the app (migration 16, Release B)
-- Read models for lists and boards so screens query one relation with
-- server-side filters, search and paging instead of loading whole tables.
-- security_invoker: the querying user's RLS applies to every underlying table.
-- =============================================================================

create or replace view public.v_bookings with (security_invoker = true) as
select b.id, b.tenant_id, b.property_id, b.booking_no, b.status, b.source,
       b.check_in, b.check_out, (b.check_out - b.check_in) as nights, b.adults, b.children, b.notes,
       b.created_at, b.updated_at, b.checked_in_at, b.checked_out_at, b.cancelled_at, b.cancellation_reason,
       b.no_show_at, b.checkout_override_reason,
       b.guest_id, g.name as guest_name, g.phone as guest_phone, g.nationality as guest_nationality,
       (g.id_number is not null or g.cnic is not null or g.passport is not null) as guest_has_id,
       br.id as booking_room_id, br.room_id, r.label as room_label, r.housekeeping_status as room_hk_status,
       br.room_type_id, rt.name as room_type_name, br.nightly_rate_pkr,
       f.id as folio_id, f.folio_no, f.status as folio_status,
       f.total_charges, f.total_tax, f.total_payments, f.balance
from public.bookings b
join public.guests g on g.id = b.guest_id
left join public.booking_rooms br on br.booking_id = b.id
left join public.rooms r on r.id = br.room_id
left join public.room_types rt on rt.id = br.room_type_id
left join public.folios f on f.booking_id = b.id;

create or replace view public.v_guests with (security_invoker = true) as
select g.id, g.tenant_id, g.name, g.phone, g.email, g.nationality, g.id_type, g.id_number, g.id_expiry, g.address,
       g.notes, g.custom_fields, g.created_at, g.updated_at,
       (g.id_number is not null or g.cnic is not null or g.passport is not null) as has_id,
       coalesce(s.stays, 0) as stays, s.last_check_in, coalesce(s.due, 0) as due, coalesce(s.in_house, false) as in_house
from public.guests g
left join lateral (
  select count(*) filter (where b.status not in ('cancelled', 'no_show')) as stays,
         max(b.check_in) filter (where b.status not in ('cancelled', 'no_show')) as last_check_in,
         coalesce(sum(f.balance) filter (where f.status = 'open' and f.balance > 0 and b.status not in ('cancelled', 'no_show')), 0) as due,
         bool_or(b.status = 'checked_in') as in_house
  from public.bookings b
  left join public.folios f on f.booking_id = b.id
  where b.guest_id = g.id
) s on true;

create or replace view public.v_rooms_board with (security_invoker = true) as
select r.id, r.tenant_id, r.property_id, r.label, r.floor, r.room_type_id, rt.name as room_type_name,
       r.housekeeping_status, r.is_active,
       cur.id as current_booking_id, cur.booking_no as current_booking_no, cur.guest_name as current_guest_name,
       cur.check_in as current_check_in, cur.check_out as current_check_out, cur.balance as current_balance,
       nxt.id as next_booking_id, nxt.guest_name as next_guest_name, nxt.check_in as next_check_in, nxt.check_out as next_check_out
from public.rooms r
join public.room_types rt on rt.id = r.room_type_id
left join lateral (
  select v.id, v.booking_no, v.guest_name, v.check_in, v.check_out, v.balance
  from public.v_bookings v
  where v.room_id = r.id and v.status = 'checked_in'
  order by v.check_in desc limit 1
) cur on true
left join lateral (
  select v.id, v.guest_name, v.check_in, v.check_out
  from public.v_bookings v
  where v.room_id = r.id and v.status = 'confirmed' and v.check_in >= public.property_today(r.property_id)
  order by v.check_in limit 1
) nxt on true;

revoke all on public.v_bookings, public.v_guests, public.v_rooms_board from anon;
grant select on public.v_bookings, public.v_guests, public.v_rooms_board to authenticated, service_role;
