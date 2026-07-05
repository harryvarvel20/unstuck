-- ------------------------------------------------------------------
-- ADHV — Phase K: routine builder
-- Resilient routines (morning/evening/work-startup/leaving) that compress
-- to a minimum viable version instead of breaking when you start late.
-- ------------------------------------------------------------------

create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null default 'custom',
  -- steps: [{ title, minutes, skippable(bool) }]
  steps      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routines_user_idx
  on public.routines (user_id, created_at desc);

alter table public.routines enable row level security;

drop policy if exists "routines_select_own" on public.routines;
create policy "routines_select_own"
  on public.routines for select using (auth.uid() = user_id);

drop policy if exists "routines_insert_own" on public.routines;
create policy "routines_insert_own"
  on public.routines for insert with check (auth.uid() = user_id);

drop policy if exists "routines_update_own" on public.routines;
create policy "routines_update_own"
  on public.routines for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routines_delete_own" on public.routines;
create policy "routines_delete_own"
  on public.routines for delete using (auth.uid() = user_id);
