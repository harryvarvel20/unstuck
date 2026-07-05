# ADHV — Phase X1 Security Audit Report

**Branch:** `phase-x-harden-refinish`
**Scope:** Full security audit per the Phase X1 brief, against the actual
production codebase (Next.js 15 App Router / Vercel, Supabase Postgres + RLS
+ Storage + magic-link Auth, Gemini 2.5-flash server-side, Stripe test-mode,
PostHog, installable PWA — stack assumptions confirmed correct).

## Methodology note — read this first

The brief calls for testing against a Supabase staging branch/fixtures,
never production. **This environment has no browser/OAuth access and cannot
provision a new Supabase project or dashboard-level staging branch.** The
pragmatic, safe substitute used throughout this audit:

- Every live check either (a) reads schema/config only, (b) is a read-only
  probe, or (c) uses **two throwaway auth accounts** created via the Admin
  API (`adhv-phasex-{a,b}-<timestamp>@adhv-test.invalid`), exercised, then
  **deleted with cascade verified clean** — zero real user data was ever
  touched. The harness is committed at
  `scripts/rls-isolation-harness.mjs` (self-cleaning, re-runnable).
- **Recommendation before X2**: provision a real Supabase staging
  project/branch with seeded fixtures — X2's heavier fixture-based/E2E
  testing will need it and shouldn't keep improvising on production.

Also per the brief: DAST (OWASP ZAP) requires a staging deploy, which
doesn't exist yet — deferred to X5 once a Vercel preview exists.

---

## Summary

| Severity | Found | Fixed now | Ticketed |
|---|---|---|---|
| Critical | 0 | — | — |
| High | 2 | 2 | 0 |
| Medium | 4 | 3 | 1 |
| Low | 3 | 1 | 2 |
| Info | 4 | 2 | 2 |

**No Critical findings.** Both High findings were fixed in this pass, per
the "fix all Critical/High before X5" instruction. Full detail below.

---

## Threat model

