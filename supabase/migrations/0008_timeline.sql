-- ------------------------------------------------------------------
-- ADHV — Phase J: timed day plan
-- Plans become editable (timeline check-offs, deadlines, reflows).
-- ------------------------------------------------------------------

drop policy if exists "plans_update_own" on public.plans;
create policy "plans_update_own"
  on public.plans for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "plans_delete_own" on public.plans;
create policy "plans_delete_own"
  on public.plans for delete using (auth.uid() = user_id);
