-- ------------------------------------------------------------------
-- ADHV — Phase O: Idea Vault
-- Capture-in-2-taps ideas; AI develops them on demand. Parked = seed.
-- ------------------------------------------------------------------

create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  -- developed: { summary, why, hard_parts[], steps[], google[], cost_time } | null
  developed   jsonb,
  status      text not null default 'seed' check (status in ('seed', 'developing', 'active', 'done')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ideas_user_idx
  on public.ideas (user_id, created_at desc);

alter table public.ideas enable row level security;

drop policy if exists "ideas_select_own" on public.ideas;
create policy "ideas_select_own"
  on public.ideas for select using (auth.uid() = user_id);
drop policy if exists "ideas_insert_own" on public.ideas;
create policy "ideas_insert_own"
  on public.ideas for insert with check (auth.uid() = user_id);
drop policy if exists "ideas_update_own" on public.ideas;
create policy "ideas_update_own"
  on public.ideas for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ideas_delete_own" on public.ideas;
create policy "ideas_delete_own"
  on public.ideas for delete using (auth.uid() = user_id);
