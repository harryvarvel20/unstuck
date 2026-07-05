-- ------------------------------------------------------------------
-- ADHV — Phase X2: index coverage for secondary lookup columns.
-- All additive + idempotent; safe to run any time. These cover query
-- patterns found in the X2 audit that only had partial/leading-column
-- index coverage. No behavioural change — pure performance-at-scale.
-- ------------------------------------------------------------------

-- challenge_members is filtered by user_id alone (challenges GET "my
-- challenges"), but the only index is the composite PK (challenge_id,
-- user_id) which leads with challenge_id — useless for a user_id-only scan.
create index if not exists challenge_members_user_idx
  on public.challenge_members (user_id);

-- challenge_ticks per-day check filters (challenge_id, user_id, created_at);
-- existing index is challenge_id only.
create index if not exists challenge_ticks_cu_idx
  on public.challenge_ticks (challenge_id, user_id, created_at desc);

-- dm_threads is looked up by .or(user_a, user_b); the unique constraint
-- leads with user_a, so user_b-side lookups are unindexed.
create index if not exists dm_threads_user_b_idx
  on public.dm_threads (user_b);

-- blocks is checked by .or(blocker_id, blocked_id); PK leads with
-- blocker_id, leaving blocked_id-side lookups unindexed.
create index if not exists blocks_blocked_idx
  on public.blocks (blocked_id);

-- reports is now aggregated by (subject_type, subject_id) for the
-- distinct-reporter auto-hide threshold (X1 fix) — index it as it grows.
create index if not exists reports_subject_idx
  on public.reports (subject_type, subject_id);

-- boosts flood-guard + per-friend count filters (from_user, to_user).
create index if not exists boosts_from_to_idx
  on public.boosts (from_user, to_user, created_at desc);
