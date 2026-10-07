-- =============================================================================
-- Hotel Digital — folio integrity (migration 11, Release A part 2 of 5)
--
-- The folio is the hotel's cash record, so it becomes append-only:
-- * folio_items can be inserted by cashier roles but never updated or deleted
--   through the API; corrections are new rows, and a manager/owner/accounts
--   user can VOID an item with a reason (void_folio_item). Totals ignore voided
--   rows. Folios themselves are read-only for the API: status, totals and
--   numbers are maintained by triggers and the lifecycle RPCs.
-- * Each item carries a category (room, food, laundry, minibar, extra, fee,
--   adjustment, deposit, settlement, other), a source (manual, auto, system),
--   the night it pays for (service_date), the hotel business day it was posted
--   on, the sales tax computed from the property's tax settings, and — for
--   payments and refunds — a receipt number and the open cash shift.
-- * Room charges are posted per night (one row per service_date) so early and
--   late departures, rate changes and daily revenue need no description
--   matching. Existing lump-sum rows in open folios are converted.
-- * recompute_folio() locks the folio row before summing (no lost updates) and
--   maintains total_tax; balance = charges + tax − payments (net of discounts
--   and refunds).
-- * Every folio gets a number (F-1001…) from the property counter.
-- =============================================================================

-- ------------------------------------------------------------- columns ----
alter table public.folio_items
  add column if not exists category         text not null default 'other',
  add column if not exists source           text not null default 'manual',
  add column if not exists service_date     date,
  add column if not exists business_date    date,
  add column if not exists tax_pkr          numeric(12,2) not null default 0,
  add column if not exists receipt_no       text,
  add column if not exists cash_shift_id    uuid references public.cash_shifts(id) on delete set null,
  add column if not exists booking_room_id  uuid references public.booking_rooms(id) on delete set null,
  add column if not exists voided_at        timestamptz,
  add column if not exists voided_by        uuid,
  add column if not exists void_reason      text,
  add column if not exists reverses_item_id uuid references public.folio_items(id);

alter table public.folio_items
  add constraint folio_items_category_check
    check (category in ('room', 'food', 'laundry', 'minibar', 'extra', 'fee', 'adjustment', 'deposit', 'settlement', 'other')),
  add constraint folio_items_source_check check (source in ('manual', 'auto', 'system')),
  add constraint folio_items_tax_check    check (tax_pkr >= 0),
  add constraint folio_items_void_check   check ((voided_at is null) = (void_reason is null));

alter table public.folios
  add column if not exists total_tax     numeric(12,2) not null default 0,
  add column if not exists folio_no      text,
  add column if not exists reopened_at   timestamptz,
  add column if not exists reopened_by   uuid,
  add column if not exists reopen_reason text;
create unique index if not exists folios_property_folio_no_idx on public.folios (property_id, folio_no) where folio_no is not null;

-- ------------------------------------------- totals: locked, voided-aware ----
create or replace function public.recompute_folio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_folio uuid := case when tg_op = 'DELETE' then old.folio_id else new.folio_id end;
begin
  -- Lock first: a concurrent posting then computes its sum after this one
  -- commits, so no contribution is ever overwritten.
  perform 1 from public.folios where id = v_folio for update;
  update public.folios f
     set total_charges  = s.charges,
         total_tax      = s.tax,
         total_payments = s.payments,
         balance        = s.charges + s.tax - s.payments
    from (
      select coalesce(sum(case when kind = 'charge'   then amount_pkr end), 0)
           - coalesce(sum(case when kind = 'discount' then amount_pkr end), 0) as charges,
             coalesce(sum(case when kind = 'charge'   then tax_pkr end), 0)
           - coalesce(sum(case when kind = 'discount' then tax_pkr end), 0) as tax,
             coalesce(sum(case when kind = 'payment'  then amount_pkr end), 0)
           - coalesce(sum(case when kind = 'refund'   then amount_pkr end), 0) as payments
      from public.folio_items
      where folio_id = v_folio and voided_at is null
    ) s
   where f.id = v_folio;
  return null;
end $$;

