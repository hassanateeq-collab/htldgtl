-- =============================================================================
-- Hotel Digital — access hardening (migration 13, Release A part 4 of 5)
--
-- * Tenant-safe references: composite foreign keys (tenant_id, …) /
--   (property_id, …) on every leaf reference, so a row can never point at
--   another tenant's room, guest, room type or rate plan.
-- * No cascading deletes through money or stays: properties → bookings →
--   folios → items are ON DELETE RESTRICT, and tenant roles have no DELETE on
--   operational or financial tables (cancel / deactivate instead).
-- * Policies regenerated uniformly: one SELECT policy and separate INSERT /
--   UPDATE (/ DELETE) policies per table, helper calls wrapped in (select …)
--   so they are evaluated once per statement, not once per row.
-- * Membership rules: only an owner grants or changes the owner role, nobody
--   changes their own role, the last owner cannot be removed.
-- * tenant_access_level() honours tenants.is_active; my_tenant_access() and
--   tenant_has_feature() require a live membership; the plan's property cap
--   is enforced; the public signup form is validated.
-- * Audit: identity documents are stripped from audit JSON; platform tables
--   are audited into platform_audit_log; invoice_items are audited.
-- * search_path = public, pg_temp on every function; indexes for the
--   advisor's unindexed foreign keys, calendar range queries and guest search.
-- =============================================================================

-- ------------------------------------------------ tenant-safe references ----
alter table public.properties add constraint properties_tenant_id_id_key  unique (tenant_id, id);
alter table public.room_types add constraint room_types_property_id_id_key unique (property_id, id);
alter table public.rooms      add constraint rooms_property_id_id_key      unique (property_id, id);
alter table public.rate_plans add constraint rate_plans_property_id_id_key unique (property_id, id);
alter table public.guests     add constraint guests_tenant_id_id_key      unique (tenant_id, id);

alter table public.room_types         add constraint room_types_tenant_property_fkey         foreign key (tenant_id, property_id)   references public.properties (tenant_id, id);
alter table public.rooms              add constraint rooms_tenant_property_fkey              foreign key (tenant_id, property_id)   references public.properties (tenant_id, id);
alter table public.rooms              add constraint rooms_type_property_fkey                foreign key (property_id, room_type_id) references public.room_types (property_id, id);
alter table public.rate_plans         add constraint rate_plans_tenant_property_fkey         foreign key (tenant_id, property_id)   references public.properties (tenant_id, id);
alter table public.rates              add constraint rates_plan_property_fkey                foreign key (property_id, rate_plan_id) references public.rate_plans (property_id, id);
alter table public.rates              add constraint rates_type_property_fkey                foreign key (property_id, room_type_id) references public.room_types (property_id, id);
alter table public.bookings           add constraint bookings_tenant_property_fkey           foreign key (tenant_id, property_id)   references public.properties (tenant_id, id);
alter table public.bookings           add constraint bookings_tenant_guest_fkey              foreign key (tenant_id, guest_id)      references public.guests (tenant_id, id);
alter table public.booking_rooms      add constraint booking_rooms_room_property_fkey        foreign key (property_id, room_id)      references public.rooms (property_id, id);
alter table public.booking_rooms      add constraint booking_rooms_type_property_fkey        foreign key (property_id, room_type_id) references public.room_types (property_id, id);
alter table public.cash_shifts        add constraint cash_shifts_tenant_property_fkey        foreign key (tenant_id, property_id)   references public.properties (tenant_id, id);
alter table public.housekeeping_tasks add constraint housekeeping_tasks_tenant_property_fkey foreign key (tenant_id, property_id)   references public.properties (tenant_id, id);
alter table public.housekeeping_tasks add constraint housekeeping_tasks_room_property_fkey   foreign key (property_id, room_id)      references public.rooms (property_id, id);

-- -------------------------------------------- no cascades through money ----
alter table public.bookings           drop constraint bookings_property_id_fkey,
                                      add  constraint bookings_property_id_fkey           foreign key (property_id) references public.properties(id) on delete restrict;
alter table public.booking_rooms      drop constraint booking_rooms_booking_id_fkey,
                                      add  constraint booking_rooms_booking_id_fkey       foreign key (booking_id)  references public.bookings(id)   on delete restrict;
alter table public.folios             drop constraint folios_booking_id_fkey,
                                      add  constraint folios_booking_id_fkey              foreign key (booking_id)  references public.bookings(id)   on delete restrict;
alter table public.folio_items        drop constraint folio_items_folio_id_fkey,
                                      add  constraint folio_items_folio_id_fkey           foreign key (folio_id)    references public.folios(id)     on delete restrict;
