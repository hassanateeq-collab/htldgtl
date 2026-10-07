-- =============================================================================
-- Hotel Digital — insert defaults for trigger-filled columns (migration 18)
-- folio_items.business_date is always set by folio_items_prepare(); a default
-- makes the column optional in the generated client types so the app never has
-- to send a placeholder. Also drops the redundant admin INSERT policy on signup
-- requests (anon/authenticated inserts already cover it; advisor 0006).
-- =============================================================================
alter table public.folio_items alter column business_date set default current_date;
drop policy if exists platform_signup_requests_admin_insert on public.platform_signup_requests;
