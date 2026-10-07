-- =============================================================================
-- Hotel Digital — hotel business date, document counters, property settings
-- (migration 10, Release A part 1 of 5)
--
-- * The hotel day: property_today(property_id) = today in the property's
--   timezone. Supabase runs Postgres in UTC, so current_date is yesterday
--   between 00:00 and 05:00 PKT; every "today" in SQL now goes through this.
-- * Atomic, race-safe document numbers (booking, receipt, folio) from
--   property_counters via next_doc_no(); replaces the regex scan of booking_no.
-- * Property-level front-desk settings: check-in/out times, sales tax
--   (none | exclusive | inclusive, room-only or all charges), legal identity
--   (NTN/STRN), ID-at-check-in requirement, early-departure policy.
-- * tenant_settings.settings is validated (prefix shapes, charge presets).
--
-- Error codes raised by Release A functions (class HD = Hotel Digital; the app
-- maps error.code, never the message):
--   HD001 balance due · HD002 credit balance · HD003 bad transition / immutable
--   HD005 bad dates · HD006 guest ID required · HD007 folio closed
--   HD008 room unavailable · HD009 deposit needs a method · HD011 guest required
--   HD012 cash shift state · HD013 membership rule · HD014 plan limit
--   HD015 void / immutability rule · 42501 not permitted · P0002 not found
--   23P01 room taken (EXCLUDE constraint)
-- =============================================================================

-- ------------------------------------------------------ property settings ----
alter table public.properties
  add column if not exists check_in_time          time    not null default '14:00',
  add column if not exists check_out_time         time    not null default '12:00',
  add column if not exists phone                  text,
  add column if not exists email                  text,
  add column if not exists tax_name               text,
  add column if not exists tax_rate_pct           numeric(5,2) not null default 0,
  add column if not exists tax_mode               text    not null default 'none',
  add column if not exists tax_applies_to         text    not null default 'room',
  add column if not exists ntn                    text,
  add column if not exists strn                   text,
  add column if not exists require_id_at_check_in boolean not null default true,
  add column if not exists early_departure_policy text    not null default 'release',
  add column if not exists is_active              boolean not null default true;

alter table public.properties
  add constraint properties_tax_rate_check        check (tax_rate_pct >= 0 and tax_rate_pct <= 100),
  add constraint properties_tax_mode_check        check (tax_mode in ('none', 'exclusive', 'inclusive')),
  add constraint properties_tax_applies_check     check (tax_applies_to in ('room', 'all')),
  add constraint properties_tax_consistency_check check (tax_mode = 'none' or (tax_rate_pct > 0 and tax_name is not null)),
  add constraint properties_early_departure_check check (early_departure_policy in ('release', 'charge_full'));

-- legal identity moves to the property (a multi-property tenant files per property)
update public.properties p
   set ntn = coalesce(p.ntn, b.ntn), strn = coalesce(p.strn, b.strn)
  from public.tenant_branding b
 where b.tenant_id = p.tenant_id;

-- ------------------------------------------------------ the hotel's today ----
create or replace function public.property_today(p_property_id uuid) returns date
language sql stable security definer set search_path = public, pg_temp as $$
  select (now() at time zone coalesce(p.timezone, 'Asia/Karachi'))::date
  from public.properties p where p.id = p_property_id
$$;
revoke execute on function public.property_today(uuid) from public, anon;
grant  execute on function public.property_today(uuid) to authenticated, service_role;

-- -------------------------------------------------------- document counters ----
create table public.property_counters (
  property_id uuid    not null references public.properties(id) on delete cascade,
  kind        text    not null check (kind in ('booking', 'receipt', 'folio')),
  last_no     integer not null default 1000,
  primary key (property_id, kind)
);
alter table public.property_counters enable row level security;
-- tenant roles never touch counters directly; next_doc_no() is the only writer
create policy property_counters_admin_read on public.property_counters for select to authenticated
  using ((select public.is_platform_admin()));

