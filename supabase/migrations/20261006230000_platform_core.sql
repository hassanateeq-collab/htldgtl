-- =============================================================================
-- Hotel Digital — platform core (migration 1)
-- Tenancy, feature catalog & plans, subscriptions & billing, data-only
-- customization, audit, and the helper functions every RLS policy uses.
-- Operational tables (rooms, bookings, folios, cash) follow in migration 2.
--
-- Design: docs/architecture/data-model.md · ADRs 0001–0004.
-- Rules: every tenant table carries tenant_id, has RLS enabled, an updated_at
-- trigger and the generic audit trigger. Platform admins pass every policy via
-- is_platform_admin(); their writes are still captured by the audit trigger and
-- their operator actions by platform_audit_log (via RPCs).
-- =============================================================================

create extension if not exists pgcrypto   with schema extensions;
create extension if not exists btree_gist with schema extensions; -- no-double-book EXCLUDE in migration 2

-- ---------------------------------------------------------------- enums ----
create type public.tenant_role         as enum ('owner','manager','front_desk','housekeeping','accounts','read_only');
create type public.subscription_status as enum ('trialing','active','past_due','read_only','suspended','cancelled');
create type public.payment_method      as enum ('bank_transfer','raast','jazzcash','easypaisa','cash');
create type public.invoice_status      as enum ('draft','sent','paid','void');
create type public.signup_status       as enum ('pending','approved','rejected');
create type public.template_channel    as enum ('whatsapp','email');
create type public.custom_field_entity as enum ('guest','booking');
create type public.custom_field_type   as enum ('text','number','date','select','boolean');

-- ----------------------------------------------------- generic triggers ----
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------ platform tables ----
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  role       text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now()
);

create table public.platform_features (
  key         text primary key check (key ~ '^(core|addon)\.[a-z0-9_.]+$'),
  name        text not null,
  description text,
  is_core     boolean not null default false,
  is_addon    boolean not null default false,
  check (is_core <> is_addon)
);

create table public.platform_plans (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name           text not null,
  price_pkr      numeric(12,2) not null default 0,
  interval       text not null default 'monthly' check (interval = 'monthly'),
  max_properties int  not null default 1,
  trial_days     int  not null default 14,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.platform_plan_features (
  plan_id     uuid not null references public.platform_plans(id) on delete cascade,
  feature_key text not null references public.platform_features(key) on delete cascade,
  primary key (plan_id, feature_key)
);

create table public.platform_message_templates (
  key     text not null,
  channel public.template_channel not null,
  body    text not null,
  primary key (key, channel)
);

create table public.platform_document_templates (
  key  text primary key,
  body text not null
);

create table public.platform_audit_log (
  id           bigint generated always as identity primary key,
  actor_admin  uuid references public.platform_admins(user_id),
  action       text not null,
  target_table text,
  target_id    text,
  before       jsonb,
  after        jsonb,
  at           timestamptz not null default now()
);

-- ------------------------------------------------------ tenants & access ----
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  custom_domain text unique,                       -- reserved: wildcard/custom domains later (ADR 0001)
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.platform_signup_requests (
  id           uuid primary key default gen_random_uuid(),
  hotel_name   text not null,
  city         text not null,
  rooms        int,
  contact_name text not null,
  email        text not null,
  phone        text not null,
  status       public.signup_status not null default 'pending',
  notes        text,
  created_at   timestamptz not null default now(),
  reviewed_by  uuid references public.platform_admins(user_id),
  reviewed_at  timestamptz,
  tenant_id    uuid references public.tenants(id) on delete set null -- set on approval
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.tenant_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.properties (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  timezone     text not null default 'Asia/Karachi',
  currency     text not null default 'PKR',
  address      text,
  city         text,
  wubook_lcode text,                               -- set by the operator for addon.channel_wubook (ADR 0005)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index properties_tenant_idx on public.properties (tenant_id);

-- ------------------------------------------------ subscriptions & billing ----
create table public.subscriptions (
  tenant_id            uuid primary key references public.tenants(id) on delete cascade,
  plan_id              uuid not null references public.platform_plans(id),
  status               public.subscription_status not null default 'trialing',
  trial_ends_at        timestamptz,
  current_period_start date,
  current_period_end   date,
  grace_days           int not null default 7,
  read_only_days       int not null default 7,
  suspended_at         timestamptz,
  cancelled_at         timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.subscription_events (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  from_status public.subscription_status,
  to_status   public.subscription_status not null,
  reason      text,
  actor       text,
  at          timestamptz not null default now()
);
create index subscription_events_tenant_idx on public.subscription_events (tenant_id, at desc);

create table public.tenant_feature_overrides (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null references public.platform_features(key) on delete cascade,
  enabled     boolean not null,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  reason      text,
  granted_by  uuid references public.platform_admins(user_id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tenant_feature_overrides_idx on public.tenant_feature_overrides (tenant_id, feature_key);

create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  invoice_no   text not null unique,
  period_start date not null,
  period_end   date not null,
  amount_pkr   numeric(12,2) not null default 0,
  status       public.invoice_status not null default 'draft',
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index invoices_tenant_idx on public.invoices (tenant_id);

create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  amount_pkr  numeric(12,2) not null
);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  invoice_id  uuid references public.invoices(id) on delete set null,
  amount_pkr  numeric(12,2) not null check (amount_pkr > 0),
  method      public.payment_method not null,
  reference   text,
  received_at timestamptz not null default now(),
  recorded_by uuid references public.platform_admins(user_id),
  created_at  timestamptz not null default now()
);
create index payments_tenant_idx on public.payments (tenant_id);

-- ------------------------------------------- customization (data, never code) ----
create table public.tenant_settings (
  tenant_id      uuid primary key references public.tenants(id) on delete cascade,
  settings       jsonb not null default '{}'::jsonb,
  schema_version int not null default 1,
  updated_at     timestamptz not null default now()
);

create table public.tenant_branding (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  logo_url      text,
  primary_color text,
  legal_name    text,
  address       text,
  ntn           text,
  strn          text,
  updated_at    timestamptz not null default now()
);

create table public.custom_field_definitions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  entity     public.custom_field_entity not null,
  key        text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$'),
  label      text not null,
  type       public.custom_field_type not null default 'text',
  required   boolean not null default false,
  options    jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity, key)
);

create table public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  key        text not null,
  channel    public.template_channel not null,
  body       text not null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, key, channel)
);

