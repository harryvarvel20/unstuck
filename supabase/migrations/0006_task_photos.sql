-- ------------------------------------------------------------------
-- ADHV — Phase H: photo-to-plan storage
-- Private bucket for task photos, each user confined to their own folder.
-- ------------------------------------------------------------------

-- Private bucket (not publicly readable).
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

-- Each user can only touch objects under a folder named with their user id:
--   task-photos/<auth.uid()>/<file>
drop policy if exists "task_photos_insert_own" on storage.objects;
create policy "task_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "task_photos_select_own" on storage.objects;
create policy "task_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "task_photos_delete_own" on storage.objects;
create policy "task_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Optional link from a task to the photo it came from.
alter table public.tasks
  add column if not exists photo_path text;
