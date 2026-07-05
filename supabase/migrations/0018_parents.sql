-- ------------------------------------------------------------------
-- ADHV — Phase W1: Parents Mode (placement, onboarding, children)
-- Minimal, opt-in child data stored under the PARENT's row only, RLS-locked.
-- No child login, no child profiling — shared-screen on the parent's device.
-- UK Children's Code posture: data minimisation, everything deletable.
-- ------------------------------------------------------------------

-- Opt-in flag on the parent's profile.
alter table public.profiles
  add column if not exists parents_mode boolean not null default false;

-- Children a parent supports. Only what the parent chooses to enter:
-- first name (optional) + age band (required, drives all adaptivity) +
-- an optional note on what's hardest right now.
create table if not exists public.children (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references auth.users(id) on delete cascade,
  name       text,
  age_band   text not null check (age_band in ('4-7', '8-12', '13-17')),
  hardest    text,
  created_at timestamptz not null default now()
);
create index if not exists children_parent_idx
  on public.children (parent_id, created_at);

alter table public.children enable row level security;
drop policy if exists "children_own" on public.children;
create policy "children_own" on public.children
  for all using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
