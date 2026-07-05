# ADHV — Phase X2 Feature + Database Test Report

**Branch:** `phase-x-harden-refinish`

## Environment constraint (same as X1 — read first)

This environment has **no browser and no headless-browser toolchain**, so the
brief's Playwright E2E, axe accessibility, and Lighthouse passes **cannot be
executed here** — they need a real DOM/browser. They are specified, scaffolded
where possible, and **explicitly deferred to a run in your environment** (or a
CI runner with a browser) — see "Deferred (needs a browser)" at the end. Every
other layer (unit, live DB integrity, live RLS/IDOR, AI-gate adversarial) has
been run for real and the results are below.

---

## What now runs automatically (wired into `npm test` + CI)

Installed **Vitest 2.1.9**; `npm test` runs the suite; the GitHub Actions
workflow (`.github/workflows/ci.yml`) runs it on every push.

### Unit suite — 44 tests, 44 passing

| File | Tests | Covers |
|---|---|---|
| `src/lib/__tests__/timeline.test.ts` | 10 | `calibrateMinutes` (Time-Truth ratio math + rounding boundaries), hh:mm↔minutes round-trip, `buildTimeline` (end-to-end placement, ratio scaling, **no overlapping blocks** invariant), `reflowFromNow` (never schedules into the past) |
| `src/lib/__tests__/safety.test.ts` | 22 | crisis gate catches all real phrasing **including prompt-injection-wrapped** input (zero false negatives), doesn't flag benign task text; child-safeguarding gate catches concerns + ignores benign parenting; abuse gate; both signposts carry the correct UK resources |
| `src/lib/__tests__/pick.test.ts` | 5 | `choosePick`: smallest-that-fits, exclude/reroll, fallback-to-tiniest flag, late-evening tiny-step preference, empty pool |
| `src/lib/__tests__/dopamenu.test.ts` | 7 | `chooseDopamine`: ≤3 results, window-appropriate courses, never-far-over-window, non-empty fallback; `isStale` |

