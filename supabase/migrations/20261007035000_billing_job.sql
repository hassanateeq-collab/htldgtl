-- =============================================================================
-- Hotel Digital — billing job (migration 15)
-- The subscription state machine of ADR 0004, run daily at 06:00 PKT by
-- pg_cron. Idempotent: each run applies at most one transition per tenant and
-- records it in subscription_events. Payments (recorded by the operator) move
-- a tenant back to active in the admin console; this job only moves forward.
--   trialing  --trial_ends_at passed-->        past_due
--   active    --current_period_end passed-->   past_due
--   past_due  --grace_days elapsed-->          read_only
--   read_only --read_only_days elapsed-->      suspended
--   suspended --90 days-->                     cancelled
-- =============================================================================

create or replace function public.run_billing_transitions() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r        record;
  n        integer := 0;
  v_new    public.subscription_status;
  v_reason text;
  v_since  timestamptz;
  v_today  date := (now() at time zone 'Asia/Karachi')::date;
begin
  for r in select s.* from public.subscriptions s where s.status <> 'cancelled' loop
    v_new := null;
    select max(e.at) into v_since from public.subscription_events e
     where e.tenant_id = r.tenant_id and e.to_status = r.status;
    v_since := coalesce(v_since, r.updated_at);

    if r.status = 'trialing' and r.trial_ends_at is not null and r.trial_ends_at < now() then
      v_new := 'past_due'; v_reason := 'trial ended';
    elsif r.status = 'active' and r.current_period_end is not null and r.current_period_end < v_today then
      v_new := 'past_due'; v_reason := 'period ended';
    elsif r.status = 'past_due' and v_since + make_interval(days => r.grace_days) < now() then
      v_new := 'read_only'; v_reason := format('%s days past due', r.grace_days);
    elsif r.status = 'read_only' and v_since + make_interval(days => r.read_only_days) < now() then
      v_new := 'suspended'; v_reason := format('%s days read-only', r.read_only_days);
    elsif r.status = 'suspended' and coalesce(r.suspended_at, v_since) + interval '90 days' < now() then
      v_new := 'cancelled'; v_reason := '90 days suspended';
    end if;

    if v_new is not null then
      update public.subscriptions
         set status       = v_new,
             suspended_at = case when v_new = 'suspended' then now() else suspended_at end,
             cancelled_at = case when v_new = 'cancelled' then now() else cancelled_at end
       where tenant_id = r.tenant_id;
      insert into public.subscription_events (tenant_id, from_status, to_status, reason, actor)
      values (r.tenant_id, r.status, v_new, v_reason, 'billing_job');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.run_billing_transitions() from public, anon, authenticated;
grant  execute on function public.run_billing_transitions() to service_role;

create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'billing-transitions') then
    perform cron.unschedule('billing-transitions');
  end if;
  perform cron.schedule('billing-transitions', '0 1 * * *', 'select public.run_billing_transitions()');
end $$;