-- ------------------------------------------------------------ backfill ----
update public.folio_items set category = 'room',    source = 'auto' where kind = 'charge'  and description like 'Room charge%';
update public.folio_items set category = 'deposit', source = 'auto' where kind = 'payment' and description = 'Advance payment';
update public.folio_items fi
   set business_date = (fi.posted_at at time zone coalesce(p.timezone, 'Asia/Karachi'))::date
  from public.properties p
 where p.id = fi.property_id and fi.business_date is null;
alter table public.folio_items alter column business_date set not null;

-- lump-sum room charges in OPEN folios become one row per night (same rate,
-- original posting time); the lump row is voided as a system correction
do $$
declare
  r      record;
  d      date;
  v_rate numeric;
  v_br   uuid;
begin
  for r in
    select fi.*, b.check_in, b.check_out, b.id as booking_id
    from public.folio_items fi
    join public.folios   f on f.id = fi.folio_id and f.status = 'open'
    join public.bookings b on b.id = f.booking_id
    where fi.kind = 'charge' and fi.category = 'room' and fi.source = 'auto'
      and fi.service_date is null and fi.voided_at is null
  loop
    if r.check_out <= r.check_in then continue; end if;
    select br.id into v_br from public.booking_rooms br where br.booking_id = r.booking_id limit 1;
    v_rate := round(r.amount_pkr / (r.check_out - r.check_in), 2);
    update public.folio_items
       set voided_at = now(), void_reason = 'Converted to per-night room charges'
     where id = r.id;
    d := r.check_in;
    while d < r.check_out loop
      insert into public.folio_items
        (folio_id, tenant_id, property_id, kind, category, source, description, amount_pkr,
         service_date, business_date, posted_at, posted_by, booking_room_id)
      values
        (r.folio_id, r.tenant_id, r.property_id, 'charge', 'room', 'auto', 'Room charge', v_rate,
         d, r.business_date, r.posted_at, r.posted_by, v_br);
      d := d + 1;
    end loop;
  end loop;
end $$;

-- --------------------------------------------- prepare (replaces fill) ----
drop trigger if exists fill on public.folio_items;
drop function if exists public.folio_items_fill();

create or replace function public.folio_items_prepare() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status public.folio_status;
  v_prop   public.properties%rowtype;
  v_rate   numeric;
begin
  select f.tenant_id, f.property_id, f.status into new.tenant_id, new.property_id, v_status
  from public.folios f where f.id = new.folio_id;
  if new.tenant_id is null then
    raise exception 'folio_items: folio not found' using errcode = 'P0002';
  end if;
  if v_status = 'closed' then
    raise exception 'folio_items: folio is closed' using errcode = 'HD007';
  end if;
  if new.amount_pkr is null or new.amount_pkr <= 0 then
    raise exception 'folio_items: amount must be positive' using errcode = '23514';
  end if;

  select * into v_prop from public.properties where id = new.property_id;

  -- server-stamped: who, when, and which hotel day; items are never born voided
  new.posted_at     := now();
  new.posted_by     := coalesce(auth.uid(), new.posted_by);
  new.business_date := (now() at time zone coalesce(v_prop.timezone, 'Asia/Karachi'))::date;
  new.voided_at     := null;
  new.voided_by     := null;
  new.void_reason   := null;
  new.description   := nullif(trim(new.description), '');
  if new.description is null then
    new.description := case new.kind
                         when 'payment'  then 'Payment'
                         when 'refund'   then 'Refund'
                         when 'discount' then 'Discount'
                         else initcap(new.category)
                       end;
  end if;

  if new.kind in ('payment', 'refund') then
    new.tax_pkr    := 0;
    new.receipt_no := public.next_doc_no(new.property_id, 'receipt');
    select cs.id into new.cash_shift_id
    from public.cash_shifts cs
    where cs.property_id = new.property_id and cs.status = 'open'
    order by cs.opened_at desc
    limit 1;
  else
    new.receipt_no    := null;
    new.cash_shift_id := null;
    if v_prop.tax_mode <> 'none'
       and (v_prop.tax_applies_to = 'all' or new.category = 'room')
       and new.category <> 'adjustment' then
      v_rate := v_prop.tax_rate_pct / 100;
      if v_prop.tax_mode = 'exclusive' then
        new.tax_pkr := round(new.amount_pkr * v_rate, 2);
      else
        -- inclusive: the entered amount is gross; amount_pkr keeps the net
        new.tax_pkr    := round(new.amount_pkr - new.amount_pkr / (1 + v_rate), 2);
        new.amount_pkr := new.amount_pkr - new.tax_pkr;
      end if;
    else
      new.tax_pkr := 0;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.folio_items_prepare() from public, anon, authenticated;
