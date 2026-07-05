-- ------------------------------------------------------------------
-- ADHV — Phase L: Regulate hub
-- A private journal (park-it / drafts-never-sent) and a light usage log so
-- the app can gently suggest a human when emotional tools are used heavily.
-- Emotional flows are bounded — no companion chat, always end in one action.
-- ------------------------------------------------------------------

create table if not exists public.journal (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'note',  -- note | parked | draft
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists journal_user_idx
  on public.journal (user_id, created_at desc);

alter table public.journal enable row level security;

drop policy if exists "journal_select_own" on public.journal;
create policy "journal_select_own"
  on public.journal for select using (auth.uid() = user_id);
drop policy if exists "journal_insert_own" on public.journal;
create policy "journal_insert_own"
  on public.journal for insert with check (auth.uid() = user_id);
drop policy if exists "journal_delete_own" on public.journal;
create policy "journal_delete_own"
  on public.journal for delete using (auth.uid() = user_id);

create table if not exists public.regulate_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tool       text not null,  -- cooldown | decompress | spiral
  created_at timestamptz not null default now()
);

create index if not exists regulate_log_user_idx
  on public.regulate_log (user_id, created_at desc);

alter table public.regulate_log enable row level security;

drop policy if exists "regulate_select_own" on public.regulate_log;
create policy "regulate_select_own"
  on public.regulate_log for select using (auth.uid() = user_id);
drop policy if exists "regulate_insert_own" on public.regulate_log;
create policy "regulate_insert_own"
  on public.regulate_log for insert with check (auth.uid() = user_id);
