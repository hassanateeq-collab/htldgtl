-- =============================================================================
-- Hotel Digital — operational core (migration 2)
-- Rooms, rates, guests, bookings (with the no-double-book constraint), folios
-- with stored totals, cash handover, housekeeping.
--
-- Every table: tenant_id + property_id, RLS, updated_at trigger, audit trigger.
-- Child rows (booking_rooms, folios, folio_items) derive tenant/property from
-- their parent via fill triggers — never trusted from client input.
-- Design: docs/architecture/data-model.md.
-- =============================================================================

-- ---------------------------------------------------------------- enums ----
create type public.housekeeping_status as enum ('clean','dirty','inspected','out_of_order');
create type public.booking_status      as enum ('confirmed','checked_in','checked_out','cancelled','no_show');
create type public.booking_source      as enum ('walk_in','phone','whatsapp','ota','direct');
create type public.folio_status        as enum ('open','closed');
create type public.folio_item_kind     as enum ('charge','payment');
create type public.cash_shift_status   as enum ('open','handed_over','confirmed');
create type public.task_status         as enum ('pending','in_progress','done');

-- ------------------------------------------------------------- inventory ----
create table public.room_types (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  property_id    uuid not null references public.properties(id) on delete cascade,
  name           text not null,
  bed_config     text,
  size_sqm       int,
  base_occupancy int not null default 2 check (base_occupancy >= 1),
  max_occupancy  int not null default 2,
  base_rate_pkr  numeric(12,2) not null default 0 check (base_rate_pkr >= 0),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (property_id, name),
  check (max_occupancy >= base_occupancy)
);
create index room_types_property_idx on public.room_types (property_id, sort_order);

create table public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  property_id         uuid not null references public.properties(id) on delete cascade,
  room_type_id        uuid not null references public.room_types(id) on delete restrict,
  label               text not null,
  floor               int,
  housekeeping_status public.housekeeping_status not null default 'clean',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (property_id, label)
);
create index rooms_property_idx on public.rooms (property_id, room_type_id);

create table public.rate_plans (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (property_id, name)
);
-- exactly one default rate plan per property
create unique index rate_plans_one_default_idx on public.rate_plans (property_id) where is_default;

create table public.rates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  rate_plan_id uuid not null references public.rate_plans(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  date         date not null,
  price_pkr    numeric(12,2) not null check (price_pkr >= 0),
  updated_at   timestamptz not null default now(),
  unique (rate_plan_id, room_type_id, date)
);
create index rates_lookup_idx on public.rates (property_id, date);

-- ---------------------------------------------------------------- guests ----
create table public.guests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  phone         text,                                  -- canonical +92…, normalised by the app
  email         text,
  cnic          text,
  passport      text,
  nationality   text,
  custom_fields jsonb not null default '{}'::jsonb,    -- addon.custom_fields
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index guests_tenant_name_idx  on public.guests (tenant_id, name);
create index guests_tenant_phone_idx on public.guests (tenant_id, phone);

-- -------------------------------------------------------------- bookings ----
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  guest_id      uuid not null references public.guests(id) on delete restrict,
  booking_no    text not null,
  status        public.booking_status not null default 'confirmed',
  source        public.booking_source not null default 'walk_in',
  check_in      date not null,
  check_out     date not null,
  adults        int  not null default 1 check (adults >= 1),
  children      int  not null default 0 check (children >= 0),
  ota_ref       text,
  notes         text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (property_id, booking_no),
  check (check_out > check_in)
);
create index bookings_property_dates_idx  on public.bookings (property_id, check_in, check_out);
create index bookings_property_status_idx on public.bookings (property_id, status);

