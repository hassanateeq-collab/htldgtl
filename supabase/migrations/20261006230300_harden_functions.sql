-- =============================================================================
-- Hotel Digital — harden functions (migration 4)
-- Follow-ups from the Supabase security advisor (2026-10-06):
--  1) pin search_path on the two functions that lacked it;
--  2) SECURITY DEFINER functions are not callable by anon, and trigger
--     functions are not callable via RPC at all (triggers fire regardless of
--     EXECUTE). RLS helpers stay executable by `authenticated` because policy
--     expressions run as the querying role; service_role keeps access for
--     edge functions. provision_tenant self-gates to platform admins.
-- =============================================================================

alter function public.set_updated_at()    set search_path = public;
alter function public.current_tenant_id() set search_path = public;

-- trigger functions: never via RPC
revoke execute on function public.audit_row()      from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- RLS helpers and intended RPCs: signed-in users and edge functions only
revoke execute on function public.current_tenant_id()      from public, anon;
revoke execute on function public.is_platform_admin()      from public, anon;
revoke execute on function public.current_role_in_tenant() from public, anon;
revoke execute on function public.tenant_access_level()    from public, anon;
revoke execute on function public.tenant_has_feature(text) from public, anon;
revoke execute on function public.my_tenant_access()       from public, anon;
revoke execute on function public.provision_tenant(text, text, text, text, text, uuid) from public, anon;

grant execute on function public.current_tenant_id()      to authenticated, service_role;
grant execute on function public.is_platform_admin()      to authenticated, service_role;
grant execute on function public.current_role_in_tenant() to authenticated, service_role;
grant execute on function public.tenant_access_level()    to authenticated, service_role;
grant execute on function public.tenant_has_feature(text) to authenticated, service_role;
grant execute on function public.my_tenant_access()       to authenticated, service_role;
grant execute on function public.provision_tenant(text, text, text, text, text, uuid) to authenticated, service_role;