create table public.document_templates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  key        text not null,
  body       text not null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

-- --------------------------------------------------------- tenant audit ----
create table public.audit_log (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null,
  actor_user uuid,
  table_name text not null,
  row_id     text,
  action     text not null check (action in ('insert','update','delete')),
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id, at desc);

-- Actor = app.actor_user (set by edge functions via set_config) else the JWT user.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row    jsonb;
  v_tenant uuid;
  v_actor  uuid;
begin
  v_row    := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_tenant := (v_row ->> 'tenant_id')::uuid;
  v_actor  := coalesce(nullif(current_setting('app.actor_user', true), '')::uuid, auth.uid());
  insert into public.audit_log (tenant_id, actor_user, table_name, row_id, action, before, after)
  values (
    v_tenant,
    v_actor,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'tenant_id'),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

-- ------------------------------------------ helper functions (used by RLS) ----
create or replace function public.current_tenant_id() returns uuid
language sql stable as $$
  select nullif(coalesce(auth.jwt() -> 'app_metadata' ->> 'active_tenant', ''), '')::uuid
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create or replace function public.current_role_in_tenant() returns public.tenant_role
language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m
  where m.tenant_id = public.current_tenant_id() and m.user_id = auth.uid()
  limit 1
$$;

-- full | read_only | none, from the tenant's subscription state (ADR 0004).
-- No subscription row => null => every policy denies (safe default).
create or replace function public.tenant_access_level() returns text
language sql stable security definer set search_path = public as $$
  select case s.status
           when 'trialing'  then 'full'
           when 'active'    then 'full'
           when 'past_due'  then 'full'
           when 'read_only' then 'read_only'
           else 'none'
         end
  from public.subscriptions s
  where s.tenant_id = public.current_tenant_id()
$$;