create table public.booking_rooms (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings(id) on delete cascade,
  tenant_id        uuid not null,                       -- filled from the booking
  property_id      uuid not null,                       -- filled from the booking
  room_id          uuid not null references public.rooms(id) on delete restrict,
  room_type_id     uuid not null references public.room_types(id) on delete restrict,
  check_in         date not null,
  check_out        date not null,
  status           public.booking_status not null default 'confirmed',
  nightly_rate_pkr numeric(12,2) not null default 0 check (nightly_rate_pkr >= 0),
  nightly          jsonb,                               -- optional per-night price breakdown
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (check_out > check_in),
  -- The no-double-book rule, enforced by the database under any concurrency:
  -- two live stays may never overlap in one room. Half-open ranges: the
  -- check-out day is free, so same-day turnover is allowed.
  constraint booking_rooms_no_overlap exclude using gist (
    room_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'))
);
create index booking_rooms_room_idx    on public.booking_rooms (room_id, check_in);
create index booking_rooms_booking_idx on public.booking_rooms (booking_id);

-- ---------------------------------------------------------------- folios ----
create table public.folios (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,                         -- filled from the booking
  property_id    uuid not null,                         -- filled from the booking
  booking_id     uuid not null unique references public.bookings(id) on delete cascade,
  status         public.folio_status not null default 'open',
  total_charges  numeric(12,2) not null default 0,
  total_payments numeric(12,2) not null default 0,
  balance        numeric(12,2) not null default 0,      -- stored totals are the truth
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.folio_items (
  id          uuid primary key default gen_random_uuid(),
  folio_id    uuid not null references public.folios(id) on delete cascade,
  tenant_id   uuid not null,                            -- filled from the folio
  property_id uuid not null,                            -- filled from the folio
  kind        public.folio_item_kind not null,
  description text not null,
  amount_pkr  numeric(12,2) not null check (amount_pkr > 0),
  method      public.payment_method,                    -- payments only
  reference   text,
  posted_at   timestamptz not null default now(),
  posted_by   uuid,
  check ((kind = 'payment') = (method is not null))
);
create index folio_items_folio_idx  on public.folio_items (folio_id);
create index folio_items_posted_idx on public.folio_items (property_id, posted_at);

-- --------------------------------------------------------- cash handover ----
create table public.cash_shifts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  shift_date   date not null default current_date,
  status       public.cash_shift_status not null default 'open',
  opened_by    uuid,
  opened_at    timestamptz not null default now(),
  declared     jsonb not null default '{}'::jsonb,      -- {method: amount} declared by the closing shift
  closed_by    uuid,
  closed_at    timestamptz,
  confirmed    jsonb,                                    -- {method: amount} counted by the next shift
  confirmed_by uuid,
  confirmed_at timestamptz,
  discrepancy  jsonb,                                    -- confirmed − declared, per method
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index cash_shifts_property_idx on public.cash_shifts (property_id, shift_date desc);

-- ---------------------------------------------------------- housekeeping ----
create table public.housekeeping_tasks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id     uuid references public.rooms(id) on delete cascade,
  status      public.task_status not null default 'pending',
  assigned_to uuid,
  note        text,
  due_date    date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index housekeeping_tasks_idx on public.housekeeping_tasks (property_id, due_date, status);

-- -------------------------------------------- integrity & derived triggers ----
create or replace function public.booking_rooms_fill() returns trigger
language plpgsql as $$
begin
  select b.tenant_id, b.property_id into new.tenant_id, new.property_id
  from public.bookings b where b.id = new.booking_id;
  if new.tenant_id is null then
    raise exception 'booking_rooms: unknown booking %', new.booking_id;
  end if;
  return new;
end $$;
create trigger fill before insert or update of booking_id on public.booking_rooms
  for each row execute function public.booking_rooms_fill();

create or replace function public.folios_fill() returns trigger
language plpgsql as $$
begin
  select b.tenant_id, b.property_id into new.tenant_id, new.property_id
  from public.bookings b where b.id = new.booking_id;
  if new.tenant_id is null then
    raise exception 'folios: unknown booking %', new.booking_id;
  end if;
  return new;
end $$;
create trigger fill before insert or update of booking_id on public.folios
  for each row execute function public.folios_fill();

create or replace function public.folio_items_fill() returns trigger
language plpgsql as $$
declare
  v_status public.folio_status;
begin
  select f.tenant_id, f.property_id, f.status into new.tenant_id, new.property_id, v_status
  from public.folios f where f.id = new.folio_id;
  if new.tenant_id is null then
    raise exception 'folio_items: unknown folio %', new.folio_id;
  end if;
  if v_status = 'closed' then
    raise exception 'folio_items: folio % is closed', new.folio_id;
  end if;
  return new;
end $$;
create trigger fill before insert or update of folio_id on public.folio_items
  for each row execute function public.folio_items_fill();

-- Every booking gets a folio.
create or replace function public.bookings_create_folio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.folios (booking_id, tenant_id, property_id)
  values (new.id, new.tenant_id, new.property_id);
  return null;
end $$;
create trigger create_folio after insert on public.bookings
  for each row execute function public.bookings_create_folio();

-- Stored folio totals are maintained here; the app never sums items itself.
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
      select coalesce(sum(case when kind = 'charge'  then amount_pkr end), 0) as charges,
             coalesce(sum(case when kind = 'payment' then amount_pkr end), 0) as payments
      from public.folio_items
      where folio_id = v_folio
    ) s
   where f.id = v_folio;
  return null;
end $$;
create trigger recompute after insert or update or delete on public.folio_items
  for each row execute function public.recompute_folio();

-- ------------------------------------------------------ updated_at triggers ----
create trigger set_updated_at before update on public.room_types         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rooms              for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rate_plans         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rates              for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.guests             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bookings           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.booking_rooms      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.folios             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cash_shifts        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.housekeeping_tasks for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- audit triggers ----
create trigger audit after insert or update or delete on public.room_types         for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.rooms              for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.rate_plans         for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.rates              for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.guests             for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.bookings           for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.booking_rooms      for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.folios             for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.folio_items        for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.cash_shifts        for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.housekeeping_tasks for each row execute function public.audit_row();

-- ------------------------------------------------------------------- RLS ----
-- READ : (tenant_id = current_tenant_id() and tenant_access_level() <> 'none') or is_platform_admin()
-- WRITE: (… and tenant_access_level() = 'full' and current_role_in_tenant() in (<roles>)) or is_platform_admin()
alter table public.room_types         enable row level security;
alter table public.rooms              enable row level security;
alter table public.rate_plans         enable row level security;
alter table public.rates              enable row level security;
alter table public.guests             enable row level security;
alter table public.bookings           enable row level security;
alter table public.booking_rooms      enable row level security;
alter table public.folios             enable row level security;
alter table public.folio_items        enable row level security;
alter table public.cash_shifts        enable row level security;
alter table public.housekeeping_tasks enable row level security;

-- inventory & rates: owner / manager
create policy room_types_read on public.room_types for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy room_types_write on public.room_types for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

create policy rooms_read on public.rooms for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy rooms_write on public.rooms for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','housekeeping')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','housekeeping')) or public.is_platform_admin());

