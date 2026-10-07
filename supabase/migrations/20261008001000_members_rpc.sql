-- =============================================================================
-- Hotel Digital — tenant members RPC (migration 17, Release B)
-- Staff of the active tenant with their sign-in email, for the Staff settings
-- screen, "posted by" labels on folios and the booking activity trail.
-- Visible to any live member of the tenant (colleagues of one hotel).
-- =============================================================================
create or replace function public.tenant_members()
returns table (membership_id uuid, user_id uuid, role public.tenant_role, email text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.user_id, m.role, u.email::text, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = public.current_tenant_id()
    and (public.current_role_in_tenant() is not null or public.is_platform_admin())
  order by m.role, u.email
$$;
revoke execute on function public.tenant_members() from public, anon;
grant  execute on function public.tenant_members() to authenticated, service_role;
