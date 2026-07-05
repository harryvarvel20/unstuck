-- ------------------------------------------------------------------
-- ADHV — Phase P: Impulse Pause
-- Log an impulse, wait, decide. Pattern awareness, NOT financial advice.
-- ------------------------------------------------------------------

create table if not exists public.impulses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  what         text not null,
  category     text not null check (category in ('buy', 'say', 'commit', 'quit')),
  amount       numeric,                    -- optional £ for buys
  wait_until   timestamptz not null,
  -- outcome: null (waiting) | 'acted' | 'passed'
  outcome      text check (outcome in ('acted', 'passed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists impulses_user_idx
  on public.impulses (user_id, created_at desc);

alter table public.impulses enable row level security;

drop policy if exists "impulses_select_own" on public.impulses;
create policy "impulses_select_own"
  on public.impulses for select using (auth.uid() = user_id);
drop policy if exists "impulses_insert_own" on public.impulses;
create policy "impulses_insert_own"
  on public.impulses for insert with check (auth.uid() = user_id);
drop policy if exists "impulses_update_own" on public.impulses;
create policy "impulses_update_own"
  on public.impulses for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "impulses_delete_own" on public.impulses;
create policy "impulses_delete_own"
  on public.impulses for delete using (auth.uid() = user_id);