-- a non-default rate plan needs the add-on; the default plan is always allowed
create policy rate_plans_read on public.rate_plans for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy rate_plans_write on public.rate_plans for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')
          and (is_default or public.tenant_has_feature('addon.rate_plans'))) or public.is_platform_admin());

create policy rates_read on public.rates for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy rates_write on public.rates for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

-- guests & bookings: owner / manager / front desk
create policy guests_read on public.guests for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy guests_write on public.guests for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk')) or public.is_platform_admin());

create policy bookings_read on public.bookings for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy bookings_write on public.bookings for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk')) or public.is_platform_admin());

create policy booking_rooms_read on public.booking_rooms for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy booking_rooms_write on public.booking_rooms for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk')) or public.is_platform_admin());

-- folios & cash: owner / manager / front desk / accounts
create policy folios_read on public.folios for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy folios_write on public.folios for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','accounts')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','accounts')) or public.is_platform_admin());

create policy folio_items_read on public.folio_items for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy folio_items_write on public.folio_items for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','accounts')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','accounts')) or public.is_platform_admin());

create policy cash_shifts_read on public.cash_shifts for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy cash_shifts_write on public.cash_shifts for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','accounts')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','accounts')) or public.is_platform_admin());

-- housekeeping: owner / manager / front desk / housekeeping
create policy housekeeping_tasks_read on public.housekeeping_tasks for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());
create policy housekeeping_tasks_write on public.housekeeping_tasks for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','housekeeping')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager','front_desk','housekeeping')) or public.is_platform_admin());

-- --------------------------------------------------- function privileges ----
-- Trigger functions are never callable via RPC (triggers fire regardless of EXECUTE).
revoke execute on function public.booking_rooms_fill()    from public, anon, authenticated;
revoke execute on function public.folios_fill()           from public, anon, authenticated;
revoke execute on function public.folio_items_fill()      from public, anon, authenticated;
revoke execute on function public.bookings_create_folio() from public, anon, authenticated;
revoke execute on function public.recompute_folio()       from public, anon, authenticated;