alter table public.room_types         drop constraint room_types_property_id_fkey,
                                      add  constraint room_types_property_id_fkey         foreign key (property_id) references public.properties(id) on delete restrict;
alter table public.rooms              drop constraint rooms_property_id_fkey,
                                      add  constraint rooms_property_id_fkey              foreign key (property_id) references public.properties(id) on delete restrict;
alter table public.rate_plans         drop constraint rate_plans_property_id_fkey,
                                      add  constraint rate_plans_property_id_fkey         foreign key (property_id) references public.properties(id) on delete restrict;
alter table public.cash_shifts        drop constraint cash_shifts_property_id_fkey,
                                      add  constraint cash_shifts_property_id_fkey        foreign key (property_id) references public.properties(id) on delete restrict;
alter table public.housekeeping_tasks drop constraint housekeeping_tasks_room_id_fkey,
                                      add  constraint housekeeping_tasks_room_id_fkey     foreign key (room_id)     references public.rooms(id)      on delete restrict;

revoke delete on public.properties, public.room_types, public.rooms, public.guests, public.cash_shifts from anon, authenticated;

-- ------------------------------------------------------- access helpers ----
-- a deactivated tenant is 'none' regardless of its subscription
create or replace function public.tenant_access_level() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case
           when not t.is_active then 'none'
           when s.status in ('trialing', 'active', 'past_due') then 'full'
           when s.status = 'read_only' then 'read_only'
           else 'none'
         end
  from public.subscriptions s
  join public.tenants t on t.id = s.tenant_id
  where s.tenant_id = public.current_tenant_id()
$$;

-- only members learn a tenant's billing state or feature set
create or replace function public.my_tenant_access()
returns table (tenant_id uuid, status public.subscription_status, access_level text)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.tenant_id, s.status, public.tenant_access_level()
  from public.subscriptions s
  where s.tenant_id = public.current_tenant_id()
    and (public.current_role_in_tenant() is not null or public.is_platform_admin())
$$;