create trigger prepare before insert on public.folio_items
  for each row execute function public.folio_items_prepare();

-- ------------------------------------------------ guard: immutable items ----
create or replace function public.folio_items_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status public.folio_status;
begin
  if tg_op = 'DELETE' then
    raise exception 'folio_items: items cannot be deleted — void them instead' using errcode = 'HD015';
  end if;
  select status into v_status from public.folios where id = old.folio_id;
  if v_status = 'closed' then
    raise exception 'folio_items: folio is closed' using errcode = 'HD007';
  end if;
  if (new.folio_id, new.kind, new.amount_pkr, new.tax_pkr, new.method, new.category, new.source,
      new.service_date, new.business_date, new.posted_at, new.posted_by, new.receipt_no,
      new.cash_shift_id, new.booking_room_id, new.reverses_item_id, new.tenant_id, new.property_id)
     is distinct from
     (old.folio_id, old.kind, old.amount_pkr, old.tax_pkr, old.method, old.category, old.source,
      old.service_date, old.business_date, old.posted_at, old.posted_by, old.receipt_no,
      old.cash_shift_id, old.booking_room_id, old.reverses_item_id, old.tenant_id, old.property_id) then
    raise exception 'folio_items: posted items are immutable — post a correction or void the item' using errcode = 'HD015';
  end if;
  if old.voided_at is not null
     and (new.voided_at, new.voided_by, new.void_reason) is distinct from (old.voided_at, old.voided_by, old.void_reason) then
    raise exception 'folio_items: item is already voided' using errcode = 'HD015';
  end if;
  return new;
end $$;
revoke execute on function public.folio_items_guard() from public, anon, authenticated;
create trigger guard before update or delete on public.folio_items
  for each row execute function public.folio_items_guard();

-- --------------------------------------------------------- folio numbers ----
create or replace function public.bookings_create_folio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.folios (booking_id, tenant_id, property_id, folio_no)
  values (new.id, new.tenant_id, new.property_id, public.next_doc_no(new.property_id, 'folio'));
  return null;
end $$;

do $$
declare r record;
begin
  for r in select f.id, f.property_id from public.folios f where f.folio_no is null order by f.created_at loop
    update public.folios set folio_no = public.next_doc_no(r.property_id, 'folio') where id = r.id;
  end loop;
end $$;

