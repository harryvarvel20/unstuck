-- ------------------------------------------------------------------
-- ADHV — AA4: enforce the retention schedule we already promise.
--
-- The Privacy Policy tells users "anonymous usage counters roll off after
-- 30 days" and "moderation reports [are kept] for up to 12 months", and
-- legal/RETENTION-AND-BREACH.md states rate-limit counters including hashed
-- IPs "roll off automatically".
--
-- None of that was true. No scheduled job, TTL or trigger existed anywhere
-- in the schema, so every one of those rows persisted indefinitely. That is
-- both a storage-limitation problem (Art. 5(1)(e) UK GDPR) and — more
-- seriously — an inaccurate statement in a published privacy notice.
--
-- This migration adds the function; the daily Vercel cron at
-- /api/cron/purge invokes it. Deletes are idempotent by construction: a
-- second run in the same day simply finds nothing left to remove, which
-- matters because Vercel cron delivery is best-effort and may double-fire.
-- ------------------------------------------------------------------

-- Each purge filters on a date/timestamp column that is not the leading
-- column of its primary key, so without these it would seq-scan.
create index if not exists anon_usage_date_idx
  on public.anon_usage (usage_date);
create index if not exists usage_log_date_idx
  on public.usage_log (usage_date);
create index if not exists feature_usage_date_idx
  on public.feature_usage (usage_date);
create index if not exists reports_created_at_idx
  on public.reports (created_at);

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_usage    integer;
  v_usage_log     integer;
  v_feature_usage integer;
  v_reports       integer;
  v_reservations  integer;
  v_stale_open    integer;
begin
  -- Rate-limit counters: "≤30 days" per the retention schedule.
  -- anon_usage rows are keyed on a salted hash of an IP address, so this is
  -- the most privacy-sensitive of the three.
  delete from public.anon_usage where usage_date < current_date - 30;
  get diagnostics v_anon_usage = row_count;

  delete from public.usage_log where usage_date < current_date - 30;
  get diagnostics v_usage_log = row_count;

  delete from public.feature_usage where usage_date < current_date - 30;
  get diagnostics v_feature_usage = row_count;

  -- Moderation reports: "up to 12 months". Only resolved ones are removed.
  -- An OPEN report is outstanding safeguarding work and must not be deleted
  -- on a timer — but one that has sat open for a year is itself a problem,
  -- so it is counted and returned rather than silently ignored.
  delete from public.reports
    where status = 'reviewed'
      and created_at < now() - interval '12 months';
  get diagnostics v_reports = row_count;

  select count(*) into v_stale_open
    from public.reports
    where status = 'open'
      and created_at < now() - interval '12 months';

  -- Expired username reservations serve no purpose once elapsed, and they
  -- hold a user reference.
  delete from public.handle_reservations where reserved_until < now();
  get diagnostics v_reservations = row_count;

  return jsonb_build_object(
    'anon_usage',            v_anon_usage,
    'usage_log',             v_usage_log,
    'feature_usage',         v_feature_usage,
    'reports_reviewed',      v_reports,
    'handle_reservations',   v_reservations,
    'reports_open_over_12m', v_stale_open
  );
end;
$$;

-- Service role only: this deletes data and must never be reachable from a
-- browser session.
revoke all on function public.purge_expired_data() from public;
revoke all on function public.purge_expired_data() from anon;
revoke all on function public.purge_expired_data() from authenticated;
grant execute on function public.purge_expired_data() to service_role;
