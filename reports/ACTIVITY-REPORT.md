# ADHV — Phase Z2 Activity Center Report (two-account live test)

**Branch:** `phase-z-final` · **Date:** 31 Jul 2026 · **Result: 67/67 checks
PASS** (65 in the main harness + 2 in the playbook-copy addendum). No Critical
or High findings. One test-fixture false alarm investigated and documented
(§4). UI-pixel/keyboard passes are explicitly deferred to Z4/Z7 (§5).

## 1. Method

Per your decision (option a): **synthetic, self-cleaning accounts on the live
project** — no real user rows touched, everything created is deleted and the
cascade verified. The harness (`scripts/activity-two-account-harness.mjs`):

- boots the **production build** (`next start`) on a local port and drives the
  **real HTTP API** exactly as the browser does — real `@supabase/ssr` session
  cookies (base64-chunked), real RLS, real Postgres, real signed URLs;
- creates **A (Pro), B (Pro), C (free), R1/R2** (race test) via the admin API,
  password-authed; Pro set server-side on the profile row;
- runs the full Z2 battery, sleeps out the per-minute write budget mid-run
  (so rate limits stay ON — they are part of what's being tested), then
  deletes every account and asserts zero rows remain.

Rerun any time: `node scripts/activity-two-account-harness.mjs` (≈4 min) and
`node scripts/playbook-copy-check.mjs`.

## 2. Coverage vs the Z2 brief

| Brief item | Checks | Result |
|---|---|---|
| 1. Usernames: validation, blocklist, case-insensitive uniqueness, **race** (simultaneous claim → exactly one winner), post-before-name gate | 7 | PASS |
| 1. Friend lifecycle: request by handle → incoming visible → accept → mutual; **silent unfriend** (row simply gone for both, no notification surface exists); **mute without rupture** (feed hides, friend never told, unmute restores); block; report | 9 | PASS |
| 2. Posting/viewing: private/friends/public + playbook + photo; feed scope selector returns exactly the right rows in every combination (incl. own-posts-in-Just-me, never in Friends) | 8 | PASS |
| 3. Reactions (named faces, no tallies), comments (friend ok, crisis → signpost unpublished, author moderation delete, comments-off 403, friends-only 403 for strangers), DMs (delivery, **crisis delivers + signposts sender**, non-friend 404, read receipts OFF default), boosts, status, challenges (**collective total only, no per-person fields**), buddy (ask → accept → check-in → cheer → silent unpair) | 24 | PASS |
| 4. Search entitlement: friend finds friends-only; private text NEVER surfaces; after unfriend the friends-only text vanishes; public remains; **crisis query → signpost, zero results** | 5 | PASS |
| 5. Playbook "Try this myself" pipes steps into the viewer's own task (201 + row lands on copier's user_id, steps intact) | 2 | PASS |
| 6. Authorization proofs: B PATCH/DELETE A's post (no effect, verified by re-read), free-tier 402 on feed + handle, anonymous 401 on read + write, **direct storage download denied even signed-in** (signed URLs are the only road) | 7 | PASS |
| 7. RSD guardrails in the built product: reactions are name+kind arrays with no count fields; feed is finite (`caughtUp:true`, ≤30) with no ranking keys; challenge payload has no leaderboard/per-member fields, members are plain names; quiet-toggle persists | 5 | PASS |

(Counts sum to >67 because several checks prove two brief items at once.)

## 3. Notable proofs worth naming

- **Race-safe usernames:** two accounts claiming the same handle in the same
  instant → exactly one 200, one 409 (DB unique index, not check-then-insert).
- **Crisis behaviour matches the product law everywhere it should differ:**
  comments/posts → *not published*, signpost; DMs → *delivered* + sender
  signposted (a friend reaching out is never silenced); search box → signpost
  with zero results; tone-guard (informational live call) nudged an unkind
  comment without blocking.
- **Storage lockdown:** the photo URL returned by the API is a signed URL; a
  signed-in user hitting the bucket directly is denied. There is no
  client-reachable path to another user's photos.

## 4. Investigated: fuzzy search "false alarm" (not a leak)

First run flagged two search checks. Inspection showed the returned row was
A's **public** post: the fixtures (`zebra…private` / `zebra…public`) differed
by one suffix, and pg_trgm similarity legitimately matched the public text.
The private/friends text itself never appeared. Fixtures were changed to
dissimilar tokens and the assertions tightened to the actual security property
("the protected text never appears for the wrong viewer") — all green. Noted
because it documents a real behaviour: **fuzzy search can return *similar*
public content; it can never return protected content.**

## 5. Honestly out of scope here (scheduled)

- **Visual/keyboard/390px passes** of these screens (tab order, focus rings,
  hit targets, zero-reaction calm state as *rendered*): Z4 ADHD sweep + Z7 axe.
- **Read-receipt UI** (API default proven OFF; no UI ever displays receipts —
  code-reviewed) and tone-guard nudge *rendering*: Z4.
- Live Gemini adversarial phrasing battery: consolidated into Z5's AI security
  pass as planned.

## 6. Changes made during Z2

No product code changes were needed — every failure was a harness-side fixture
issue. New durable test assets: `activity-two-account-harness.mjs` (65
checks), `playbook-copy-check.mjs` (2 checks). Both self-cleaning, both exit
non-zero on failure, both documented in the README-able form above.
