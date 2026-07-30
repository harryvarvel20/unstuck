-- ------------------------------------------------------------------
-- ADHV — Phase Y1: user-chosen usernames on the Activity Center.
--
-- social_profiles.handle already exists (unique, historically auto-generated
-- as adjective_noun_number). This migration lets a person CHOOSE their name:
--   * handle_key         — normalised (NFKC + lowercased) uniqueness key, with
--                          a UNIQUE index so uniqueness is case-insensitive and
--                          race-safe at the database (we handle the conflict,
--                          never check-then-insert).
--   * handle_set         — false until the person has actively chosen a name.
--                          Existing accounts keep their auto-handle but must
--                          pick before they can post/comment (enforced server-
--                          side); backfilled to false so they're prompted once.
--   * handle_changed_at  — powers the 30-day change rate limit.
-- Plus a short-lived reservation table so a RELEASED handle can't be instantly
-- re-claimed by someone else and used for impersonation.
--
-- Idempotent (safe to re-run).
-- ------------------------------------------------------------------

alter table public.social_profiles
  add column if not exists handle_key        text,
  add column if not exists handle_set        boolean not null default false,
  add column if not exists handle_changed_at timestamptz;

-- Backfill the key from existing handles. Auto-handles are already lowercase,
-- so lower() is a no-op and can't collide; a chosen handle overwrites it later.
update public.social_profiles
  set handle_key = lower(handle)
  where handle_key is null;

alter table public.social_profiles
  alter column handle_key set not null;

-- Case-insensitive uniqueness, enforced + race-safe at the DB.
create unique index if not exists social_profiles_handle_key_uidx
  on public.social_profiles (handle_key);

-- Released-handle reservations (anti-impersonation cool-down). Service-role
-- only: RLS enabled with NO policy = the browser can never read or write it;
-- all access is through server routes using the service client.
create table if not exists public.handle_reservations (
  handle_key     text primary key,
  released_by    uuid references auth.users(id) on delete set null,
  reserved_until timestamptz not null
);
alter table public.handle_reservations enable row level security;
create index if not exists handle_reservations_until_idx
  on public.handle_reservations (reserved_until);
