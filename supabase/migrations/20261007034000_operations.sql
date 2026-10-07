-- =============================================================================
-- Hotel Digital — operations (migration 14, Release A part 5 of 5)
--
-- * Cash shifts are RPC-only: open_cash_shift (one open shift per property,
--   opening float), close_cash_shift (declared per method, expected computed
--   from the payments linked to the shift), confirm_cash_shift (next shift or
--   a manager counts, discrepancy stored). Shift dates are hotel business days.
-- * daily_report(property, date): arrivals / departures (expected, done,
--   pending), in-house, rooms sold, revenue by category and tax, payments by
--   method, outstanding balances, new bookings, cancellations, shifts.
-- * Housekeeping: room_status_history written by trigger; the housekeeping
--   role may only change a room's status; task due dates are hotel days.
-- * provision_tenant() creates the default rate plan and aligns the trial
--   period with trial_ends_at.
-- =============================================================================

-- ----------------------------------------------------------- cash shifts ----
alter table public.cash_shifts
  add column if not exists opening_float numeric(12,2) not null default 0,
  add column if not exists expected      jsonb;
alter table public.cash_shifts add constraint cash_shifts_float_check check (opening_float >= 0);
create unique index if not exists cash_shifts_one_open_idx on public.cash_shifts (property_id) where status = 'open';

-- RPC-only: the API role can read shifts but never write them directly
revoke insert, update, delete on public.cash_shifts from anon, authenticated;
drop policy if exists cash_shifts_insert on public.cash_shifts;
drop policy if exists cash_shifts_update on public.cash_shifts;