create or replace function public.tenant_has_feature(p_key text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  with ov as (
    select o.enabled
    from public.tenant_feature_overrides o
    where o.tenant_id = public.current_tenant_id()
      and o.feature_key = p_key
      and o.starts_at <= now()
      and (o.ends_at is null or o.ends_at > now())
    order by o.created_at desc
    limit 1
  ),
  plan_has as (
    select exists (
      select 1
      from public.subscriptions s
      join public.platform_plan_features pf on pf.plan_id = s.plan_id
      where s.tenant_id = public.current_tenant_id() and pf.feature_key = p_key
    ) as v
  )
  select case
           when public.current_role_in_tenant() is null and not public.is_platform_admin() then false
           else coalesce((select enabled from ov), (select v from plan_has), false)
         end
$$;

-- ------------------------------------------------------ membership rules ----
create or replace function public.memberships_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role   public.tenant_role := public.current_role_in_tenant();
  v_owners integer;
begin
  if auth.uid() is null or public.is_platform_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.role = 'owner' and v_role is distinct from 'owner' then
    raise exception 'memberships: only an owner can grant the owner role' using errcode = 'HD013';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and v_role is distinct from 'owner' then
    raise exception 'memberships: only an owner can change or remove an owner' using errcode = 'HD013';
  end if;
  if tg_op = 'UPDATE' and old.user_id = auth.uid() and new.role <> old.role then
    raise exception 'memberships: you cannot change your own role' using errcode = 'HD013';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into v_owners from public.memberships
     where tenant_id = old.tenant_id and role = 'owner' and id <> old.id;
    if v_owners = 0 then
      raise exception 'memberships: a hotel must keep at least one owner' using errcode = 'HD013';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.memberships_guard() from public, anon, authenticated;
create trigger guard before insert or update or delete on public.memberships
  for each row execute function public.memberships_guard();

-- ------------------------------------------------------ plan property cap ----
create or replace function public.properties_cap_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
  v_cap   integer;
begin
  if auth.uid() is null or public.is_platform_admin() then return new; end if;
  select count(*) into v_count from public.properties where tenant_id = new.tenant_id;
  select p.max_properties into v_cap
  from public.subscriptions s join public.platform_plans p on p.id = s.plan_id
  where s.tenant_id = new.tenant_id;
  if v_count >= coalesce(v_cap, 1) and not public.tenant_has_feature('addon.multi_property') then
    raise exception 'properties: this plan allows % property(ies)', coalesce(v_cap, 1) using errcode = 'HD014';
  end if;
  return new;
end $$;
revoke execute on function public.properties_cap_guard() from public, anon, authenticated;
create trigger cap_guard before insert on public.properties
  for each row execute function public.properties_cap_guard();

-- --------------------------------------------------------- signup form ----
alter table public.platform_signup_requests
  add constraint signup_email_check check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') not valid,
  add constraint signup_phone_check check (phone ~ '^\+?[0-9][0-9 ()-]{6,24}$') not valid,
  add constraint signup_rooms_check check (rooms is null or rooms between 1 and 500) not valid;

-- ------------------------------------------------ guest phone / ID shape ----
-- Phones are stored E.164. Local Pakistani forms (03XX…, 92…, 0092…) are
-- canonicalised here so the check constraint never trips on normal input.
create or replace function public.normalize_phone(p_input text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case
           when p_input is null or btrim(p_input) = '' then null
           when s ~ '^\+[1-9][0-9]{6,14}$' then s
           when s ~ '^00[1-9][0-9]{6,14}$' then '+' || substr(s, 3)
           when s ~ '^0[0-9]{10}$'         then '+92' || substr(s, 2)
           when s ~ '^92[0-9]{10}$'        then '+' || s
           when s ~ '^3[0-9]{9}$'          then '+92' || s
           else s
         end
  from (select regexp_replace(btrim(p_input), '[^0-9+]', '', 'g') as s) x
$$;
grant execute on function public.normalize_phone(text) to authenticated, service_role;

create or replace function public.guests_prepare() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.name  := btrim(new.name);
  new.phone := public.normalize_phone(new.phone);
  new.email := nullif(lower(btrim(new.email)), '');
  if new.id_type = 'cnic' and new.id_number ~ '^[0-9]{13}$' then
    new.id_number := substr(new.id_number, 1, 5) || '-' || substr(new.id_number, 6, 7) || '-' || substr(new.id_number, 13, 1);
  end if;
  return new;
end $$;
revoke execute on function public.guests_prepare() from public, anon, authenticated;
create trigger prepare before insert or update on public.guests
  for each row execute function public.guests_prepare();

-- create_booking: look up returning guests by the canonical phone
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
  v_phone   text := public.normalize_phone(p_guest_phone);
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

-- ------------------------------------------------------- audit changes ----
-- identity documents never enter the audit trail; invoice_items attribute via their invoice
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row    jsonb;
  v_tenant uuid;
  v_actor  uuid;
  v_strip  text[] := array['cnic', 'passport', 'id_number'];
begin
  v_row    := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_tenant := (v_row ->> 'tenant_id')::uuid;
  if v_tenant is null and tg_table_name = 'invoice_items' then
    select i.tenant_id into v_tenant from public.invoices i where i.id = (v_row ->> 'invoice_id')::uuid;
  end if;
  if v_tenant is null then return null; end if;
  v_actor := coalesce(nullif(current_setting('app.actor_user', true), '')::uuid, auth.uid());
  insert into public.audit_log (tenant_id, actor_user, table_name, row_id, action, before, after)
  values (
    v_tenant,
    v_actor,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'tenant_id'),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - v_strip end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - v_strip end
  );
  return null;
end $$;
create trigger audit after insert or update or delete on public.invoice_items for each row execute function public.audit_row();

create or replace function public.platform_audit_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row   jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_actor uuid;
begin
  select user_id into v_actor from public.platform_admins where user_id = auth.uid();
  insert into public.platform_audit_log (actor_admin, action, target_table, target_id, before, after)
  values (
    v_actor,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'user_id', v_row ->> 'plan_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;
revoke execute on function public.platform_audit_row() from public, anon, authenticated;
create trigger platform_audit after insert or update or delete on public.tenants                for each row execute function public.platform_audit_row();
create trigger platform_audit after insert or update or delete on public.platform_admins       for each row execute function public.platform_audit_row();
create trigger platform_audit after insert or update or delete on public.platform_plans        for each row execute function public.platform_audit_row();
create trigger platform_audit after insert or update or delete on public.platform_features     for each row execute function public.platform_audit_row();
create trigger platform_audit after insert or update or delete on public.platform_plan_features for each row execute function public.platform_audit_row();

-- ------------------------------------------------- policies, regenerated ----
-- Tenant tables: READ for any live member; INSERT / UPDATE (/ DELETE) for the
-- table's write roles with full access. Helper calls are wrapped in (select …).
do $$
declare
  spec   record;
  pol    record;
  v_read text := '((tenant_id = (select public.current_tenant_id())) and ((select public.tenant_access_level()) <> ''none'')'
              || ' and ((select public.current_role_in_tenant()) is not null)) or (select public.is_platform_admin())';
  v_using text;
  v_check text;
begin
  for spec in
    select * from (values
      -- table                     write roles                                              ins    upd    del    extra WITH CHECK
      ('properties',               array['owner','manager'],                                true,  true,  false, null),
      ('room_types',               array['owner','manager'],                                true,  true,  false, null),
      ('rooms',                    array['owner','manager','front_desk','housekeeping'],    true,  true,  false, null),
      ('rate_plans',               array['owner','manager'],                                true,  true,  true,  '(is_default or (select public.tenant_has_feature(''addon.rate_plans'')))'),
      ('rates',                    array['owner','manager'],                                true,  true,  true,  null),
      ('guests',                   array['owner','manager','front_desk'],                   true,  true,  false, null),
      ('bookings',                 array['owner','manager','front_desk'],                   true,  true,  false, null),
      ('booking_rooms',            null::text[],                                            false, false, false, null),
      ('folios',                   null::text[],                                            false, false, false, null),
      ('folio_items',              array['owner','manager','front_desk','accounts'],        true,  false, false, null),
      ('cash_shifts',              array['owner','manager','front_desk','accounts'],        true,  true,  false, null),
      ('housekeeping_tasks',       array['owner','manager','front_desk','housekeeping'],    true,  true,  true,  null),
      ('tenant_settings',          array['owner','manager'],                                true,  true,  false, null),
      ('tenant_branding',          array['owner','manager'],                                true,  true,  false, null),
      ('custom_field_definitions', array['owner','manager'],                                true,  true,  true,  '(select public.tenant_has_feature(''addon.custom_fields''))'),
      ('message_templates',        array['owner','manager'],                                true,  true,  true,  null),
      ('document_templates',       array['owner','manager'],                                true,  true,  true,  null)
    ) as t(tbl, roles, ins, upd, del, extra)
  loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = spec.tbl loop
      execute format('drop policy %I on public.%I', pol.policyname, spec.tbl);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (%s)', spec.tbl || '_read', spec.tbl, v_read);
    if spec.roles is null then continue; end if;
    v_using := format('((tenant_id = (select public.current_tenant_id())) and ((select public.tenant_access_level()) = ''full'')'
                   || ' and ((select public.current_role_in_tenant()) in (%s))) or (select public.is_platform_admin())',
                      (select string_agg(quote_literal(r), ', ') from unnest(spec.roles) r));
    v_check := case when spec.extra is null then v_using
                    else format('((tenant_id = (select public.current_tenant_id())) and ((select public.tenant_access_level()) = ''full'')'
                             || ' and ((select public.current_role_in_tenant()) in (%s)) and %s) or (select public.is_platform_admin())',
                                (select string_agg(quote_literal(r), ', ') from unnest(spec.roles) r), spec.extra) end;
    if spec.ins then
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)', spec.tbl || '_insert', spec.tbl, v_check);
    end if;
    if spec.upd then
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', spec.tbl || '_update', spec.tbl, v_using, v_check);
    end if;
    if spec.del then
      execute format('create policy %I on public.%I for delete to authenticated using (%s)', spec.tbl || '_delete', spec.tbl, v_using);
    end if;
  end loop;
end $$;

-- memberships: own rows + tenant members read; owner / manager manage (guarded by trigger)
drop policy if exists memberships_read  on public.memberships;
drop policy if exists memberships_write on public.memberships;
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid())
      or (tenant_id = (select public.current_tenant_id()) and (select public.tenant_access_level()) <> 'none'
          and (select public.current_role_in_tenant()) is not null)
      or (select public.is_platform_admin()));
