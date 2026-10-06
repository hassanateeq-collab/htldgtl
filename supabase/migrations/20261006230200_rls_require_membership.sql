-- =============================================================================
-- Hotel Digital — harden tenant reads (migration 3)
-- Defense in depth: reading tenant data now also requires a live membership in
-- the active tenant (current_role_in_tenant() is not null), not just the JWT
-- claim. Closes the window where a revoked member still holds an unexpired
-- token, or a mis-set active_tenant claim. Writes already required membership.
-- Also lets a signed-in user read the tenants they belong to (tenant picker)
-- before an active tenant is chosen.
-- =============================================================================

drop policy tenants_read on public.tenants;
create policy tenants_read on public.tenants for select to authenticated
  using ((id = public.current_tenant_id() and public.current_role_in_tenant() is not null)
      or exists (select 1 from public.memberships m where m.tenant_id = tenants.id and m.user_id = auth.uid())
      or public.is_platform_admin());

drop policy memberships_read on public.memberships;
create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid()
      or (tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null)
      or public.is_platform_admin());

drop policy properties_read on public.properties;
create policy properties_read on public.properties for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy subscription_events_read on public.subscription_events;
create policy subscription_events_read on public.subscription_events for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy tenant_feature_overrides_read on public.tenant_feature_overrides;
create policy tenant_feature_overrides_read on public.tenant_feature_overrides for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy invoice_items_read on public.invoice_items;
create policy invoice_items_read on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i
                 where i.id = invoice_id
                   and ((i.tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
                         and public.current_role_in_tenant() is not null)
                        or public.is_platform_admin())));

drop policy payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy tenant_settings_read on public.tenant_settings;
create policy tenant_settings_read on public.tenant_settings for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy tenant_branding_read on public.tenant_branding;
create policy tenant_branding_read on public.tenant_branding for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy custom_field_definitions_read on public.custom_field_definitions;
create policy custom_field_definitions_read on public.custom_field_definitions for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy message_templates_read on public.message_templates;
create policy message_templates_read on public.message_templates for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

drop policy document_templates_read on public.document_templates;
create policy document_templates_read on public.document_templates for select to authenticated
  using ((tenant_id = public.current_tenant_id() and public.tenant_access_level() <> 'none'
          and public.current_role_in_tenant() is not null) or public.is_platform_admin());

-- audit_log_read already requires a role (owner/manager/accounts) — unchanged.