-- continue the existing booking series
insert into public.property_counters (property_id, kind, last_no)
select b.property_id, 'booking', max(((regexp_match(b.booking_no, '(\d+)$'))[1])::int)
from public.bookings b
where b.booking_no ~ '\d+$'
group by b.property_id
on conflict (property_id, kind) do update set last_no = greatest(public.property_counters.last_no, excluded.last_no);

-- <prefix>-<n>, atomic under concurrency (single-row upsert). Prefix comes from
-- tenant_settings (booking_prefix / receipt_prefix / folio_prefix). Callers must
-- be able to write in the property's tenant, so a stray RPC call can at most
-- burn a number in the caller's own series.
create or replace function public.next_doc_no(p_property_id uuid, p_kind text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tenant uuid;
  v_role   public.tenant_role;
  v_prefix text;
  v_no     integer;
begin
  if p_kind not in ('booking', 'receipt', 'folio') then
    raise exception 'next_doc_no: unknown kind %', p_kind using errcode = '22023';
  end if;
  select tenant_id into v_tenant from public.properties where id = p_property_id;
  if v_tenant is null then
    raise exception 'next_doc_no: property not found' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not public.is_platform_admin() then
    select m.role into v_role from public.memberships m where m.tenant_id = v_tenant and m.user_id = auth.uid();
    if v_role is null or v_role not in ('owner', 'manager', 'front_desk', 'accounts') then
      raise exception 'next_doc_no: not permitted' using errcode = '42501';
    end if;
  end if;

  select case p_kind
           when 'booking' then ts.settings ->> 'booking_prefix'
           when 'receipt' then ts.settings ->> 'receipt_prefix'
           else                ts.settings ->> 'folio_prefix'
         end
    into v_prefix
  from public.tenant_settings ts where ts.tenant_id = v_tenant;
  v_prefix := coalesce(v_prefix, case p_kind when 'booking' then 'BK' when 'receipt' then 'RCT' else 'F' end);

  insert into public.property_counters (property_id, kind, last_no)
  values (p_property_id, p_kind, 1001)
  on conflict (property_id, kind) do update set last_no = public.property_counters.last_no + 1
  returning last_no into v_no;

  return v_prefix || '-' || v_no;
end $$;
revoke execute on function public.next_doc_no(uuid, text) from public, anon;
grant  execute on function public.next_doc_no(uuid, text) to authenticated, service_role;

-- kept for callers of the old name; now consumes a number
drop function if exists public.next_booking_no(uuid);
create function public.next_booking_no(p_property_id uuid) returns text
language sql security definer set search_path = public, pg_temp as $$
  select public.next_doc_no(p_property_id, 'booking')
$$;
revoke execute on function public.next_booking_no(uuid) from public, anon;
grant  execute on function public.next_booking_no(uuid) to authenticated, service_role;

-- ------------------------------------------------- tenant_settings validation ----
-- Settings are data (ADR 0003); their shape is checked here so a bad prefix can
-- never corrupt a document series.
create or replace function public.tenant_settings_validate() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  k text;
begin
  if jsonb_typeof(new.settings) <> 'object' then
    raise exception 'tenant_settings: settings must be a JSON object' using errcode = '23514';
  end if;
  foreach k in array array['booking_prefix', 'receipt_prefix', 'folio_prefix'] loop
    if new.settings ? k and (new.settings ->> k) !~ '^[A-Z0-9]{1,6}$' then
      raise exception 'tenant_settings: % must be 1–6 upper-case letters or digits', k using errcode = '23514';
    end if;
  end loop;
  if new.settings ? 'charge_presets' and jsonb_typeof(new.settings -> 'charge_presets') <> 'array' then
    raise exception 'tenant_settings: charge_presets must be an array' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.tenant_settings_validate() from public, anon, authenticated;
create trigger validate before insert or update on public.tenant_settings
  for each row execute function public.tenant_settings_validate();
