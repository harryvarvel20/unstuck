-- ------------------------------------------------------------------
-- Unstuck — Phase B schema
-- Time-Truth: per-step estimated vs actual durations, gathered from
-- focus sessions and (plausible) check-off gaps. Owner-only via RLS.
-- ------------------------------------------------------------------

create table if not exists public.step_completions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  task_id           uuid references public.tasks(id) on delete set null,
  step_index        integer,
  estimated_minutes integer not null,
  actual_minutes    numeric not null,
  source            text not null check (source in ('focus', 'checkoff')),
  created_at        timestamptz not null default now()
);

create index if not exists step_completions_user_created_idx
  on public.step_completions (user_id, created_at desc);

alter table public.step_completions enable row level security;

drop policy if exists "completions_select_own" on public.step_completions;
create policy "completions_select_own"
  on public.step_completions for select using (auth.uid() = user_id);

drop policy if exists "completions_insert_own" on public.step_completions;
create policy "completions_insert_own"
  on public.step_completions for insert with check (auth.uid() = user_id);
