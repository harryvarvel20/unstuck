-- ------------------------------------------------------------------
-- ADHV — Phase Q: Focus Profile
-- Tiny signals ("did that pull you in?") + behavioural context build a
-- living picture of what reliably gets this brain into focus.
-- ------------------------------------------------------------------

create table if not exists public.focus_signals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null default 'focus',  -- focus | task
  pulled_in  boolean not null,
  title      text,
  hour       integer not null,
  created_at timestamptz not null default now()
);

create index if not exists focus_signals_user_idx
  on public.focus_signals (user_id, created_at desc);

alter table public.focus_signals enable row level security;

drop policy if exists "signals_select_own" on public.focus_signals;
create policy "signals_select_own"
  on public.focus_signals for select using (auth.uid() = user_id);
drop policy if exists "signals_insert_own" on public.focus_signals;
create policy "signals_insert_own"
  on public.focus_signals for insert with check (auth.uid() = user_id);

-- Cache the AI "what your brain runs on" summary on the profile.
alter table public.profiles
  add column if not exists focus_profile jsonb;
