-- ------------------------------------------------------------------
-- ADHV — Phase U: Activity Center
-- The RSD-safe social layer: friends, wins, playbooks, DMs, boosts,
-- collective challenges, accountability buddy.
-- Design law baked into the schema: no counts to chase, no rankings,
-- reverse-chronological only, silent unfriend, mute without rupture.
-- All access goes through server routes (service role + explicit
-- authorization); RLS locks tables to own-rows as defence in depth.
-- ------------------------------------------------------------------

-- === social profile ===============================================
create table if not exists public.social_profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  handle             text not null unique,
  display_name       text,
  default_visibility text not null default 'friends'
    check (default_visibility in ('private', 'friends', 'public')),
  anon_public        boolean not null default false,
  read_receipts      boolean not null default false,  -- OFF by default (RSD)
  allow_dms          boolean not null default true,
  quiet              boolean not null default false,  -- "quiet the social layer"
  adult_confirmed    boolean not null default false,  -- unknown age => safer defaults
  onboarded          boolean not null default false,
  created_at         timestamptz not null default now()
);
alter table public.social_profiles enable row level security;
drop policy if exists "socialprofiles_own" on public.social_profiles;
create policy "socialprofiles_own" on public.social_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- === friendships (mutual accept only; user_a < user_b) ============
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references auth.users(id) on delete cascade,
  user_b       uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  muted_by_a   boolean not null default false,
  muted_by_b   boolean not null default false,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_a_idx on public.friendships (user_a);
create index if not exists friendships_b_idx on public.friendships (user_b);
alter table public.friendships enable row level security;
drop policy if exists "friendships_own" on public.friendships;
create policy "friendships_own" on public.friendships
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- === posts (wins) =================================================
create table if not exists public.posts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  win_text              text not null,
  caption               text,
  tags                  text[] not null default '{}',
  photo_path            text,
  visibility            text not null default 'friends'
    check (visibility in ('private', 'friends', 'public')),
  anon                  boolean not null default false,
  comments_off          boolean not null default false,
  comments_friends_only boolean not null default true,
  -- playbook: { steps:[{title,minutes}], tool, time_taken, what_worked }
  playbook              jsonb,
  flagged               boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists posts_user_idx on public.posts (user_id, created_at desc);
create index if not exists posts_public_idx on public.posts (visibility, created_at desc);
alter table public.posts enable row level security;
drop policy if exists "posts_own" on public.posts;
create policy "posts_own" on public.posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- === reactions (one per person; shown as faces, never a score) ====
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('clap', 'heart', 'rocket', 'party')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_reactions enable row level security;
drop policy if exists "reactions_own" on public.post_reactions;
create policy "reactions_own" on public.post_reactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- === comments (bounded, kind) =====================================
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  flagged    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
drop policy if exists "comments_own" on public.post_comments;
create policy "comments_own" on public.post_comments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- === DMs (friends only; read receipts opt-in) =====================
create table if not exists public.dm_threads (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
alter table public.dm_threads enable row level security;
drop policy if exists "threads_participants" on public.dm_threads;
create policy "threads_participants" on public.dm_threads
  for select using (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.dm_threads(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at);
alter table public.dm_messages enable row level security;
drop policy if exists "dm_messages_own" on public.dm_messages;
create policy "dm_messages_own" on public.dm_messages
  for select using (auth.uid() = sender_id);

-- === boosts (private warm nudges; never public) ===================
create table if not exists public.boosts (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  message    text not null,
  seen       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists boosts_to_idx on public.boosts (to_user, created_at desc);
alter table public.boosts enable row level security;
drop policy if exists "boosts_own" on public.boosts;
create policy "boosts_own" on public.boosts
  for select using (auth.uid() = from_user or auth.uid() = to_user);

-- === struggle status (friends respond only with boosts) ===========
create table if not exists public.social_statuses (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  kind     text check (kind in ('slow_start', 'frozen')),
  audience text not null default 'friends' check (audience in ('friends', 'off')),
  set_at   timestamptz
);
alter table public.social_statuses enable row level security;
drop policy if exists "statuses_own" on public.social_statuses;
create policy "statuses_own" on public.social_statuses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- === collective challenges (never person-vs-person) ===============
create table if not exists public.challenges (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  code       text not null unique,
  target     integer not null default 20,
  ends_at    timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.challenges enable row level security;
drop policy if exists "challenges_read" on public.challenges;
create policy "challenges_read" on public.challenges
  for select using (auth.uid() = owner_id);

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenge_members enable row level security;
drop policy if exists "members_own" on public.challenge_members;
create policy "members_own" on public.challenge_members
  for select using (auth.uid() = user_id);

create table if not exists public.challenge_ticks (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists ticks_challenge_idx on public.challenge_ticks (challenge_id);
alter table public.challenge_ticks enable row level security;
drop policy if exists "ticks_own" on public.challenge_ticks;
create policy "ticks_own" on public.challenge_ticks
  for select using (auth.uid() = user_id);

-- === accountability buddy (one pair; silent unpair) ================
create table if not exists public.buddies (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references auth.users(id) on delete cascade,
  user_b       uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null,
  status       text not null default 'pending' check (status in ('pending', 'active')),
  created_at   timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
alter table public.buddies enable row level security;
drop policy if exists "buddies_own" on public.buddies;
create policy "buddies_own" on public.buddies
  for select using (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.buddy_checkins (
  id         uuid primary key default gen_random_uuid(),
  pair_id    uuid not null references public.buddies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  note       text not null,
  response   text,
  created_at timestamptz not null default now()
);
create index if not exists checkins_pair_idx on public.buddy_checkins (pair_id, created_at desc);
alter table public.buddy_checkins enable row level security;
drop policy if exists "checkins_own" on public.buddy_checkins;
create policy "checkins_own" on public.buddy_checkins
  for select using (auth.uid() = user_id);

-- === safety: blocks + reports =====================================
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "blocks_own" on public.blocks;
create policy "blocks_own" on public.blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  subject_type text not null check (subject_type in ('post', 'comment', 'dm', 'profile')),
  subject_id   text not null,
  reason       text,
  status       text not null default 'open' check (status in ('open', 'reviewed')),
  created_at   timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "reports_own" on public.reports;
create policy "reports_own" on public.reports
  for select using (auth.uid() = reporter_id);