-- Effective feature = latest in-window override if any, else plan membership.
create or replace function public.tenant_has_feature(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
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
  select coalesce((select enabled from ov), (select v from plan_has), false)
$$;

-- Lets a suspended tenant's shell still learn its status (RLS hides subscriptions at 'none').
create or replace function public.my_tenant_access()
returns table (tenant_id uuid, status public.subscription_status, access_level text)
language sql stable security definer set search_path = public as $$
  select s.tenant_id, s.status, public.tenant_access_level()
  from public.subscriptions s
  where s.tenant_id = public.current_tenant_id()
$$;

-- ------------------------------------------------------------------ RPCs ----
-- Operator provisions a tenant (also used by signup approval). Audited.
create or replace function public.provision_tenant(
  p_name          text,
  p_slug          text,
  p_property_name text,
  p_city          text default null,
  p_plan_key      text default 'trial',
  p_owner_user    uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_plan   public.platform_plans%rowtype;
  v_status public.subscription_status;
begin
  if not public.is_platform_admin() then
    raise exception 'provision_tenant: platform admin only';
  end if;

  select * into v_plan from public.platform_plans where key = p_plan_key and is_active;
  if v_plan.id is null then
    raise exception 'provision_tenant: unknown plan %', p_plan_key;
  end if;

  v_status := case when p_plan_key = 'trial'
                then 'trialing'::public.subscription_status
                else 'active'::public.subscription_status end;

  insert into public.tenants (name, slug) values (p_name, p_slug) returning id into v_tenant;
  insert into public.properties (tenant_id, name, city) values (v_tenant, p_property_name, p_city);
  insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
  values (
    v_tenant, v_plan.id, v_status,
    case when v_status = 'trialing' then now() + make_interval(days => v_plan.trial_days) end,
    current_date, current_date + 30
  );
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

-- ------------------------------------------------------ updated_at triggers ----
create trigger set_updated_at before update on public.platform_plans            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tenants                   for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.memberships               for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.properties                for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.subscriptions             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tenant_feature_overrides  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invoices                  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tenant_settings           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tenant_branding           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.custom_field_definitions  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.message_templates         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.document_templates        for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- audit triggers ----
create trigger audit after insert or update or delete on public.memberships              for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.properties               for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.subscriptions            for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.tenant_feature_overrides for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.invoices                 for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.payments                 for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.tenant_settings          for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.tenant_branding          for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.custom_field_definitions for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.message_templates        for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.document_templates       for each row execute function public.audit_row();

-- ------------------------------------------------------------------- RLS ----
-- Canonical predicates (data-model.md):
--   READ  : (tenant_id = current_tenant_id() and tenant_access_level() <> 'none') or is_platform_admin()
--   WRITE : (tenant_id = current_tenant_id() and tenant_access_level() = 'full'
--            and current_role_in_tenant() in (<roles>)) or is_platform_admin()

alter table public.platform_admins            enable row level security;
alter table public.platform_features          enable row level security;
alter table public.platform_plans             enable row level security;
alter table public.platform_plan_features     enable row level security;
alter table public.platform_message_templates enable row level security;
alter table public.platform_document_templates enable row level security;
alter table public.platform_audit_log         enable row level security;
alter table public.platform_signup_requests   enable row level security;
alter table public.tenants                    enable row level security;
alter table public.memberships                enable row level security;
alter table public.properties                 enable row level security;
alter table public.subscriptions              enable row level security;
alter table public.subscription_events        enable row level security;
alter table public.tenant_feature_overrides   enable row level security;
alter table public.invoices                   enable row level security;
alter table public.invoice_items              enable row level security;
alter table public.payments                   enable row level security;
alter table public.tenant_settings            enable row level security;
alter table public.tenant_branding            enable row level security;
alter table public.custom_field_definitions   enable row level security;
alter table public.message_templates          enable row level security;
alter table public.document_templates         enable row level security;
alter table public.audit_log                  enable row level security;

-- platform catalog: readable by any signed-in user, written by platform admins
create policy platform_features_read  on public.platform_features  for select to authenticated using (true);
create policy platform_features_admin on public.platform_features  for all    to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_plans_read     on public.platform_plans     for select to authenticated using (true);
create policy platform_plans_admin    on public.platform_plans     for all    to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_plan_features_read  on public.platform_plan_features for select to authenticated using (true);
create policy platform_plan_features_admin on public.platform_plan_features for all    to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_message_templates_read  on public.platform_message_templates  for select to authenticated using (true);
create policy platform_message_templates_admin on public.platform_message_templates  for all    to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_document_templates_read  on public.platform_document_templates for select to authenticated using (true);
create policy platform_document_templates_admin on public.platform_document_templates for all    to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- platform admins & operator audit: admins only
create policy platform_admins_admin    on public.platform_admins    for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_audit_log_admin on public.platform_audit_log for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- signup requests: the public form may insert a pending request; admins manage them
create policy platform_signup_requests_insert on public.platform_signup_requests for insert to anon, authenticated
  with check (status = 'pending' and tenant_id is null and reviewed_by is null and reviewed_at is null);
create policy platform_signup_requests_admin  on public.platform_signup_requests for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- tenants: members see their own tenant; only admins (and RPCs) create/modify
create policy tenants_read  on public.tenants for select to authenticated
  using (id = public.current_tenant_id() or public.is_platform_admin());
create policy tenants_admin on public.tenants for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- memberships: a user always sees their own memberships (tenant picker); members see their tenant's; owner/manager manage
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid()
      or (tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none')
      or public.is_platform_admin());
create policy memberships_write on public.memberships for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

-- properties: tenant read; owner/manager write
create policy properties_read on public.properties for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy properties_write on public.properties for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

-- billing state: tenant members may read; only the operator writes
create policy subscriptions_read on public.subscriptions for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy subscriptions_admin on public.subscriptions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy subscription_events_read on public.subscription_events for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy subscription_events_admin on public.subscription_events for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy tenant_feature_overrides_read on public.tenant_feature_overrides for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy tenant_feature_overrides_admin on public.tenant_feature_overrides for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy invoices_read on public.invoices for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy invoices_admin on public.invoices for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy invoice_items_read on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i
                 where i.id = invoice_id
                   and ((i.tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none')
                        or public.is_platform_admin())));
create policy invoice_items_admin on public.invoice_items for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy payments_read on public.payments for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy payments_admin on public.payments for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- customization: tenant read; owner/manager write (custom fields additionally gated by the add-on)
create policy tenant_settings_read on public.tenant_settings for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy tenant_settings_write on public.tenant_settings for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

create policy tenant_branding_read on public.tenant_branding for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy tenant_branding_write on public.tenant_branding for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

create policy custom_field_definitions_read on public.custom_field_definitions for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy custom_field_definitions_write on public.custom_field_definitions for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')
          and public.tenant_has_feature('addon.custom_fields')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')
          and public.tenant_has_feature('addon.custom_fields')) or public.is_platform_admin());