create or replace function public._assert_cashier(p_tenant_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role public.tenant_role;
begin
  if auth.uid() is null or public.is_platform_admin() then return; end if;
  v_role := public.current_role_in_tenant();
  if p_tenant_id is distinct from public.current_tenant_id()
     or public.tenant_access_level() is distinct from 'full'
     or v_role is null or v_role not in ('owner', 'manager', 'front_desk', 'accounts') then
    raise exception 'cash: not permitted' using errcode = '42501';
  end if;
end $$;
revoke execute on function public._assert_cashier(uuid) from public, anon, authenticated;

-- {method: amount} objects are validated before they are stored
create or replace function public._validate_method_amounts(p jsonb, p_label text) returns jsonb
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  k text;
  v text;
begin
  if p is null then return '{}'::jsonb; end if;
  if jsonb_typeof(p) <> 'object' then
    raise exception '%: expected an object of payment method to amount', p_label using errcode = 'HD012';
  end if;
  for k, v in select key, value from jsonb_each_text(p) loop
    if k not in ('bank_transfer', 'raast', 'jazzcash', 'easypaisa', 'cash') then
      raise exception '%: unknown payment method %', p_label, k using errcode = 'HD012';
    end if;
    if v is null or v !~ '^-?[0-9]+(\.[0-9]{1,2})?$' then
      raise exception '%: the amount for % must be a number', p_label, k using errcode = 'HD012';
    end if;
  end loop;
  return p;
end $$;
revoke execute on function public._validate_method_amounts(jsonb, text) from public, anon, authenticated;

-- what the drawer should hold: opening float + payments − refunds, per method
create or replace function public._shift_expected(p_shift_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with movements as (
    select fi.method::text as method,
           sum(case when fi.kind = 'payment' then fi.amount_pkr else -fi.amount_pkr end) as amount
    from public.folio_items fi
    where fi.cash_shift_id = p_shift_id and fi.voided_at is null and fi.kind in ('payment', 'refund')
    group by fi.method
  ),
  float_row as (
    select 'cash'::text as method, coalesce((select opening_float from public.cash_shifts where id = p_shift_id), 0) as amount
  ),
  combined as (
    select method, sum(amount) as amount
    from (select * from movements union all select * from float_row) u
    group by method
  )
  select coalesce(jsonb_object_agg(method, amount), '{}'::jsonb) from combined
$$;
revoke execute on function public._shift_expected(uuid) from public, anon;
grant  execute on function public._shift_expected(uuid) to authenticated, service_role;

create or replace function public.open_cash_shift(p_property_id uuid, p_opening_float numeric default 0, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tenant uuid;
  v_id     uuid;
begin
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  if v_tenant is null then
    raise exception 'cash: property not found' using errcode = 'P0002';
  end if;
  perform public._assert_cashier(v_tenant);
  if exists (select 1 from public.cash_shifts where property_id = p_property_id and status = 'open') then
    raise exception 'cash: a shift is already open for this property' using errcode = 'HD012';
  end if;
  if coalesce(p_opening_float, 0) < 0 then
    raise exception 'cash: the opening float cannot be negative' using errcode = 'HD012';
  end if;
  insert into public.cash_shifts (tenant_id, property_id, shift_date, status, opened_by, opened_at, opening_float, notes)
  values (v_tenant, p_property_id, public.property_today(p_property_id), 'open', auth.uid(), now(), coalesce(p_opening_float, 0), nullif(trim(p_notes), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.close_cash_shift(p_shift_id uuid, p_declared jsonb, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_s        public.cash_shifts%rowtype;
  v_expected jsonb;
begin
  select * into v_s from public.cash_shifts where id = p_shift_id for update;
  if v_s.id is null then
    raise exception 'cash: shift not found' using errcode = 'P0002';
  end if;
  perform public._assert_cashier(v_s.tenant_id);
  if v_s.status <> 'open' then
    raise exception 'cash: the shift is not open' using errcode = 'HD012';
  end if;
  perform public._validate_method_amounts(p_declared, 'declared');
  v_expected := public._shift_expected(p_shift_id);
  update public.cash_shifts
     set status    = 'handed_over',
         closed_by = auth.uid(),
         closed_at = now(),
         declared  = coalesce(p_declared, '{}'::jsonb),
         expected  = v_expected,
         notes     = coalesce(nullif(trim(p_notes), ''), notes)
   where id = p_shift_id;
  return jsonb_build_object('expected', v_expected, 'declared', coalesce(p_declared, '{}'::jsonb));
end $$;

create or replace function public.confirm_cash_shift(p_shift_id uuid, p_confirmed jsonb, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_s    public.cash_shifts%rowtype;
  v_role public.tenant_role := coalesce(public.current_role_in_tenant(), 'owner');
  v_disc jsonb;
begin
  select * into v_s from public.cash_shifts where id = p_shift_id for update;
  if v_s.id is null then
    raise exception 'cash: shift not found' using errcode = 'P0002';
  end if;
  perform public._assert_cashier(v_s.tenant_id);
  if v_s.status <> 'handed_over' then
    raise exception 'cash: the shift has not been handed over' using errcode = 'HD012';
  end if;
  if v_s.closed_by is not null and v_s.closed_by = auth.uid() and v_role not in ('owner', 'manager') then
    raise exception 'cash: the next shift or a manager must confirm the handover' using errcode = 'HD012';
  end if;
  perform public._validate_method_amounts(p_confirmed, 'confirmed');
  select coalesce(jsonb_object_agg(k, coalesce((p_confirmed ->> k)::numeric, 0) - coalesce((v_s.declared ->> k)::numeric, 0)), '{}'::jsonb)
    into v_disc
  from (select jsonb_object_keys(coalesce(p_confirmed, '{}'::jsonb)) as k
        union
        select jsonb_object_keys(coalesce(v_s.declared, '{}'::jsonb))) keys;
  update public.cash_shifts
     set status       = 'confirmed',
         confirmed    = coalesce(p_confirmed, '{}'::jsonb),
         confirmed_by = auth.uid(),
         confirmed_at = now(),
         discrepancy  = v_disc,
         notes        = coalesce(nullif(trim(p_notes), ''), notes)
   where id = p_shift_id;
  return jsonb_build_object('discrepancy', v_disc, 'declared', v_s.declared, 'expected', v_s.expected);
end $$;

revoke execute on function public.open_cash_shift(uuid, numeric, text)   from public, anon;
revoke execute on function public.close_cash_shift(uuid, jsonb, text)    from public, anon;
revoke execute on function public.confirm_cash_shift(uuid, jsonb, text)  from public, anon;
grant  execute on function public.open_cash_shift(uuid, numeric, text)   to authenticated, service_role;
grant  execute on function public.close_cash_shift(uuid, jsonb, text)    to authenticated, service_role;
grant  execute on function public.confirm_cash_shift(uuid, jsonb, text)  to authenticated, service_role;

-- ---------------------------------------------------------- housekeeping ----
create table public.room_status_history (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null,
  property_id uuid not null,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  from_status public.housekeeping_status,
  to_status   public.housekeeping_status not null,
  changed_by  uuid,
  changed_at  timestamptz not null default now(),
  note        text
);
create index room_status_history_room_idx     on public.room_status_history (room_id, changed_at desc);
create index room_status_history_property_idx on public.room_status_history (property_id, changed_at desc);
alter table public.room_status_history enable row level security;
create policy room_status_history_read on public.room_status_history for select to authenticated
  using (((tenant_id = (select public.current_tenant_id())) and ((select public.tenant_access_level()) <> 'none')
          and ((select public.current_role_in_tenant()) is not null)) or (select public.is_platform_admin()));
revoke insert, update, delete on public.room_status_history from anon, authenticated;

create or replace function public.rooms_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() and public.current_role_in_tenant() = 'housekeeping'
     and (new.label, new.floor, new.room_type_id, new.is_active, new.property_id, new.tenant_id)
         is distinct from (old.label, old.floor, old.room_type_id, old.is_active, old.property_id, old.tenant_id) then
    raise exception 'rooms: housekeeping may only change the room status' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.rooms_guard() from public, anon, authenticated;
create trigger guard before update on public.rooms for each row execute function public.rooms_guard();

create or replace function public.rooms_status_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.housekeeping_status is distinct from old.housekeeping_status then
    insert into public.room_status_history (tenant_id, property_id, room_id, from_status, to_status, changed_by)
    values (new.tenant_id, new.property_id, new.id,
            case when tg_op = 'UPDATE' then old.housekeeping_status end, new.housekeeping_status, auth.uid());
  end if;
  return null;
end $$;
revoke execute on function public.rooms_status_history() from public, anon, authenticated;
create trigger status_history after insert or update on public.rooms for each row execute function public.rooms_status_history();

-- task due dates default to the hotel's day
alter table public.housekeeping_tasks alter column due_date drop default;
create or replace function public.housekeeping_tasks_prepare() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.due_date := coalesce(new.due_date, public.property_today(new.property_id));
  return new;
end $$;
revoke execute on function public.housekeeping_tasks_prepare() from public, anon, authenticated;
create trigger prepare before insert on public.housekeeping_tasks for each row execute function public.housekeeping_tasks_prepare();

-- ---------------------------------------------------------- daily report ----
create or replace function public.daily_report(p_property_id uuid, p_date date default null) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  d  date := coalesce(p_date, public.property_today(p_property_id));
  tz text := coalesce((select timezone from public.properties where id = p_property_id), 'Asia/Karachi');
  v  jsonb;
begin
  select jsonb_build_object(
    'date', d,
    'arrivals', jsonb_build_object(
      'expected', (select count(*) from public.bookings b where b.property_id = p_property_id and b.check_in = d and b.status in ('confirmed', 'checked_in', 'checked_out')),
      'arrived',  (select count(*) from public.bookings b where b.property_id = p_property_id and b.check_in = d and b.status in ('checked_in', 'checked_out')),
      'pending',  (select count(*) from public.bookings b where b.property_id = p_property_id and b.check_in = d and b.status = 'confirmed'),
      'no_show',  (select count(*) from public.bookings b where b.property_id = p_property_id and b.check_in = d and b.status = 'no_show')),
    'departures', jsonb_build_object(
      'expected', (select count(*) from public.bookings b where b.property_id = p_property_id and b.check_out = d and b.status in ('checked_in', 'checked_out')),
      'left',     (select count(*) from public.bookings b where b.property_id = p_property_id and b.check_out = d and b.status = 'checked_out'),
      'pending',  (select count(*) from public.bookings b where b.property_id = p_property_id and b.check_out = d and b.status = 'checked_in')),
    'in_house', (select count(*) from public.bookings b where b.property_id = p_property_id and b.status in ('checked_in', 'checked_out') and b.check_in <= d and b.check_out > d),
    'rooms', jsonb_build_object(
      'total',        (select count(*) from public.rooms r where r.property_id = p_property_id and r.is_active),
      'out_of_order', (select count(*) from public.rooms r where r.property_id = p_property_id and r.is_active and r.housekeeping_status = 'out_of_order'),
      'occupied',     (select count(distinct br.room_id) from public.booking_rooms br where br.property_id = p_property_id and br.status not in ('cancelled', 'no_show') and br.check_in <= d and br.check_out > d)),
    'revenue', (select jsonb_build_object(
      'room',      coalesce(sum(case when fi.kind = 'charge' and fi.category = 'room'  then fi.amount_pkr when fi.kind = 'discount' and fi.category = 'room'  then -fi.amount_pkr end), 0),
      'other',     coalesce(sum(case when fi.kind = 'charge' and fi.category <> 'room' then fi.amount_pkr when fi.kind = 'discount' and fi.category <> 'room' then -fi.amount_pkr end), 0),
      'discounts', coalesce(sum(case when fi.kind = 'discount' then fi.amount_pkr end), 0),
      'tax',       coalesce(sum(case when fi.kind = 'charge' then fi.tax_pkr when fi.kind = 'discount' then -fi.tax_pkr end), 0))
      from public.folio_items fi where fi.property_id = p_property_id and fi.business_date = d and fi.voided_at is null),
    'payments', (select coalesce(jsonb_object_agg(method, amount), '{}'::jsonb) from (
      select fi.method::text as method, sum(case when fi.kind = 'payment' then fi.amount_pkr else -fi.amount_pkr end) as amount
      from public.folio_items fi
      where fi.property_id = p_property_id and fi.business_date = d and fi.voided_at is null and fi.kind in ('payment', 'refund')
      group by fi.method) p),
    'payments_total', (select coalesce(sum(case when fi.kind = 'payment' then fi.amount_pkr else -fi.amount_pkr end), 0)
      from public.folio_items fi
      where fi.property_id = p_property_id and fi.business_date = d and fi.voided_at is null and fi.kind in ('payment', 'refund')),
    'outstanding',       (select coalesce(sum(f.balance), 0) from public.folios f where f.property_id = p_property_id and f.status = 'open' and f.balance > 0),
    'outstanding_count', (select count(*) from public.folios f where f.property_id = p_property_id and f.status = 'open' and f.balance > 0),
    'new_bookings',  (select count(*) from public.bookings b where b.property_id = p_property_id and (b.created_at at time zone tz)::date = d),
    'cancellations', (select count(*) from public.bookings b where b.property_id = p_property_id and (b.cancelled_at at time zone tz)::date = d),
    'cash_shifts', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', cs.id, 'status', cs.status, 'opened_at', cs.opened_at, 'closed_at', cs.closed_at,
        'opening_float', cs.opening_float, 'declared', cs.declared, 'expected', cs.expected, 'discrepancy', cs.discrepancy) order by cs.opened_at), '[]'::jsonb)
      from public.cash_shifts cs where cs.property_id = p_property_id and cs.shift_date = d)
  ) into v;
  return v;
end $$;
revoke execute on function public.daily_report(uuid, date) from public, anon;
grant  execute on function public.daily_report(uuid, date) to authenticated, service_role;

-- --------------------------------------------------------- provisioning ----
create or replace function public.provision_tenant(
  p_name          text,
  p_slug          text,
  p_property_name text,
  p_city          text default null,
  p_plan_key      text default 'trial',
  p_owner_user    uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tenant   uuid;
  v_property uuid;
  v_plan     public.platform_plans%rowtype;
  v_status   public.subscription_status;
  v_trial_end timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'provision_tenant: platform admin only' using errcode = '42501';
  end if;

  select * into v_plan from public.platform_plans where key = p_plan_key and is_active;
  if v_plan.id is null then
    raise exception 'provision_tenant: unknown plan %', p_plan_key using errcode = 'P0002';
  end if;

  v_status := case when p_plan_key = 'trial'
                then 'trialing'::public.subscription_status
                else 'active'::public.subscription_status end;
  v_trial_end := case when v_status = 'trialing' then now() + make_interval(days => v_plan.trial_days) end;

  insert into public.tenants (name, slug) values (p_name, p_slug) returning id into v_tenant;
  insert into public.properties (tenant_id, name, city) values (v_tenant, p_property_name, p_city) returning id into v_property;
  insert into public.rate_plans (tenant_id, property_id, name, is_default) values (v_tenant, v_property, 'Standard', true);
  insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
  values (v_tenant, v_plan.id, v_status, v_trial_end, current_date,
          case when v_status = 'trialing' then v_trial_end::date else current_date + 30 end);
  insert into public.subscription_events (tenant_id, from_status, to_status, reason, actor)
  values (v_tenant, null, v_status, 'provisioned', auth.uid()::text);
  insert into public.tenant_settings (tenant_id) values (v_tenant);
  insert into public.tenant_branding (tenant_id, legal_name) values (v_tenant, p_name);

  if p_owner_user is not null then
    insert into public.memberships (tenant_id, user_id, role) values (v_tenant, p_owner_user, 'owner');
  end if;

  insert into public.platform_audit_log (actor_admin, action, target_table, target_id, after)
  values (auth.uid(), 'provision_tenant', 'tenants', v_tenant::text,
          jsonb_build_object('name', p_name, 'slug', p_slug, 'plan', p_plan_key));

  return v_tenant;
end $$;
