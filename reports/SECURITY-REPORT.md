# ADHV — Phase Z5 Security Hardening Report

**Branch:** `phase-z-final` · **Date:** 31 Jul 2026 · **Supersedes** the Phase
X1 report (all X1 fixes re-verified below rather than assumed).

**Verdict: no open Critical or High runtime finding.** Two dev-chain advisory
items are accepted with rationale (§7), one hardening graduation (nonce CSP)
remains a tracked follow-up (§6), and three organisational items need you (§9).

## 1. Threat model (summary)

Assets: user task/mental-health-adjacent text, social content + DMs, parent
free-text, Stripe billing state, Gemini/API keys, service-role key. Roles:
anonymous / free / Pro / parent (no admin surface exists — none to secure).
Trust boundaries: browser→Next API routes (cookie session), routes→Supabase
(anon key + RLS, or service key server-only), routes→Gemini/Stripe (server
only), Stripe→webhook (signature). Kid-facing surfaces are device-local only.

## 2. Authentication & sessions — PASS (proven live)

Every protected route resolves the user server-side from the Supabase session
cookie (`auth.getUser()` — token verified against Supabase, not trusted from
the client). Z2 proved over HTTP: anonymous → 401 on read AND write; free →
402 on Pro surfaces; forged-role impossible (plan read from `profiles` row
server-side per request). Magic-link only (no passwords to stuff);
signInWithPassword exists only for admin-created harness users.

## 3. Authorization, RLS & IDOR — PASS (proven live, twice over)

- **DB layer:** `rls-isolation-harness.mjs` 20/20 — cross-user
  select/update/delete/list isolation, anon zero-access, storage-adjacent
  tables locked, `handle_reservations` service-role-only, `search_posts()`
  EXECUTE revoked from anon+authenticated, delete-cascade clean.
- **API layer:** `activity-two-account-harness.mjs` 67/67 — B's valid cookie
  cannot read/modify/delete A's posts/DMs/profile (verified by re-read, not
  response codes); report requires viewability; block severs feed+DMs.
- **Storage:** direct bucket download denied even signed-in; short-lived
  signed URLs are the only road; uploads land under the owner's folder;
  EXIF stripped client-side pre-upload; parents-space uploads refused.

## 4. Server-side enforcement & input handling — PASS

Plan gating, daily limits and burst ceilings all execute in routes (Z1 tests
assert the 402/429 paths; Z2 proved them over HTTP with limits left ON). All
bodies are Zod-validated at the boundary; queries are PostgREST-parameterised
(no string SQL anywhere in app code; the one SQL function is SECURITY DEFINER
with pinned search_path and locked EXECUTE). User content renders as React
text nodes everywhere; the single `dangerouslySetInnerHTML` in the codebase
is the static theme-bootstrap constant in `layout.tsx` (no user data can ever
flow into it — grep-verified) with
`sanitizeText` defence-in-depth now applied to ALL model output paths
(Z1-D3). No SSRF surface (no user-supplied URLs fetched); no mass assignment
(explicit column maps).

## 5. AI security — PASS with evidence

- **Crisis routing cannot be silently dropped:** the 87-assertion prompt sweep
  fails CI if any builder loses the crisis/safeguarding rule; deterministic
  gates run BEFORE the model on every free-text surface (route-tested for
  navigate/posts/assist — the assist gap was found and fixed this phase,
  Z1-D4); the adversarial phrasing battery on the deterministic gates scores
  22/23 with the single miss being a false-POSITIVE (over-caution, safe
  direction).
- **Prompt injection containment:** user text is data-positioned (never
  concatenated into system prompts); model output is schema-validated before
  use; the Navigator is catalog-locked (hallucinated routes provably fall back
  to /toolkit); malformed/empty model output degrades to safe fallbacks
  (17-test parser suite). Worst-case successful injection yields a warped
  *message* — it cannot mint routes, bypass gates, or touch data.
- **PII minimisation to the model:** requests carry the user's text + numeric
  context (hours, ratio, age band) — never identifiers, emails, or history.

## 6. Web hardening — PASS with one tracked follow-up

