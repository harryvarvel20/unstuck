-- ------------------------------------------------------------------
-- Unstuck — Phase 1 schema
-- Anonymous daily usage counter for the free-breakdown limit.
-- Raw IPs are never stored; we key on a salted SHA-256 hash.
-- ------------------------------------------------------------------

create table if not exists public.anon_usage (
  ip_hash    text not null,
  usage_date date not null default current_date,
  count      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ip_hash, usage_date)
);

-- Row Level Security ON. No policies for anon/authenticated => the table is
-- unreachable from the client. Only the service-role key (server-side) can
-- touch it, and it does so through the SECURITY DEFINER function below.
alter table public.anon_usage enable row level security;

-- Atomically check the daily limit and, if under it, increment.
-- Returns whether the request is allowed plus the resulting count.
create or replace function public.consume_anon_usage(
  p_ip_hash text,
  p_limit   integer
)
returns table(allowed boolean, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count into v_count
    from public.anon_usage
    where ip_hash = p_ip_hash and usage_date = current_date;
  v_count := coalesce(v_count, 0);

  if v_count >= p_limit then
    allowed := false;
    current_count := v_count;
    return next;
    return;
  end if;

  insert into public.anon_usage (ip_hash, usage_date, count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, usage_date)
  do update set count = public.anon_usage.count + 1,
                updated_at = now()
  returning count into v_count;

  allowed := true;
  current_count := v_count;
  return next;
end;
$$;

-- Lock the function down: only the service role may call it.
revoke all on function public.consume_anon_usage(text, integer) from public;
revoke all on function public.consume_anon_usage(text, integer) from anon;
revoke all on function public.consume_anon_usage(text, integer) from authenticated;
grant execute on function public.consume_anon_usage(text, integer) to service_role;