create policy memberships_insert on public.memberships for insert to authenticated
  with check ((tenant_id = (select public.current_tenant_id()) and (select public.tenant_access_level()) = 'full'
               and (select public.current_role_in_tenant()) in ('owner', 'manager')) or (select public.is_platform_admin()));
create policy memberships_update on public.memberships for update to authenticated
  using ((tenant_id = (select public.current_tenant_id()) and (select public.tenant_access_level()) = 'full'
          and (select public.current_role_in_tenant()) in ('owner', 'manager')) or (select public.is_platform_admin()))
  with check ((tenant_id = (select public.current_tenant_id()) and (select public.tenant_access_level()) = 'full'
               and (select public.current_role_in_tenant()) in ('owner', 'manager')) or (select public.is_platform_admin()));
create policy memberships_delete on public.memberships for delete to authenticated
  using ((tenant_id = (select public.current_tenant_id()) and (select public.tenant_access_level()) = 'full'
          and (select public.current_role_in_tenant()) in ('owner', 'manager')) or (select public.is_platform_admin()));

-- tenants: members see theirs; admins manage
drop policy if exists tenants_read  on public.tenants;
drop policy if exists tenants_admin on public.tenants;
create policy tenants_read on public.tenants for select to authenticated
  using ((id = (select public.current_tenant_id()) and (select public.current_role_in_tenant()) is not null)
      or exists (select 1 from public.memberships m where m.tenant_id = tenants.id and m.user_id = (select auth.uid()))
      or (select public.is_platform_admin()));
