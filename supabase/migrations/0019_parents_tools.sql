-- ------------------------------------------------------------------
-- ADHV — Phase W (W4/W6): persistent Parents-Mode tools
-- Reward chart/token economy state + the parent's "wins about my kid" log.
-- All scoped under the parent (auth.uid()); child rows already RLS-locked.
-- ------------------------------------------------------------------

-- Reward chart / token economy — one row per child. Earning only; the app
-- never records loss. behaviours: up to 3 targets; rewards: the agreed menu.
create table if not exists public.kid_rewards (
  child_id   uuid primary key references public.children(id) on delete cascade,
  parent_id  uuid not null references auth.users(id) on delete cascade,
  behaviours text[] not null default '{}',
  rewards    text[] not null default '{}',
  tokens     integer not null default 0 check (tokens >= 0),
  updated_at timestamptz not null default now()
);
alter table public.kid_rewards enable row level security;
drop policy if exists "kid_rewards_own" on public.kid_rewards;
create policy "kid_rewards_own" on public.kid_rewards
  for all using (auth.uid() = parent_id) with check (auth.uid() = parent_id);

-- "Wins about my kid" — a warm, private counterweight log. Never failures.
create table if not exists public.kid_wins (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references auth.users(id) on delete cascade,
  child_id   uuid references public.children(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists kid_wins_parent_idx
  on public.kid_wins (parent_id, created_at desc);
alter table public.kid_wins enable row level security;
drop policy if exists "kid_wins_own" on public.kid_wins;
create policy "kid_wins_own" on public.kid_wins
  for all using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