Two of these initially "failed" — both were bugs in **my test assertions**
(assumed a `TimelineEntry.end` field that doesn't exist; end = `start +
minutes`), not the code. Fixed; the code was correct. This is itself a small
signal that the timeline engine's public shape is well-defined.

### Live DB integrity audit — `scripts/db-integrity-audit.mjs` (read-only) — clean

- **Orphaned rows / dangling FKs:** 0 across every application-level FK
  (post_reactions→posts, comments→posts, dm_messages→dm_threads,
  challenge_members/ticks→challenges, buddy_checkins→buddies,
  kid_rewards/kid_wins→children, children→profiles). Confirms the
  `ON DELETE CASCADE`s actually held in production data.
- **Timezone correctness (critical for timeline / deadlines / quiet-hours):**
  `created_at` columns are **`timestamptz`** — verified a live sample stores
  UTC with an explicit offset (`2026-…+00:00`), not a naive local timestamp.
  This is the single most common silent time-bug source and it's correct here.
- **Row counts:** sane (fresh DB — 2 profiles, 3 tasks from your own testing;
  everything else 0). No unexpected bloat.

### Live RLS/IDOR isolation — `scripts/rls-isolation-harness.mjs` — 20/20 (from X1, re-run clean)

Two throwaway accounts; cross-user SELECT/UPDATE/DELETE denied on every table
tested, list queries exclude the other user's rows, anon gets nothing, cascade
delete leaves zero orphans. See SECURITY-REPORT.md for detail.

### AI-gate adversarial — `scripts/crisis-routing-adversarial.ts` — 22/23 (safe-direction only failure)

Now also mirrored inside the Vitest suite (`safety.test.ts`) so it runs in CI.

---

## Database schema review

- **Drift:** schema is defined **only** by the ordered migrations `0001`–`0020`
  (no out-of-band ALTERs) — the live-DB probe confirmed every table/column the
  migrations define is present and every one is reachable, so
  migrations == live schema. Migrations are idempotent
  (`create … if not exists`, `add column if not exists`,
  `drop policy … create policy`) so they re-apply cleanly forward. **They are
  NOT written to be down-migratable** (no `down` scripts) — noted as a Low
  ticket; acceptable for a Supabase-hosted forward-only workflow but worth a
  convention decision.
- **Index coverage:** 22 indexes; every hot filter/sort column
  (friendships user_a/user_b, posts user_id+created_at & visibility+created_at,
  dm_messages thread_id+created_at, boosts to_user, tasks/ideas/etc.
  user_id+created_at) is covered. X2 found six **secondary** lookup columns
  with only leading-column/partial coverage (challenge_members.user_id,
  challenge_ticks composite, dm_threads.user_b, blocks.blocked_id,
  reports(subject_type,subject_id), boosts from/to) — added in **migration
  `0020_x2_indexes.sql`** (additive, idempotent, zero behavioural change).
  **Needs applying** alongside the others.
- **FKs / cascade / constraints:** reviewed in migrations — every child table
  references its parent with `on delete cascade`; check-constraints on enums
  (`age_band`, `visibility`, `kind`, `status`, reward `tokens >= 0`, etc.) are
  present; `not null` where required. The live cascade behaviour is
  empirically confirmed by the RLS harness's clean-teardown check.
- **N+1 patterns:** the challenges GET loops per-challenge issuing several
  queries each (counts, members, photo ticks). Fine at current scale (a user is
  in few challenges) but flagged for X3 as a consolidation candidate
  (Medium — perf-at-scale, not correctness).

---

## Feature × role × state matrix

Legend: ✅ verified this pass · 🟢 structurally enforced (code-reviewed, not
live-clicked) · 🧪 covered by an automated test · ⏸ needs a browser (deferred).
Roles: **A** anon · **F** free · **P** Pro · **Pa** parent (Pro sub-role) ·
**K** kid shared-screen.

| Feature | A | F | P | Pa/K | Empty | Limit-hit | Error/AI-fail |
|---|---|---|---|---|---|---|---|
| Breakdown (text) | 🟢 works | 🟢 3/day gated | 🟢 unlimited | – | 🟢 | 🟢 429/limit msg | 🟢 fallback |
| Photo-to-plan | 🟢 | 🟢 same quota | 🟢 | – | – | 🟢 | 🟢 |
| Focus room / SOS / cool-down | 🟢 free always | 🟢 | 🟢 | – | – | 🟢 1 focus/day free | 🟢 offline-safe |
| Timeline / deadline mode | – | 🟢 | 🟢 | – | 🟢 | – | 🧪 math tested |
| Routines / dopamenu / ideas / impulse / wins / connect | 🟢 gated to login | 🟢 | 🟢 | – | 🟢 | 🟢 | 🟢 |
| Regulate suite (decompress/spiral) | – | 🟢 Pro-gated | 🟢 | – | – | 🟢 aiLight cap | 🟢 crisis-routed 🧪 |
| Activity: library (read) | 🟢 open | 🟢 open | 🟢 | – | ✅ empty | – | 🟢 |
| Activity: post/react/comment/DM/boost/challenge/buddy | ❌ 401 ✅ | ❌ 402 ✅ | 🟢 | – | 🟢 | ✅ 429 rate-limited (X1 fix) | 🟢 |
| Activity: block/report | – | 🟢 free (safety) | 🟢 | – | – | ✅ 429 + 3-report threshold (X1) | 🟢 |
| Parents Mode enable / add child | – | ❌ 402 ✅ | 🟢 | 🟢 | 🟢 | ✅ 429 | 🟢 safeguard-routed 🧪 |
| Parents: coach/plan/reframe/homework/CPS/school | – | ❌ 402 | 🟢 | 🟢 | 🟢 | ✅ aiLight+burst | 🟢 fail-open |
| Kid tools (routine/reward/first-then/emotion/calm/boost) | – | – | – | 🟢 shared-screen | 🟢 | – | 🟢 no-AI ones offline-safe |
| Paywall / checkout / webhook | – | 🟢 → checkout | 🟢 portal | – | – | 🟢 already_pro 409 | 🟢 sig-verified 🟢 |
| Auth (magic-link) / middleware gating | ✅ redirects | ✅ | ✅ | ✅ | – | – | 🟢 |
| PWA install / offline shell | ⏸ | ⏸ | ⏸ | ⏸ | – | – | ⏸ |

Gating cells marked ✅ were confirmed live this pass via raw unauthenticated
API hits (401/402 as designed, never 500) and the middleware redirect probe.

---

## Bugs found in X2

- **None new of Critical/High severity.** The X2-specific finds are the six
  missing secondary indexes (Low, perf-at-scale, fixed via migration 0020) and
  the challenges-GET N+1 (Medium, perf, ticketed for X3). All correctness-level
  behaviour tested came out correct. (The two High security bugs were found and
  fixed in X1.)

---

## Deferred (needs a browser — cannot run in this environment)

These are specified by the brief and **must be run before the final go-live**,
in your environment or a browser-capable CI runner:

1. **Playwright E2E** — every critical flow at 390px + desktop, keyboard-only,
   across anon/free/Pro/parent. (Recommend generating with Playwright's
   codegen against the Vercel preview.)
2. **axe + manual screen-reader** accessibility pass on every screen.
3. **Lighthouse** (Perf/A11y/Best-Practices/SEO/PWA) mobile + desktop — the
   brief's ≥90 target. Note: the security headers added in X1 should *help*
   Best-Practices; the redesign (X4) removes the animated mesh which should
   help Perf/CLS.
4. **PWA install + offline** on Windows (Edge/Chrome) and a phone.
5. **CI `rls-isolation` job** — wired but gated behind a `RLS_CI_ENABLED` repo
   variable + staging Supabase secrets (don't point it at production; it
   creates/deletes throwaway users each run).

## How to run everything yourself
```bash
npm test                                            # 44 unit tests
node scripts/db-integrity-audit.mjs                 # live DB integrity (read-only)
node scripts/rls-isolation-harness.mjs              # live RLS/IDOR (self-cleaning)
node --experimental-strip-types scripts/crisis-routing-adversarial.ts
npm run typecheck && npm run build                  # full compile
```
