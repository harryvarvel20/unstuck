# Changelog

Behavioural changes and refactors, newest first. Purely internal/security
fixes with no user-visible behaviour change are not listed here — see
`reports/SECURITY-REPORT.md` and git history for those.

## Phase Z1 — verification pass (branch `phase-z-final`)

- **Safety fix (Z1-D4):** `/api/social/assist` now runs the deterministic
  crisis gate before ANY AI call on both assist kinds (tone-guard text and
  playbook title/steps). Previously crisis text in those two fields could reach
  the model. User-visible only in that a crisis draft now gets the signpost one
  step earlier; no other behaviour change.
- **Hardening (Z1-D3):** AI-generated step titles/tips now pass the same
  `sanitizeText` stripping as messages (control chars / angle brackets).
- **Tooling (Z1-D1/D2):** DB audit + RLS harness rewritten for the
  post-0023 schema; the audit now *asserts* the child tables are gone
  (zero-child-data guard) and the harness proves handle uniqueness,
  `handle_reservations` lockdown, and `search_posts()` privilege revocation.
- **Tests:** suite grown 68 → 205 (parser fallbacks, 87-assertion crisis-rule
  sweep, mocked route suites for navigate/checkout/posts/assist). Vitest now
  resolves the `@/` alias so route handlers are testable.

## Parents Mode — zero children's data on the server (privacy change)

**Before:** Parents Mode stored a `children` row (optional name, age band, "what's
hardest") plus per-child `kid_rewards` and `kid_wins` on the server.
**Now:** ADHV holds **no data about a child** at all. The child list (an optional
nickname + age band), the reward chart, and the "wins about my kid" log live
**only on the parent's device** (localStorage, `src/lib/parentsLocal.ts`). The
server only ever knows the *parent* toggled Parents Mode on. The `/api/parents/
children`, `/api/parents/rewards`, and `/api/parents/wins` routes are removed,
and migration `0023` **drops** the `children`, `kid_rewards`, and `kid_wins`
tables so there is no capability to store child data.
**Why:** eliminate children's-personal-data risk entirely (data minimisation —
the strongest posture under UK GDPR / the Children's Code) while keeping Parents
Mode fully functional. The AI coaching flows were already stateless (age band +
situation are throwaway request parameters), so they are unchanged; safeguarding
now runs on-device for the local free-text fields.
**User impact:** child setup no longer syncs across devices (fitting for a
shared-screen tool used on one device), and existing server-side child rows are
deleted by the migration. The add-child screen steers to a nickname or nothing.

## Phase Y — Activity Center, navigation & Parents fixes

### Y1 — user-chosen usernames on the Activity Center

**Before:** handles were auto-generated (`bright-otter-472`) and could never be
changed; the first-run screen only displayed the random handle.
**Now:** on first entry you **pick a name** (validated + unique, case-insensitive)
and can change it once every 30 days; the old name is reserved for a cool-down
so it can't be grabbed to impersonate you. **You must choose a name before you
can post or comment** (`handle_required`, enforced server-side). Existing
accounts keep their current handle but are prompted once. Migration `0021`.

### Y2 — Home "Open the Toolkit" card

The route into the tools on Home is now an unmistakable **navigation card**
(compass + chevron, link semantics), not a text box that looked like the
"Make it doable" composer. The AI Navigator input still lives on the Toolkit.

### Y3 — Parents home no longer renders blank

**Before:** with Parents Mode enabled but no child added (a return visit, or
after deleting the last child), the Parents screen rendered only a heading.
**Now:** that state shows a real **"Add your child to get started"** empty state.
(The situation hub + toolbox were already built; this was an unhandled state.)

### Y4 — Parents space in the Activity Center

A separate **Parents** space (shown only with Parents Mode on) for "what worked
with my kid" wins and playbooks, kept entirely apart from the main wins feed.
Child-safety is server-enforced: **no photos** on parent posts, safeguarding
routing on every field, and parent posts **never** enter the free public
library. Copy steers to the parent's own strategy, not the child.

### Y5 — everyone's wins, comment moderation, and search

- **Public wins**: the feed's new **Public** scope surfaces everyone's public
  wins (finite, reverse-chron, no ranking) — not just friends + the library.
- **Comments**: each comment can now be **deleted** (yours, or any on your post)
  or **reported**; the existing tone-guard nudge and crisis routing stay.
- **Search** (`/api/social/search`): real full-text + fuzzy search across win
  text, captions, playbook "what worked", and tags — not just tags. Visibility
  is enforced inside a service-role-only `search_posts` function, so results
  can never leak private/friends-only content. Migration `0022`.

### Y6 — feed scope selector (behavioural change)

A **Show: Friends · Public · Just me** selector filters what you view (distinct
from the per-post "who can see this"). **Change of behaviour:** the **Friends**
view now shows only friends' wins; **your own** posts (including private ones)
live under **Just me**. Scope is enforced server-side and remembered per space.

## Phase X1 — security hardening (branch `phase-x-harden-refinish`)

### Behavioural change: content reports no longer auto-hide on the first report
**Before:** a single report on a post or comment (`POST /api/social/safety`,
`action:"report"`) immediately set `flagged:true`, removing it from every
viewer's feed and the public library — with no check the reporter could
even see the content, and no rate limit.
**Now:** every report is still recorded immediately for a human to review,
but content only auto-hides once it accrues **3 distinct reporters**
(`DISTINCT_REPORTS_TO_AUTOHIDE` in `src/app/api/social/safety/route.ts`),
and the reporter must be authorised to view the content in the first place.
**Why:** the old behaviour let any single signed-in account (Pro not even
required) unilaterally and repeatedly suppress arbitrary users' content —
a griefing/denial-of-service vector. See `reports/SECURITY-REPORT.md`,
"HIGH — Single-report content auto-suppression."
**User impact:** urgent single reports are still recorded instantly and
visible to review; genuinely bad content still comes down fast once more
than one person flags it. The only change is that one bad-faith report can
no longer nuke someone else's win/playbook alone.

### New: rate limiting on every social/parents write endpoint
Previously only the two Gemini-calling routes (`social/assist`,
`parents/coach`) had any throttling. Added a shared 20-requests/minute/user
budget (`checkSocialBurst`/`checkParentsBurst` in `src/lib/socialServer.ts`)
to all other mutating endpoints (posts, comments, reactions, DMs, friend
requests, buddy actions, challenges, boosts, reports, status, profile
settings, children, rewards, wins). Applies to Pro too (abuse protection,
not a plan limit); fails open on infra hiccups. No normal usage pattern
should ever hit this ceiling — it's a spam/abuse backstop.

### New: security headers baseline
`next.config.mjs` now sets CSP, HSTS, X-Content-Type-Options,
X-Frame-Options, Referrer-Policy, and Permissions-Policy on every response.
Verified against zero `<iframe>` and zero camera/mic/geolocation API usage
in the codebase, so nothing currently in the app is affected. CSP still
carries `'unsafe-inline'` for script/style pending a nonce-based rewrite
(tracked in SECURITY-REPORT.md) — everything else is enforced.

### Fix: defence-in-depth ownership checks
`parents/rewards` and `parents/children` gained explicit ownership checks
on top of RLS (which the live test harness confirmed already blocked the
underlying attacks — these are hardening, not a closed live exploit).
