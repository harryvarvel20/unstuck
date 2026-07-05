-- ------------------------------------------------------------------
-- ADHV — Phase R: Connection (strictly opt-in, streak-free)
-- People who matter + gentle rotating nudges. The app never sends anything.
-- ------------------------------------------------------------------

create table if not exists public.people (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  relationship   text,
  cadence_days   integer not null default 14,
  last_contacted timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists people_user_idx
  on public.people (user_id, created_at desc);

alter table public.people enable row level security;

drop policy if exists "people_select_own" on public.people;
create policy "people_select_own"
  on public.people for select using (auth.uid() = user_id);
drop policy if exists "people_insert_own" on public.people;
create policy "people_insert_own"
  on public.people for insert with check (auth.uid() = user_id);
drop policy if exists "people_update_own" on public.people;
create policy "people_update_own"
  on public.people for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "people_delete_own" on public.people;
create policy "people_delete_own"
  on public.people for delete using (auth.uid() = user_id);

-- Opt-in comfort-zone goal (null = not opted in).
alter table public.profiles
  add column if not exists connection_goal text;
