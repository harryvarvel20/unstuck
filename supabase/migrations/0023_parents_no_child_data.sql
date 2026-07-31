-- ------------------------------------------------------------------
-- ADHV — Parents Mode holds NO children's data on the server.
--
-- The child list, reward charts, and "wins about my kid" log now live ONLY on
-- the parent's device (localStorage — see src/lib/parentsLocal.ts). We drop the
-- server-side tables so there is no capability to store, disclose, or lose any
-- children's personal data. The parent's own profiles.parents_mode flag (which
-- is parent data, not child data) stays.
--
-- These tables came from 0018 (children) and 0019 (kid_rewards, kid_wins).
-- CASCADE removes their policies/indexes; IF EXISTS keeps this idempotent.
-- ------------------------------------------------------------------

drop table if exists public.kid_wins cascade;
drop table if exists public.kid_rewards cascade;
drop table if exists public.children cascade;