create policy message_templates_read on public.message_templates for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy message_templates_write on public.message_templates for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

create policy document_templates_read on public.document_templates for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none') or public.is_platform_admin());
create policy document_templates_write on public.document_templates for all to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin())
  with check ((tenant_id = public.current_tenant_id() and public.tenant_access_level() = 'full'
          and public.current_role_in_tenant() in ('owner','manager')) or public.is_platform_admin());

-- tenant audit log: owner/manager/accounts read; no direct writes (the trigger is security definer)
create policy audit_log_read on public.audit_log for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() in ('owner','manager','accounts')) or public.is_platform_admin());

-- ------------------------------------------------------------------ seed ----
insert into public.platform_features (key, name, description, is_core, is_addon) values
  ('core.frontdesk',       'Front desk',               'Room grid / today view: arrivals, departures, in-house',    true,  false),
  ('core.bookings',        'Bookings',                 'Create, modify, cancel, no-show',                           true,  false),
  ('core.guests',          'Guests',                   'Guest profiles: name, phone, CNIC/passport',                true,  false),
  ('core.folio',           'Folio',                    'Charges, payments, balance, receipt PDF',                   true,  false),
  ('core.housekeeping',    'Housekeeping',             'Room clean/dirty status and a simple task list',            true,  false),
  ('core.reports.daily',   'Daily report',             'Daily arrivals, occupancy, cash collected',                 true,  false),
  ('core.cash_handover',   'Cash handover',            'Shift cash declaration and handover',                       true,  false),
  ('addon.channel_wubook', 'Channel manager (WuBook)', 'OTA rates, availability and reservations via WuBook',       false, true),
  ('addon.whatsapp',       'WhatsApp messaging',       'Booking confirmation, pre-arrival and check-out messages',  false, true),
  ('addon.booking_engine', 'Booking engine',           'Direct pay-at-hotel booking page',                          false, true),
  ('addon.multi_property', 'Multi-property',           'More than one property under a tenant',                     false, true),
  ('addon.rate_plans',     'Rate plans',               'Multiple rate plans and seasonal pricing',                  false, true),
  ('addon.invoicing',      'Invoicing',                'Tax invoices, company billing, credit accounts',            false, true),
  ('addon.expenses',       'Expenses',                 'Simple expense log per property',                           false, true),
  ('addon.custom_fields',  'Custom fields',            'Tenant-defined fields on guests and bookings',              false, true);

-- Prices are data: seeded at 0 PKR until Hassan sets them in the admin console.
insert into public.platform_plans (key, name, price_pkr, max_properties, trial_days) values
  ('trial',     'Trial',     0, 1, 14),
  ('basic',     'Basic',     0, 1, 0),
  ('connected', 'Connected', 0, 1, 0);

-- every plan gets all core features
insert into public.platform_plan_features (plan_id, feature_key)
select p.id, f.key
from public.platform_plans p
cross join public.platform_features f
where f.is_core;

-- Connected = Basic + channel manager + WhatsApp
insert into public.platform_plan_features (plan_id, feature_key)
select p.id, f.key
from public.platform_plans p
join public.platform_features f on f.key in ('addon.channel_wubook', 'addon.whatsapp')
where p.key = 'connected';
