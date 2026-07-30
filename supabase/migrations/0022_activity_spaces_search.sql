-- ------------------------------------------------------------------
-- ADHV — Phase Y4/Y5/Y6: Activity Center spaces, everyone's wins, and search.
--
--  Y4  posts.space ('main' | 'parents') — parent posts never mix with the main
--      wins feed, and vice versa.
--  Y5  a weighted full-text search document (+ pg_trgm fuzzy) over win text,
--      caption, playbook "what worked"/tool, and tags; plus an RLS-respecting
--      ranked search function.
--  Y6  a (space, visibility, created_at) index so the Friends/Public/Just-me
--      feed scopes stay index-served.
--
-- Access model matches the rest of the social layer: reads go through the
-- service role in API routes with EXPLICIT visibility filters; RLS on the base
-- table stays own-rows-only as defence in depth. The search function is
-- SECURITY DEFINER and callable ONLY by the service role, so a client can never
-- forge the friend/blocked sets to leak private or friends-only rows.
--
-- Idempotent (safe to re-run).
-- ------------------------------------------------------------------

-- Y4: which space a post belongs to.
alter table public.posts
  add column if not exists space text not null default 'main'
    check (space in ('main', 'parents'));

-- Y6: feed scope + space lookups stay index-served.
create index if not exists posts_space_vis_idx
  on public.posts (space, visibility, created_at desc);

-- Y5: weighted FTS document (win > caption/what-worked > tool/tags).
-- to_tsvector(regconfig, text) is IMMUTABLE, so this generated column is valid.
alter table public.posts
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(win_text, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(caption, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(playbook ->> 'whatWorked', '')), 'B') ||
    setweight(to_tsvector('english', coalesce(playbook ->> 'tool', '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) stored;
create index if not exists posts_search_idx on public.posts using gin (search_doc);

-- Trigram (typo/fuzzy tolerance) on the two most-searched free-text fields.
create extension if not exists pg_trgm;
create index if not exists posts_wintext_trgm_idx
  on public.posts using gin (win_text gin_trgm_ops);
create index if not exists posts_caption_trgm_idx
  on public.posts using gin (caption gin_trgm_ops);

-- Y5: RLS-respecting, ranked search. The caller (service role) passes the
-- viewer's friend + blocked sets; visibility is enforced HERE, in the query.
create or replace function public.search_posts(
  p_viewer  uuid,
  p_friends uuid[],
  p_blocked uuid[],
  p_query   text,
  p_space   text,
  p_limit   int default 30
)
returns setof public.posts
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.posts p
  where p.space = p_space
    and p.flagged = false
    and not (p.user_id = any (p_blocked))
    and (
      p.search_doc @@ websearch_to_tsquery('english', p_query)
      or p.win_text % p_query
      or p.caption % p_query
    )
    and (
      p.user_id = p_viewer
      or p.visibility = 'public'
      or (p.visibility = 'friends' and p.user_id = any (p_friends))
    )
  order by
    ts_rank(p.search_doc, websearch_to_tsquery('english', p_query))
      + similarity(p.win_text, p_query) desc,
    p.created_at desc
  limit p_limit
$$;

-- Lock the function down: server-side (service role) only, never the browser.
revoke all on function
  public.search_posts(uuid, uuid[], uuid[], text, text, int)
  from public, anon, authenticated;
grant execute on function
  public.search_posts(uuid, uuid[], uuid[], text, text, int)
  to service_role;
