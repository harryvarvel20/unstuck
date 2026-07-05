# Changelog

Behavioural changes and refactors, newest first. Purely internal/security
fixes with no user-visible behaviour change are not listed here — see
`reports/SECURITY-REPORT.md` and git history for those.

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
