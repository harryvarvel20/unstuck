-- ------------------------------------------------------------------
-- ADHV — Phase M: dopamine menu (dopamenu)
-- One living menu per user. Items rotate as picks tune the list.
-- ------------------------------------------------------------------

create table if not exists public.dopamenu (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- items: [{ id, course, text, minutes, shows, picks }]
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dopamenu enable row level security;

drop policy if exists "dopamenu_select_own" on public.dopamenu;
create policy "dopamenu_select_own"
  on public.dopamenu for select using (auth.uid() = user_id);
drop policy if exists "dopamenu_insert_own" on public.dopamenu;
create policy "dopamenu_insert_own"
  on public.dopamenu for insert with check (auth.uid() = user_id);
drop policy if exists "dopamenu_update_own" on public.dopamenu;
create policy "dopamenu_update_own"
  on public.dopamenu for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