-- ------------------------------------------------------- corrections RPCs ----
-- Void an item (manager / owner / accounts; reason required; folio must be open).
create or replace function public.void_folio_item(p_item_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item   public.folio_items%rowtype;
  v_status public.folio_status;
  v_role   public.tenant_role;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'void_folio_item: a reason is required' using errcode = 'HD015';
  end if;
  select * into v_item from public.folio_items where id = p_item_id for update;
  if v_item.id is null then
    raise exception 'void_folio_item: item not found' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not public.is_platform_admin() then
    v_role := public.current_role_in_tenant();
    if v_item.tenant_id is distinct from public.current_tenant_id()
       or public.tenant_access_level() is distinct from 'full'
       or v_role is null or v_role not in ('owner', 'manager', 'accounts') then
      raise exception 'void_folio_item: not permitted' using errcode = '42501';
    end if;
  end if;
  select status into v_status from public.folios where id = v_item.folio_id for update;
  if v_status = 'closed' then
    raise exception 'void_folio_item: folio is closed — reopen it first' using errcode = 'HD007';
  end if;
  if v_item.voided_at is not null then
    raise exception 'void_folio_item: item is already voided' using errcode = 'HD015';
  end if;
  update public.folio_items
     set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
   where id = p_item_id;
end $$;

-- Reopen a closed folio for corrections (owner / manager; reason required).
create or replace function public.reopen_folio(p_folio_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_folio public.folios%rowtype;
  v_role  public.tenant_role;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reopen_folio: a reason is required' using errcode = 'HD015';
  end if;
  select * into v_folio from public.folios where id = p_folio_id for update;
  if v_folio.id is null then
    raise exception 'reopen_folio: folio not found' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not public.is_platform_admin() then
    v_role := public.current_role_in_tenant();
    if v_folio.tenant_id is distinct from public.current_tenant_id()
       or public.tenant_access_level() is distinct from 'full'
       or v_role is null or v_role not in ('owner', 'manager') then
      raise exception 'reopen_folio: not permitted' using errcode = '42501';
    end if;
  end if;
  if v_folio.status = 'open' then
    raise exception 'reopen_folio: folio is already open' using errcode = 'HD007';
  end if;
  update public.folios
     set status = 'open', closed_at = null, reopened_at = now(), reopened_by = auth.uid(), reopen_reason = trim(p_reason)
   where id = p_folio_id;
end $$;

-- Close a folio by hand (owner / manager / accounts); only a settled folio closes.
create or replace function public.close_folio(p_folio_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_folio public.folios%rowtype;
  v_role  public.tenant_role;
begin
  select * into v_folio from public.folios where id = p_folio_id for update;
  if v_folio.id is null then
    raise exception 'close_folio: folio not found' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not public.is_platform_admin() then
    v_role := public.current_role_in_tenant();
    if v_folio.tenant_id is distinct from public.current_tenant_id()
       or public.tenant_access_level() is distinct from 'full'
       or v_role is null or v_role not in ('owner', 'manager', 'accounts') then
      raise exception 'close_folio: not permitted' using errcode = '42501';
    end if;
  end if;
  if v_folio.status = 'closed' then
    raise exception 'close_folio: folio is already closed' using errcode = 'HD007';
  end if;
  if v_folio.balance > 0 then
    raise exception 'close_folio: balance due % must be settled first', v_folio.balance using errcode = 'HD001';
  elsif v_folio.balance < 0 then
    raise exception 'close_folio: credit of % must be refunded first', -v_folio.balance using errcode = 'HD002';
  end if;
  update public.folios set status = 'closed', closed_at = now() where id = p_folio_id;
end $$;

revoke execute on function public.void_folio_item(uuid, text) from public, anon;
revoke execute on function public.reopen_folio(uuid, text)    from public, anon;
revoke execute on function public.close_folio(uuid)           from public, anon;
grant  execute on function public.void_folio_item(uuid, text) to authenticated, service_role;
grant  execute on function public.reopen_folio(uuid, text)    to authenticated, service_role;
grant  execute on function public.close_folio(uuid)           to authenticated, service_role;

-- ------------------------------------------- privileges & policies ----
-- Folios: read-only for the API role (triggers and RPCs maintain them).
revoke insert, update, delete on public.folios from anon, authenticated;
drop policy if exists folios_write on public.folios;
-- Items: insert-only for cashier roles; no update/delete path at all.
revoke update, delete on public.folio_items from anon, authenticated;
drop policy if exists folio_items_write on public.folio_items;
create policy folio_items_insert on public.folio_items for insert to authenticated
  with check (
    (tenant_id = (select public.current_tenant_id())
     and (select public.tenant_access_level()) = 'full'
     and (select public.current_role_in_tenant()) in ('owner', 'manager', 'front_desk', 'accounts'))
    or (select public.is_platform_admin())
  );

-- ------------------------------------------------------------- indexes ----
create index if not exists folio_items_live_idx       on public.folio_items (folio_id) where voided_at is null;
create index if not exists folio_items_business_idx   on public.folio_items (property_id, business_date, kind);
create index if not exists folio_items_shift_idx      on public.folio_items (cash_shift_id) where cash_shift_id is not null;
create unique index if not exists folio_items_receipt_no_idx on public.folio_items (property_id, receipt_no) where receipt_no is not null;
create index if not exists folios_open_idx            on public.folios (property_id) where status = 'open';
create index if not exists folios_outstanding_idx     on public.folios (property_id, balance) where balance <> 0;