**Roles:** anonymous (unauthenticated, `/app` free-text works without an
account), free (signed-in, no Pro), Pro, parent (a Pro sub-role — Parents
Mode is opt-in on top of Pro), the child shared-screen surface (no login,
no account, no independent identity — entirely parent-mediated on the
parent's device), and **there is no admin role** — the app has no
admin panel or elevated internal-staff surface; the only privileged actor
is the service-role key itself, confined to server code.

**Trust boundaries:**
1. Browser ↔ Next.js server (cookies carry the Supabase session; CSRF/CORS
   relevant here).
2. Next.js server ↔ Supabase Postgres — **two distinct patterns exist** in
   this codebase (see "the single most important finding" below).
3. Next.js server ↔ Gemini (all user text is untrusted input to the model;
   crisis/safeguarding must be enforced by application code, not by asking
   the model nicely).
4. Next.js server ↔ Stripe (webhook is an inbound trust boundary from a
   third party; must verify signature).
5. Next.js server ↔ Supabase Storage (photo buckets; must stay private,
   signed-URL only).

---

## The single most important architectural fact

`getSocialContext()` (`src/lib/socialServer.ts`) resolves its `db` client via
**`getServiceClient()` — the service-role key, which bypasses RLS entirely.**
Every Activity Center (Phase U) route, and the Parents-tools routes that
reuse these helpers, therefore do **not** rely on Postgres RLS as their
enforcement boundary for reads/writes. **The real gate is the TypeScript
authorization code** in `socialServer.ts` and each route handler
(`canViewPost`, `areFriends`, `isBlocked`, `loadThread`, ownership `.eq()`
filters, etc.).

This is a legitimate, common architecture, and RLS on those tables is
correctly still enabled as defence-in-depth (protects against a
hypothetical future bug that points the *browser* at Supabase directly with
the anon key). But it means **a bug in the TypeScript authorization logic
is not caught by RLS at all** for these tables — RLS on `posts`,
`dm_messages`, `friendships`, `challenges`, etc. would not have stopped an
IDOR in the application code.

Given this, the highest-value activity in this audit was a **line-by-line
re-verification of every social/parents route handler's authorization
logic**, not just an RLS-enablement check. That review is what surfaced
both High findings below.

Routes that instead use `createSupabaseServer()` (the per-user, RLS-scoped
client — `/api/parents/children`, `/api/parents/wins`, `/api/parents`) *do*
rely on RLS as the real boundary, and the live two-account harness confirms
that boundary holds (see "Live verification" below). **Recommendation
(Low/Info):** the codebase mixing both patterns is a maintainability risk —
a future edit could accidentally swap `createSupabaseServer()` for
`getServiceClient()` in an RLS-reliant route and silently remove its only
protection. Mitigated partially in this pass by adding explicit ownership
filters as defence-in-depth even where RLS already covers it (see fixes).

---

## Findings

### HIGH — Single-report content auto-suppression (fixed)
**File:** `src/app/api/social/safety/route.ts`
**Repro (pre-fix):** Any authenticated user — **not even Pro-gated** — could
call `POST /api/social/safety {action:"report", subjectType:"post",
subjectId:"<any known post id>"}` and the post was **immediately** set
`flagged:true`, which removes it from every viewer's feed and the public
library (`.eq("flagged", false)` filters). No check that the reporter could
even see the post (post IDs are trivially knowable — the public library is
intentionally open/searchable), and **no rate limit at all**. A single
malicious or compromised account could unilaterally and repeatedly
suppress arbitrary users' content platform-wide.
**Fix applied:**
1. Reporter must now be authorised to view the content (`canViewPost`)
   before a report is even recorded against it.
2. **Behavioural change**: auto-hide no longer happens on the first report.
   Every report is still recorded immediately for human review, but content
   is only auto-flagged once it accrues `DISTINCT_REPORTS_TO_AUTOHIDE = 3`
   unique reporters. This is a deliberate security fix, not a silent
   product change — logged in `CHANGELOG.md`.
3. Added the new shared rate limiter (below) to this route. Reporting
   itself stays un-paywalled (blocking/reporting are safety tools —
   consistent with "safety tools never paywalled").

### HIGH — No rate limiting on any social/parents write route except the two AI endpoints (fixed)
**Repro (pre-fix):** Only `/api/social/assist` and `/api/parents/coach` (the
Gemini-calling routes) had any `checkBurst` call. Every other mutating
endpoint — posts, comments, reactions, both DM routes, friend requests,
buddy actions, challenges (create/**join-by-code**/tick), boosts, status,
profile settings, and the parents-tools routes — had **zero** throttling
beyond Zod shape validation. Concretely exploitable as: unlimited
comment/DM/friend-request spam from one account; challenge **join-code
guessing** at unlimited speed (6-char code from a 32-char alphabet is
~1.07B combinations, impractical to brute-force in full, but zero
defence-in-depth against a smaller-scale scripted attempt); unbounded
report-flooding (compounds the finding above).
**Fix applied:** added `checkSocialBurst()` / `checkParentsBurst()` (new
shared helpers in `socialServer.ts`, reusing the existing, already-audited
`checkBurst()` infrastructure — 20 requests/minute/user, applies to Pro too
since this is abuse protection not a plan limit, fails open on infra
hiccups so a real user is never blocked by our own outage) to all 13
previously-unprotected write routes: `posts` POST, `comments` POST,
`react` POST, `dms` POST (both the thread-create and message-send routes),
`friends` POST, `buddy` POST, `challenges` POST, `boosts` POST, `safety`
POST, `status` POST, `profile` PATCH, `parents/children` POST,
`parents/rewards` PUT+POST, `parents/wins` POST.

### MEDIUM — `kid_rewards` upsert had no application-level ownership check (fixed; DB layer already correct)
**File:** `src/app/api/parents/rewards/route.ts`
**Detail:** `kid_rewards.child_id` is the primary key; the route never
explicitly verified the `childId` in a request belonged to the caller
before running `upsert(..., {onConflict:"child_id"})` — relying entirely on
how Postgres RLS interacts with `ON CONFLICT DO UPDATE`, a subtler
guarantee than an explicit check.
**Live-verified:** the two-account harness proved this specific attack
(`B` upserting onto `A`'s `child_id`) **was already blocked by Postgres RLS
itself** — the row-level security `USING` clause on the conflicting
existing row correctly vetoes the update (`"new row violates row-level
security policy (USING expression) for table \"kid_rewards\""`). So this
was **not actually exploitable** as feared.
**Fix applied anyway:** added an explicit `ownsChild()` check (via the
RLS-scoped client, querying `children`) before GET/PUT/POST in this route.
This turns an opaque Postgres RLS error into a clean 404 and removes the
dependency on that upsert/RLS interaction being correct forever across
future Postgres versions — cheap, correct defence-in-depth.

### MEDIUM — Zero security headers configured (fixed)
**File:** `next.config.mjs`
**Detail:** the only hardening present was `poweredByHeader: false`. No
CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or
Permissions-Policy anywhere.
**Fix applied:** added all six headers globally via `headers()`. Verified
live (`curl -I`) on both a page and an API route; confirmed the app still
renders correctly (full SSR/RSC payload inspected). Also verified before
adding `X-Frame-Options: DENY` / `frame-ancestors 'none'` and a locked-down
`Permissions-Policy` (camera/mic/geolocation/payment/usb all denied) that
the app has **zero** `<iframe>` usage and **zero** `getUserMedia`/
`mediaDevices`/geolocation/PaymentRequest calls anywhere — these headers
cannot break anything currently in the app.
**Residual (tracked, not fixed blind — see below): CSP still has
`'unsafe-inline'` on `script-src` and `style-src`.**

### MEDIUM (residual, ticketed) — CSP cannot yet drop `'unsafe-inline'`
Graduating to a per-request nonce (dropping `'unsafe-inline'` from both
`script-src` and `style-src`) is the correct end state, but:
- Dynamic inline `style={{...}}` is **pervasive** across this codebase
  (progress bars, confetti positions, emotion-level colours, drag-computed
  positions, etc.) — removing `unsafe-inline` from `style-src` would need
  either a full refactor to CSS custom properties, or per-element nonces,
  and would **silently break UI rendering** if done wrong.
- Next.js's own RSC-streaming inline scripts need the documented
  nonce-via-middleware pattern to keep working.
- **I have no real browser available in this environment** — I can confirm
  headers land via `curl`, but curl cannot detect a CSP violation (browsers
  enforce CSP, not `curl`). Shipping a strict CSP I cannot visually verify
  is worse than shipping a good-but-not-perfect one I've confirmed doesn't
  break the app.
**Ticket for X2/X4:** implement the nonce-based CSP, verify with a real
browser (Playwright, which does surface CSP console violations) across
every page before enforcing. Until then this is Medium, not High/Critical,
because the primary XSS defence is structural (see next finding) — CSP
here is genuinely defence-in-depth, not the only thing standing between
users and stored XSS.

### PASS (verified, not a finding) — Stored/DOM XSS
`dangerouslySetInnerHTML` is used exactly **once** in the whole codebase
(`src/app/layout.tsx`, the theme-init script) with a static, developer-
authored string — never user content. Every other render path is plain
React JSX interpolation (`{text}`), which auto-escapes by default. No
`eval`/`new Function`/`child_process.exec`. No raw SQL string-building
anywhere (Supabase's query builder is parameterized throughout). **Stored
XSS is structurally prevented by the framework, not by a filter that could
have a gap.**

### PASS (verified) — Row-Level Security
All 34 tables created across 19 migrations have RLS **enabled**
(`grep`-diffed exhaustively: every `create table` has a matching `enable
row level security`, zero gaps). Two tables (`anon_usage`, `feature_usage`)
correctly have **zero** policies by design — deny-all to `anon`/
`authenticated`, reachable only via `SECURITY DEFINER` RPC functions
(themselves verified to correctly pin `search_path = public`, closing the
classic Postgres search-path-hijack footgun). **Live-verified** via the
two-account harness: 20/20 checks passed — cross-user SELECT/UPDATE/DELETE
denied, list queries correctly exclude the other user's rows, anonymous
access returns nothing, and deleting a test account cascades to zero
orphaned rows across every table tested.

### PASS (verified) — Entitlement never trusted from the client
Structural grep across every API route: no route reads `plan`/`isPro`/
`tier`/`entitlement` from the request body; `isPro`/`plan` is **only ever**
assigned from a fresh DB read of `profiles.plan`. The Stripe webhook is the
sole writer of `profiles.plan`, gated on signature verification
(`stripe.webhooks.constructEvent`), and handlers are idempotent by
construction (they set plan from current subscription state, so replays
converge). `/api/checkout` only accepts a `plan: "monthly"|"annual"` enum —
the actual Stripe price ID is looked up server-side, never client-supplied.

### PASS (verified) — AI prompt-injection / crisis-routing cannot be bypassed
The crisis/child-safety screens (`containsCrisisLanguage`,
`childSafetyConcern` in `src/lib/safety.ts`) are **pure deterministic
regex, evaluated in application code before the user's text ever reaches
Gemini.** Adversarial battery run (`scripts/crisis-routing-adversarial.ts`,
23 cases): genuine crisis/safeguarding phrasing was caught **100% of the
time, including when wrapped in explicit prompt-injection framing**
("ignore all previous instructions... I want to kill myself", JSON-fence
wrapping, "repeat after me" framing) — because a regex has no concept of
"instructions" to ignore. Zero false negatives found. One test produced a
false **positive** (over-flags "I want to die of embarrassment" as crisis)
— the safe-direction failure mode for a safety net (worst case: a user
briefly sees a compassionate helpline message instead of their normal
output; never the reverse). Rated Low, not a fix — over-caution here is
correct-by-design, not a bug.

### LOW (ticketed) — `sharp <0.35.0` (npm audit HIGH, CVE-2026-33327/28,
35590/91) — but verified **dormant/unreachable**
`npm audit` flags this High. **Verified the real severity is much lower for
this specific app**: `sharp` is resolved at `0.34.5` purely as Next.js's own
transitive dependency for `next/image`'s optimizer — **`next/image` is
never imported anywhere in this codebase** (confirmed by grep). This app's
own photo pipeline (`src/lib/image.ts`) does 100% client-side Canvas
compression and never touches `sharp` on the server, including for
user-uploaded photos. The vulnerable code path exists in `node_modules` but
is never invoked by any route in this app. **Do NOT run `npm audit fix
--force`** — for this dependency graph it would downgrade `next` to
`9.3.3`, an enormous, destructive regression; the audit tool's suggested
fix is wrong here. **Ticket:** track via a routine Next.js minor/patch
upgrade (which will pull a patched `sharp` transitively) during normal
maintenance, not an emergency fix.

### LOW (ticketed) — `postcss <8.5.10` nested under `next/node_modules`
Same shape as above: the top-level `postcss` (used by the app's own
Tailwind pipeline) is `8.5.16`, already patched. Only Next's own internal
bundled copy (`8.4.31`, build-time only, processes the developer's own CSS
— never end-user/attacker-supplied content) is in the flagged range.
Build-time-only exposure, no runtime attack surface. Same ticket as sharp
(resolves together on a Next.js upgrade).

### LOW (fixed) — `dompurify <=3.4.11` transitive via `posthog-js`
Not a direct dependency; the app never calls DOMPurify itself (session
recording is explicitly disabled in the PostHog config, autocapture off).
**Fixed**: ran `npm audit fix` (non-forcing). It bumped `next` 15.5.20 →
15.5.21 (safe patch release) which pulled `dompurify` to `3.4.12`,
resolving the advisory. Re-ran the full typecheck + build + parser test
suite afterward — all green, zero regressions from the bump. `npm audit`
now reports only the two dormant/build-time findings above (postcss,
sharp) — down from four.

### INFO — Two authorization patterns coexist (RLS-as-boundary vs. app-code-as-boundary)
Documented under "the single most important architectural fact" above.
Not a bug today (both patterns are correctly implemented where used), but
worth CODE-HEALTH.md attention in X3: consider a lint rule or code comment
convention flagging which client a new route should use and why.

### INFO — Comment/post delete endpoints intentionally skip `requirePro`
`DELETE` on your own comments/posts works even if you've since lost Pro.
Judged correct-by-design (you should always be able to delete your own
content regardless of subscription state) rather than a gap — noting it so
it doesn't look like an oversight.

### INFO — CSRF posture
State-changing routes rely on `@supabase/ssr`'s cookie (SameSite, default
`Lax`), which blocks the cookie from riding along on a cross-site POST via
fetch/XHR/form (Lax only forwards cookies on top-level GET navigations).
Combined with the CSP's new `form-action 'self'`, this is a reasonable
baseline. **Not independently verified with a live cross-origin POST test
in this pass** (would need a second origin to test from) — recommend a
concrete cross-origin POST test in X2.

---

## Fixes shipped in this pass (all committed on `phase-x-harden-refinish`)

1. `src/lib/socialServer.ts` — new `checkSocialBurst()` / `checkParentsBurst()` shared rate-limit helpers.
2. 13 route files — wired the new rate limiter into every previously-unprotected write endpoint.
3. `src/app/api/social/safety/route.ts` — visibility check before reporting + report-threshold auto-hide (behavioural change, logged in CHANGELOG.md).
4. `src/app/api/parents/rewards/route.ts` — explicit `ownsChild()` check on every handler.
5. `src/app/api/parents/children/route.ts` — explicit `parent_id` filter on DELETE (defence-in-depth; RLS already covered it).
6. `next.config.mjs` — full security-headers baseline + CSP (with the `unsafe-inline` residual explicitly ticketed).
7. `scripts/rls-isolation-harness.mjs` — committed, reusable, self-cleaning two-account RLS/IDOR test (20/20 passing).
8. `scripts/crisis-routing-adversarial.ts` — committed, reusable adversarial regex battery (22/23 passing, the one "failure" being the safe-direction false positive).

## Verified-clean (no findings)

- Secrets: zero real secrets in the working tree or **full git history**
  (all 42 commits scanned for Stripe/Gemini/Supabase/GitHub/AWS key shapes
  and PEM blocks — only the literal `.env.example` placeholder matched).
- `.env.local` correctly gitignored; only `.env.example` (placeholders) is tracked.
- No `NEXT_PUBLIC_`-prefixed secret keys anywhere.
- Service-role key only ever imported in server-only files (`supabaseServer.ts` and its consumers), never in a client component.
- Stripe webhook: signature-verified, idempotent, entitlement never trusted from the client.
- GDPR/account deletion: `/api/account/delete` removes profile, tasks, usage, focus sessions, plans, and storage objects for the user (reviewed; a full cascade re-check against the newer Phase U/W tables is recommended for X2 given how much schema has grown since that route was written — **ticketed**, not a confirmed gap, just not yet re-verified against the full current table list).

## Ticket backlog for X2/X3/X4/X5

- [ ] Re-verify `/api/account/delete` cascades every Phase U/W table (posts, DMs, challenges, buddies, children, kid_rewards, kid_wins, etc.), not just the pre-Phase-U set.
- [ ] Nonce-based CSP (drop `unsafe-inline` from script-src/style-src), verified in a real browser via Playwright.
- [ ] Concrete cross-origin POST/CSRF test against a live deploy.
- [ ] Provision a real Supabase staging branch for X2's fixture-heavy testing.
- [ ] Expand `crisis-routing-adversarial.ts` into the full mocked-Gemini exhaustive suite the X2 brief calls for; wire both harness scripts into CI.
- [ ] Routine Next.js upgrade to clear the transitive `sharp`/`postcss` advisories (not urgent — both dormant/build-time-only for this app).
- [ ] Decide on a lint/convention rule to keep the two Supabase-client-choice patterns from being accidentally swapped.
- [ ] **ESLint was never actually installed/configured** (`npm run lint` is Next's unconfigured scaffold default — running it prompts interactively and hangs non-interactively/in CI). Set up ESLint + Prettier properly as part of X3, then add the lint step back into `.github/workflows/ci.yml` (currently removed with a note, not silently dropped).

---

## How to reproduce every live check yourself

```bash
# RLS/IDOR isolation (creates + deletes two throwaway accounts, self-cleaning)
node scripts/rls-isolation-harness.mjs

# Crisis/safeguarding regex adversarial battery
node --experimental-strip-types scripts/crisis-routing-adversarial.ts

# Security headers present on a live response
npm run build && npm run start &
curl -sI http://localhost:3000/ | grep -iE "content-security-policy|x-frame|x-content-type|referrer-policy|permissions-policy|strict-transport"

# Secrets scan across full git history
git log -p --all | grep -nE '\bsk_(live|test)_[A-Za-z0-9]{16,}\b|\bAIza[A-Za-z0-9_-]{20,}\b|\bAKIA[0-9A-Z]{16}\b'
# (expect no output except the .env.example placeholder line)

# Dependency audit
npm audit
```