Shipped and verified in `next.config.mjs`: CSP (default-src 'self',
frame-ancestors 'none', object-src 'none', base-uri/form-action 'self',
connect-src allow-listed to Supabase/PostHog/Stripe, upgrade-insecure-
requests), HSTS preload 2y, X-Content-Type-Options, X-Frame-Options DENY,
Referrer-Policy, Permissions-Policy (camera/mic/geo/payment off),
poweredByHeader off. Cookies are Supabase SSR defaults (HttpOnly refresh,
Secure, SameSite=Lax — CSRF-mitigating; state changes additionally require
JSON bodies, which forms can't send cross-origin). **Follow-up (High
priority, post-launch):** graduate CSP from 'unsafe-inline' to per-request
nonces — needs browser-verified nonce plumbing through Next's inline
hydration scripts; unsafe to ship blind. Tracked since X1, unchanged.

## 7. Secrets & supply chain

- **Working tree:** zero secret-shaped strings (pattern scan across
  src/scripts/supabase/reports/docs).
- **Git history:** the two pattern hits live ONLY on local, never-pushed
  branches (`backup/full-history-phase-x`, stale local `main`) and are the
  old **placeholder** strings that GitHub push-protection flagged and we
  neutralised pre-publish. **Pushed history is clean; no real credential has
  ever been committed — nothing requires rotation.** Housekeeping: delete the
  stale local branches at your leisure.
- **Client bundle:** NEXT_PUBLIC_* is exactly the public set (Supabase URL +
  anon key, Stripe publishable, PostHog, app URL). Service-role, Stripe
  secret, webhook secret, Gemini key: server-only, verified by import-graph.
- **npm audit:** non-breaking fixes applied (brace-expansion High → fixed).
  Remaining two are **accepted dev-chain advisories**: esbuild/vite (dev
  server only, breaking fix = vitest 4 major) and the postcss advisory inside
  Next's own pinned build chain (build-time; no untrusted CSS is ever
  processed at runtime). Neither is reachable in production. Revisit at the
  next scheduled dependency bump.
- Lockfile committed; CI runs `npm audit` on every push. **You:** enable
  Dependabot + branch protection + 2FA on the GitHub repo (dashboard-side,
  §9).

## 8. Billing — PASS (proven)

Webhook signature verified (`constructEvent`) with idempotent plan-sync from
current subscription state (re-verified in source this phase); entitlements
derived only from the webhook-updated profile row; checkout promo codes
validated server-side; `managed_payments` disabled on every session so the
charged price always equals the advertised price (CI-tested); live test
purchase completed 28 Jul (checkout → webhook → Pro grant).

## 9. Needs you (cannot be done from this environment)

1. **GitHub repo settings:** private ✓ (verify), enable 2FA, branch
   protection on the production branch, Dependabot alerts/updates.
2. **Supabase dashboard:** confirm daily backups are listed and note the
   restore steps.

   > **Correction (13 Aug 2026).** This item previously read "confirm daily
   > backups are on (free tier: 7-day PITR is not included)", which implied
   > the Free plan had daily backups and merely lacked point-in-time recovery.
   > **It had neither** — verified against Supabase's pricing documentation,
   > the Free plan includes **no automatic backups at all**, and Free projects
   > also pause after a week of inactivity. For the period the project was on
   > Free there was no restore path for any user data, which was an Art.
   > 32(1)(c) gap as much as an operational one. **Resolved: upgraded to Pro
   > (daily backups, 7-day retention) on 13 Aug 2026.** PITR remains a paid
   > add-on (~$100/mo) and is **not** needed at this scale.
3. **Vercel:** keep "source maps in production" off (default), confirm env
   vars are scoped to Production/Preview only (they are, from setup).

## 10. What is honestly not preventable (product-protection realism)

Client JavaScript is inspectable by anyone — that is not a vulnerability but
physics. The proprietary value (prompts, gating logic, limits, safety rules,
data) already lives exclusively server-side, which is the real protection.
Public content scraping is rate-limited (per-IP quotas on anonymous surfaces)
but a determined scraper with many IPs can read public wins — as on any
social product; private/friends content is not reachable (proven §3).

## 11. Operational

Logging is structured console.error with error objects only — grep-verified
no user text/PII/secrets in log lines. Error responses are generic codes
(no stack traces to clients — jsonError maps to short strings). Incident
basics: rotate keys in Vercel/Supabase/Stripe dashboards, revoke sessions via
Supabase auth admin, `vercel rollback` for bad deploys; breach-notification
duties are covered in COMPLIANCE-REPORT.
