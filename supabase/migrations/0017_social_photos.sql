-- ------------------------------------------------------------------
-- ADHV — Phase U+: photos in the Activity Center
-- A private bucket for social photos (wins, DMs, group-challenge moments),
-- each user confined to their own folder. Serving is done via short-lived
-- SIGNED URLs generated server-side only for viewers who are authorised to
-- see the surrounding post/message/challenge — the bucket itself is never
-- public, so a "friends" win's photo can't leak by URL.
-- ------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('social-photos', 'social-photos', false)
on conflict (id) do nothing;

-- Owner-folder confinement: social-photos/<auth.uid()>/<file>
drop policy if exists "social_photos_insert_own" on storage.objects;
create policy "social_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'social-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "social_photos_select_own" on storage.objects;
create policy "social_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'social-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "social_photos_delete_own" on storage.objects;
create policy "social_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'social-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- posts.photo_path already exists (migration 0016). Add the same to
-- direct messages and to group-challenge check-ins (the "group activity"
-- photo moments).
alter table public.dm_messages
  add column if not exists photo_path text;

alter table public.challenge_ticks
  add column if not exists photo_path text;
alter table public.challenge_ticks
  add column if not exists caption text;
