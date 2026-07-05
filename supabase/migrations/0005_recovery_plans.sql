-- ------------------------------------------------------------------
-- Unstuck — Phase D schema
-- Guilt-free amnesty (archiving) for tasks + saved morning plans.
-- ------------------------------------------------------------------

-- Amnesty: archived tasks disappear from lists but stay recoverable.
alter table public.tasks
  add column if not exists archived_at timestamptz;

-- Morning brain-dump plans.
create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  plan_date  date not null default current_date,
  today      jsonb not null default '[]'::jsonb,
  captured   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists plans_user_date_idx
  on public.plans (user_id, plan_date desc);

alter table public.plans enable row level security;

drop policy if exists "plans_select_own" on public.plans;
create policy "plans_select_own"
  on public.plans for select using (auth.uid() = user_id);

drop policy if exists "plans_insert_own" on public.plans;
create policy "plans_insert_own"
  on public.plans for insert with check (auth.uid() = user_id);
