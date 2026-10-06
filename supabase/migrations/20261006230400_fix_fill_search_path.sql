-- =============================================================================
-- Hotel Digital — pin search_path on fill triggers (migration 5)
-- Advisor follow-up: the three BEFORE-INSERT fill triggers added in migration 2
-- lacked a pinned search_path (lint 0011). Everything else is already pinned.
--
-- Accepted advisor warnings (lint 0029, intentional): current_role_in_tenant,
-- is_platform_admin, tenant_access_level, tenant_has_feature, my_tenant_access
-- and provision_tenant are SECURITY DEFINER and executable by `authenticated`.
-- RLS policy expressions run as the querying role, so the helpers must be
-- callable; they only reveal the caller's own role/access/features, and
-- provision_tenant raises unless the caller is a platform admin.
-- =============================================================================

alter function public.booking_rooms_fill() set search_path = public;
alter function public.folios_fill()        set search_path = public;
alter function public.folio_items_fill()   set search_path = public;
