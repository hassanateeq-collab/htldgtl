-- =============================================================================
-- Hotel Digital — active tenant switching (migration 6)
-- Tenant switching without an edge function: a SECURITY DEFINER RPC verifies the
-- caller's membership and writes app_metadata.active_tenant on the caller's OWN
-- auth.users row. The client then refreshes its session to mint a JWT carrying
-- the claim, which current_tenant_id() reads in every policy. RLS additionally
-- requires a live membership (migration 3), so a stale claim can never grant
-- access on its own.
-- =============================================================================

create or replace function public.set_active_tenant(p_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then
    raise exception 'set_active_tenant: not signed in';
  end if;

  select t.id into v_tenant
  from public.tenants t
  join public.memberships m on m.tenant_id = t.id and m.user_id = auth.uid()
  where t.slug = p_slug and t.is_active;

  if v_tenant is null then
    raise exception 'set_active_tenant: no membership for %', p_slug;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('active_tenant', v_tenant),
         updated_at = now()
   where id = auth.uid();

  return v_tenant;
end $$;
revoke execute on function public.set_active_tenant(text) from public, anon;
grant  execute on function public.set_active_tenant(text) to authenticated, service_role;

-- Tenants the caller belongs to, for the picker and login (works before an
-- active tenant exists).
create or replace function public.my_memberships()
returns table (tenant_id uuid, slug text, name text, role public.tenant_role)
language sql stable security definer set search_path = public as $$
  select t.id, t.slug, t.name, m.role
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid() and t.is_active
  order by t.name
$$;
revoke execute on function public.my_memberships() from public, anon;
grant  execute on function public.my_memberships() to authenticated, service_role;
