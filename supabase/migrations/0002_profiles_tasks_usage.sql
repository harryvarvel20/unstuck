-- ------------------------------------------------------------------
-- Unstuck — Phase 2 schema
-- Accounts (profiles), saved tasks, and per-user daily usage.
-- Every table has RLS on; users can only ever touch their own rows.
-- ------------------------------------------------------------------

-- === profiles =====================================================
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  plan               text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  created_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- No insert/delete policies: profiles are created by the trigger below
-- (SECURITY DEFINER) and cleaned up via auth.users cascade.

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- === tasks ========================================================
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  input_text      text not null,
  steps           jsonb not null default '[]'::jsonb,
  completed_steps jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists tasks_user_created_idx
  on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
  on public.tasks for select using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
  on public.tasks for insert with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
  on public.tasks for delete using (auth.uid() = user_id);

-- === usage_log (per-user daily limit) =============================
create table if not exists public.usage_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  count      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.usage_log enable row level security;

drop policy if exists "usage_select_own" on public.usage_log;
create policy "usage_select_own"
  on public.usage_log for select using (auth.uid() = user_id);
-- Writes only through the SECURITY DEFINER function below.

-- Atomically check + increment a signed-in user's daily usage.
create or replace function public.consume_user_usage(
  p_user_id uuid,
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
    from public.usage_log
    where user_id = p_user_id and usage_date = current_date;
  v_count := coalesce(v_count, 0);

  if v_count >= p_limit then
    allowed := false;
    current_count := v_count;
    return next;
    return;
  end if;

  insert into public.usage_log (user_id, usage_date, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set count = public.usage_log.count + 1,
                updated_at = now()
  returning count into v_count;

  allowed := true;
  current_count := v_count;
  return next;
end;
$$;

revoke all on function public.consume_user_usage(uuid, integer) from public;
revoke all on function public.consume_user_usage(uuid, integer) from anon;
revoke all on function public.consume_user_usage(uuid, integer) from authenticated;
grant execute on function public.consume_user_usage(uuid, integer) to service_role;