create policy tenants_admin_insert on public.tenants for insert to authenticated with check ((select public.is_platform_admin()));
create policy tenants_admin_update on public.tenants for update to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));
create policy tenants_admin_delete on public.tenants for delete to authenticated using ((select public.is_platform_admin()));

-- platform catalogue, billing and overrides: split the admin "for all" policies
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['platform_features', 'platform_plans', 'platform_plan_features', 'platform_message_templates',
                           'platform_document_templates', 'platform_admins', 'platform_audit_log', 'subscriptions',
                           'subscription_events', 'tenant_feature_overrides', 'invoices', 'invoice_items', 'payments',
                           'platform_signup_requests']
  loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t and policyname like '%\_admin' loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_platform_admin()))', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()))', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_platform_admin()))', t || '_admin_delete', t);
  end loop;
end $$;
-- tables whose only readers are admins
create policy platform_admins_read    on public.platform_admins    for select to authenticated using ((select public.is_platform_admin()));
create policy platform_audit_log_read on public.platform_audit_log for select to authenticated using ((select public.is_platform_admin()));
create policy platform_signup_requests_read on public.platform_signup_requests for select to authenticated using ((select public.is_platform_admin()));
-- member reads of billing state, wrapped
do $$
declare t text; pol record;
begin
  foreach t in array array['subscriptions', 'subscription_events', 'tenant_feature_overrides', 'invoices', 'payments'] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read' loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for select to authenticated using (((tenant_id = (select public.current_tenant_id())) and ((select public.tenant_access_level()) <> ''none'') and ((select public.current_role_in_tenant()) is not null)) or (select public.is_platform_admin()))', t || '_read', t);
  end loop;
end $$;
drop policy if exists invoice_items_read on public.invoice_items;
create policy invoice_items_read on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i
                 where i.id = invoice_id
                   and ((i.tenant_id = (select public.current_tenant_id()) and (select public.tenant_access_level()) <> 'none'
                         and (select public.current_role_in_tenant()) is not null)
                        or (select public.is_platform_admin()))));
-- the public form: pending requests only, no admin fields
drop policy if exists platform_signup_requests_insert on public.platform_signup_requests;
create policy platform_signup_requests_insert on public.platform_signup_requests for insert to anon, authenticated
  with check (status = 'pending' and tenant_id is null and reviewed_by is null and reviewed_at is null and notes is null);
-- audit_log read, wrapped
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated
  using ((tenant_id = (select public.current_tenant_id()) and (select public.tenant_access_level()) <> 'none'
          and (select public.current_role_in_tenant()) in ('owner', 'manager', 'accounts')) or (select public.is_platform_admin()));

-- ------------------------------------------------------------ search_path ----
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------- indexes ----
create extension if not exists pg_trgm with schema extensions;
create index if not exists bookings_guest_idx                 on public.bookings (guest_id);
create index if not exists bookings_stay_gist_idx             on public.bookings using gist (property_id extensions.gist_uuid_ops, daterange(check_in, check_out, '[)'));
create index if not exists rooms_type_idx                     on public.rooms (room_type_id);
create index if not exists booking_rooms_type_idx             on public.booking_rooms (room_type_id);
create index if not exists housekeeping_tasks_room_idx        on public.housekeeping_tasks (room_id);
create index if not exists guests_name_trgm_idx               on public.guests using gin (name extensions.gin_trgm_ops);
create index if not exists guests_phone_trgm_idx              on public.guests using gin (phone extensions.gin_trgm_ops);
create index if not exists audit_log_row_idx                  on public.audit_log (table_name, row_id, at desc);
create index if not exists subscriptions_status_idx           on public.subscriptions (status, trial_ends_at, current_period_end);
create index if not exists memberships_tenant_role_idx        on public.memberships (tenant_id, role);
create index if not exists platform_plan_features_feature_idx on public.platform_plan_features (feature_key);
create index if not exists tenant_feature_overrides_feat_idx  on public.tenant_feature_overrides (feature_key);
create index if not exists invoice_items_invoice_idx          on public.invoice_items (invoice_id);
create index if not exists payments_invoice_idx               on public.payments (invoice_id);
