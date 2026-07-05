-- ------------------------------------------------------------------
-- ADHV — Phase I: day edges
-- Wind-down plans (tomorrow's dump + one tiny first action + wins note).
-- ------------------------------------------------------------------

alter table public.plans
  add column if not exists kind text not null default 'morning'
    check (kind in ('morning', 'winddown'));

alter table public.plans
  add column if not exists wins_note text;
