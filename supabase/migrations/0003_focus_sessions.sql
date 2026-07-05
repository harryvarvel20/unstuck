-- ------------------------------------------------------------------
-- Unstuck — Phase A schema
-- Focus sessions (the AI body double) + a generic per-day feature
-- counter used for focus-session limits (and future features).
-- ------------------------------------------------------------------

-- === focus_sessions ===============================================
create table if not exists public.focus_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  task_id           uuid references public.tasks(id) on delete set null,
  step_index        integer,
  step_title        text not null,
  planned_minutes   integer not null,
  estimated_minutes integer,
  actual_minutes    numeric,
  completed         boolean not null default false,
  struggled         boolean not null default false,
  created_at        timestamptz not null default now(),
  ended_at          timestamptz
);

create index if not exists focus_sessions_user_created_idx
  on public.focus_sessions (user_id, created_at desc);

alter table public.focus_sessions enable row level security;

drop policy if exists "focus_select_own" on public.focus_sessions;
create policy "focus_select_own"
  on public.focus_sessions for select using (auth.uid() = user_id);

drop policy if exists "focus_insert_own" on public.focus_sessions;
create policy "focus_insert_own"
  on public.focus_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "focus_update_own" on public.focus_sessions;
create policy "focus_update_own"
  on public.focus_sessions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- === feature_usage (generic daily counters) =======================
-- subject is "user:<uuid>" or "ip:<hash>"; feature e.g. 'focus', 'ai_light'.
create table if not exists public.feature_usage (
  subject    text not null,
  feature    text not null,
  usage_date date not null default current_date,
  count      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (subject, feature, usage_date)
);

alter table public.feature_usage enable row level security;
-- No policies: reachable only via the SECURITY DEFINER function below.

create or replace function public.consume_feature_usage(
  p_subject text,
  p_feature text,
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
    from public.feature_usage
    where subject = p_subject and feature = p_feature
      and usage_date = current_date;
  v_count := coalesce(v_count, 0);

  if v_count >= p_limit then
    allowed := false;
    current_count := v_count;
    return next;
    return;
  end if;

  insert into public.feature_usage (subject, feature, usage_date, count)
  values (p_subject, p_feature, current_date, 1)
  on conflict (subject, feature, usage_date)
  do update set count = public.feature_usage.count + 1,
                updated_at = now()
  returning count into v_count;

  allowed := true;
  current_count := v_count;
  return next;
end;
$$;

revoke all on function public.consume_feature_usage(text, text, integer) from public;
revoke all on function public.consume_feature_usage(text, text, integer) from anon;
revoke all on function public.consume_feature_usage(text, text, integer) from authenticated;
grant execute on function public.consume_feature_usage(text, text, integer) to service_role;
