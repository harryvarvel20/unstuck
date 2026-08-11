-- ------------------------------------------------------------------
-- ADHV — AA8: passive visibility of AI call volume.
--
-- `consumeFeature` returns early for Pro users ("Pro users skip counting"),
-- so daily quota rows do not exist for them. But `checkBurst` DOES run for
-- every caller, Pro included, and writes to feature_usage under a
-- minute-bucketed key ('burst:<name>:<minute>'). The telemetry we need has
-- therefore been accumulating all along — nothing has ever read it.
--
-- This matters commercially: Pro is sold as unlimited breakdowns, bounded
-- only by BURST.breakdown = 8/min. Sustained, that is ~11,520 calls/day from
-- a single £7.99 subscription. Without a number in front of you, the first
-- signal of abuse would be a Google Cloud invoice.
--
-- ⚠️ DELIBERATELY RETURNS NO IDENTIFIERS. `subject` holds 'user:<uuid>' or
-- 'ip:<hash>' — both pseudonymous personal data. This function is called by
-- the daily cron and its output goes to Vercel's runtime logs, and
-- legal/ROPA.md states those logs contain no PII. Returning aggregates only
-- keeps that statement true. If a figure here looks wrong, identify the
-- subject with an ad-hoc query (see reports/INFRA-REPORT.md, AA8) rather
-- than by widening this function.
-- ------------------------------------------------------------------

create or replace function public.ai_usage_report(p_days integer default 1)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with per_subject as (
    select subject, sum(count)::bigint as calls
      from public.feature_usage
     where usage_date > current_date - greatest(p_days, 1)
       and feature like 'burst:%'
     group by subject
  )
  select jsonb_build_object(
    'window_days',              greatest(p_days, 1),
    'total_ai_calls',           coalesce((select sum(calls) from per_subject), 0),
    'distinct_subjects',        (select count(*) from per_subject),
    'max_calls_one_subject',    coalesce((select max(calls) from per_subject), 0),
    'subjects_over_200_calls',  (select count(*) from per_subject where calls > 200)
  );
$$;

revoke all on function public.ai_usage_report(integer) from public;
revoke all on function public.ai_usage_report(integer) from anon;
revoke all on function public.ai_usage_report(integer) from authenticated;
grant execute on function public.ai_usage_report(integer) to service_role;
