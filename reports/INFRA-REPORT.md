# ADHV — Phase AA Infrastructure Report

**Branch:** `phase-aa-vercel-pro` · Started 6 Aug 2026
Capabilities verified against **live Vercel documentation** (fetched
6 Aug 2026), not assumptions, per the AA brief.

---

# AA1 — Account, environments & deployment discipline

## 1. Corrections to the stated stack (read first)

The brief asked to be corrected before starting. Four things differ from the
assumptions in it:

| # | Assumption in brief | Reality | Impact |
|---|---|---|---|
| 1 | "production deploys from **main** only" | **Production deploys from `phase-x-harden-refinish`.** There is no `main` branch on the remote. | Real. AA1 cannot be completed as written without a branch rename/migration — **decision needed (§5)** |
| 2 | "PostHog" is part of the stack | PostHog is **implemented but inert** — `PostHogProvider` only initialises when `NEXT_PUBLIC_POSTHOG_KEY` is set, and that variable does not exist in any environment. Every `capture()` call in the app is currently a no-op. | **Blocks AA7** (funnel, A/B results) and part of AA5. Zero product analytics exist today |
| 3 | Preview points at "a Supabase branch/staging database" | Supabase is on the **free plan** — database branching is not available | AA1 preview isolation needs a decision: Supabase Pro (~$25/mo) or a second free project as staging |
| 4 | Stripe billing (implied: configured) | **Mid-migration.** Live account is activated and verified, live product/prices/coupon/webhook exist, but the app's env vars still point at **sandbox** — blocked on retrieving the live secret key | Preview/production key separation (AA1) should be done *as part of* finishing that migration, not separately |

## 2. Verified Vercel Pro capabilities and costs

From the live docs. **Several things the brief asks for are paid add-ons**,
which matters given cost discipline is a hard requirement.

| Feature | Status on Pro | Cost |
|---|---|---|
| Platform fee | 1 deploying seat, **$20 usage credit included** | **$20/mo** |
| Included usage | **1 TB** Fast Data Transfer, **10M** Edge Requests/mo | included |
| Viewer seats (read-only) | Unlimited | **free** |
| Additional deploying seats | Owner/Member | $20/mo each |
| **Vercel Authentication** (protect previews) | ✅ available all plans | **free** |
| **Password Protection** for previews | ❌ Enterprise, or Pro add-on | **$150/mo** |
| "All Deployments" protection scope (incl. production) | ✅ Pro | free |
| Trusted IPs / Passport | ❌ Enterprise only | — |
| **Skew Protection** | ✅ Pro, all environments | free |
| Cron Jobs | ✅ | see AA4 |
| **Speed Insights** | add-on | **$10/mo per project** |
| **Observability Plus** | add-on | **$1.20 per 1M events** |
| **Flags Explorer** | add-on | **$250/mo** |
| SAML SSO | add-on | **$300/mo** |
| Spend notifications | default alert at **$200**/cycle | free |

### Recommendations on the paid items

- **Password Protection ($150/mo): NO.** Use **Vercel Authentication** (free)
  with **Standard Protection** — it restricts previews to logged-in Vercel
  team members, which fully satisfies AA1's "staging is not publicly
  indexable or discoverable" for a solo team. The $150 buys shareable
  passwords for external reviewers you don't currently have.
- **SAML SSO ($300/mo): NO.** Single-person team. Enforce **2FA** on the
  Vercel account instead (free).
- **Speed Insights ($10/mo): defer to AA6**, where it is actually needed to
  evidence Core Web Vitals. It is the cheapest real-data option and I'd
  likely recommend it then — but not before there is traffic to measure.
- **Observability Plus: NO for now.** Base Observability is included; the
  add-on buys extended retention and a query engine that only pays off at
  volume you don't yet have. Revisit at ~10k MAU.
- **Flags Explorer ($250/mo): NO.** AA7's feature flags and kill-switches
  can be built on **Edge Config** directly at negligible cost. The add-on is
  a management UI, not the capability.

**Net recommended add-on spend for AA1: £0.**

## 3. Findings and fixes made in AA1

| ID | Severity | Finding | Action |
|---|---|---|---|
| AA1-D1 | **High (process)** | Production deploys from `phase-x-harden-refinish`, a working branch, not a protected `main`. Branch protection, "deploy from main", and PR-preview discipline all depend on fixing this. | **Decision required — §5.** No code change made unilaterally: renaming the production branch changes deployment behaviour |
| AA1-D2 | **High (growth)** | PostHog inert; no analytics data exists. Every `capture()` call is a no-op | Flagged. Fix belongs to AA7 (needs a PostHog project + key, and PECR consent gating first) |
| AA1-D3 | Low | The **service worker's offline screen used the old Aurora Noir dark palette** (`#0E0E13`/`#F0EFF5`) — the pre-redesign colours. Going offline showed users a screen from a different-looking app | **Fixed:** repainted to the Old Money palette (ivory `#F5F0E6` / navy `#0F1F34`), matching `globals.css` and the manifest, plus a proper dark-mode variant |
| AA1-D4 | Low | Preview deployments relied solely on Deployment Protection to stay out of search indexes | **Fixed:** `X-Robots-Tag: noindex, nofollow, noarchive` now emitted on every non-production deployment (`VERCEL_ENV !== "production"`), belt-and-braces. Verified present on a non-prod build and absent in production |
| AA1-D5 | Info | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in the environment but **referenced nowhere in the code** (checkout is Stripe-hosted/redirect-based) | Dead config. Safe to delete; harmless if kept |

## 4. Audits passed

- **Client-bundle secret exposure: CLEAN.** Only five `NEXT_PUBLIC_*` vars
  exist (`APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `POSTHOG_KEY`,
  `POSTHOG_HOST`) — all legitimately public. **Zero** server-side secrets are
  referenced from any `"use client"` module (checked every client file).
- **Security headers**: CSP, HSTS (2yr, preload), X-Frame-Options DENY,
  nosniff, Referrer-Policy, Permissions-Policy all present and verified live.
  No conflicts introduced.
- **PWA**: manifest colours (`#F5F0E6` / `#0F1F34`) match the design system;
  `scope: "/"`, `start_url: "/app"` correct; service-worker strategy sound
  (cache-first assets, network-first navigations, network-only for API/auth —
  correctly never serving stale API data).
- **Canonical host**: `metadataBase` derives from `NEXT_PUBLIC_APP_URL`
  (`https://adhvtool.com`), so OG/metadata reference the production domain.
- **Skew Protection**: no code change needed — Next.js 15 on Vercel supports
  it with zero configuration, and projects created after Nov 2024 have it on
  by default. **Verify the toggle in the dashboard** (§6).

## 5. ⚠️ Decision needed: the production branch

AA1 requires "production deploys from `main` only" with branch protection.
Today production deploys from `phase-x-harden-refinish`, and `phase-z-final`
is a second unmerged branch. Options:

- **(a) Rename to `main`** — rename the branch on GitHub, update Vercel's
  Production Branch setting, re-point local clones. Cleanest end state and
  matches the brief. ~10 minutes, one moment of care so a deploy isn't
  triggered mid-rename.
- **(b) Create `main` from the current production branch** and switch Vercel
  to it, leaving the old branch as history. Same result, slightly messier.
- **(c) Keep the current name** and simply apply branch protection to it.
  Zero risk, but leaves a working-branch name as your permanent production
  branch — which will read oddly forever and contradicts the brief.

**My recommendation: (a)**, done *before* the Stripe live cutover, so there is
only one disruptive change to reason about at a time.

## 6. Dashboard actions for you (I cannot do these — no Vercel API access)

1. **Settings → Deployment Protection**: enable **Vercel Authentication** with
   **Standard Protection** (free). Do *not* pay for Password Protection.
2. **Settings → Advanced → Skew Protection**: confirm enabled. Given ADHV is
   an installable PWA with long focus sessions, consider raising **Maximum
   Age** from the default 1 day to ~7 days (must not exceed your deployment
   retention). *Do not* add the `__vdpl` cookie pinning described in the docs
   — it keeps users on old deployments until the cookie clears, which would
   have prolonged exposure to the modal bug we shipped last week.
3. **Settings → Environment Variables**: scope per environment — Production
   gets live Stripe keys; Preview/Development get **test** keys. Currently one
   set covers everything.
4. **Team → Members**: add any non-developer collaborator as a free **Viewer**.
5. **Account → Security**: enable **2FA**.
6. **Settings → Git**: set the Production Branch (per §5) and enable branch
   protection on GitHub.
7. **Domains**: confirm the `www` → apex redirect strategy and that
   `adhvtool.com` is the canonical production domain.

## 7. How to test AA1

```bash
git checkout phase-aa-vercel-pro
npm run build && npx next start -p 3099
curl -sI http://localhost:3099/ | grep -i x-robots-tag
#   expect: X-Robots-Tag: noindex, nofollow, noarchive   (non-production)
```

- **Offline screen:** DevTools → Network → Offline → reload. Expect an
  **ivory** screen with navy text (previously near-black), and a dark variant
  if your OS is in dark mode.
- **Production check after deploy:** `curl -sI https://adhvtool.com/ | grep -i
  x-robots-tag` → expect **no** X-Robots-Tag header (production must stay
  indexable).
- **Preview check:** open any preview URL → expect the Vercel Authentication
  gate once enabled, and the noindex header present.
---

# AA2 — Firewall, WAF & abuse protection

Capabilities verified against live Vercel docs, 6 Aug 2026.

## 1. What Pro actually gives you (and what it costs)

| Capability | Pro | Cost |
|---|---|---|
| DDoS mitigation (platform-wide) | yes, automatic | **free** |
| IP blocking | yes | **free** |
| WAF **custom rules** (log / deny / challenge / bypass / redirect) | yes | **free** |
| **Persistent actions** (time-based block of an offending IP) | yes | **free** |
| Attack Challenge Mode | yes | **free** |
| **Rate limiting** | yes | **usage-priced (region-dependent)** |
| Rate-limit counting keys | **IP, JA4 digest only** (User-Agent / arbitrary headers are Enterprise) | — |
| Rate-limit algorithm | Fixed window (Token bucket is Enterprise) | — |
| Counting window | **10s min, 10 min max** | — |
| Rate-limit rules per project | **40** | — |
| Managed rulesets (OWASP CRS) | yes | priced; 4KB/request inspected included |

**Two facts that shape the whole design:**

1. **Blocked traffic is free.** Requests mitigated by deny, challenge,
   rate-limit, persistent actions, DDoS mitigation or IP blocking **do not
   incur CDN Requests or Fast Data Transfer**. Blocking abuse costs nothing,
   which makes free `deny` rules the best value on the platform.
2. **Rate-limit counters are per-region.** Traffic spread across regions can
   exceed the configured limit in aggregate. Edge rate limiting is therefore a
   _cost-control blunt instrument_, **not** an authorization mechanism. That is
   exactly why the AA invariant holds: the app's own per-user limits
   (`checkBurst`, `consumeFeature`, counted globally in Postgres) remain the
   source of truth. The WAF is strictly additive.

## 2. Do NOT configure WAF rules in `vercel.json`

The custom-rules doc shows a `routes[].mitigate` syntax. **Don't use it here:**

- `routes` is **not listed** in the current `vercel.json` property table — it
  is a legacy low-level primitive.
- It conflicts with `headers`, `redirects`, `rewrites`, `cleanUrls` and
  `trailingSlash`. **This app already ships a `headers()` block** (CSP, HSTS,
  the new noindex) in `next.config.mjs`, so introducing `routes` risks
  silently disabling them and breaking Next.js routing.
- It only supports `deny` and `challenge` — **not** `log`, `bypass`,
  `redirect` or `rate limit` — so it cannot express most of the rules below,
  and cannot do the log-first testing the docs recommend.

**All rules below are dashboard-configured** (Project → Firewall → Configure).
They apply immediately without a redeploy, which also means they can be rolled
back instantly if one misfires.

## 3. Architectural finding: auth cannot be rate-limited at the edge

AA2 asks to "rate limit login, signup, password reset". **This is not
achievable at the Vercel edge in this app**, and it matters that you know it
rather than believing a rule is protecting you.

ADHV uses Supabase magic links, and `signInWithOtp` is called **from the
browser directly to `*.supabase.co`** — the request never transits Vercel. No
Vercel WAF rule can see it.

What does apply:

- **Supabase's own auth rate limits**, already proven active (we hit the 429
  email limit during the SMTP migration).
- **Supabase dashboard → Authentication → Rate Limits** is the correct place to
  tune signup/OTP throttling. **Action for you.**
- There are no passwords, so credential stuffing and brute force do not apply.
  The realistic abuse is _inbox bombing_ (spamming OTP emails at a victim),
  which is a Supabase-side control.

## 4. The rule set

Configure in this order. **Follow the docs' method: create each rule with
action = Log first, watch the live traffic view for ~10 minutes, then switch to
the real action.** That is how you avoid locking out real users.

### Group A — Free deny rules (cost 0, do these first)

**A1 — Exploit probes.** Deny + persistent block 1 hour.
Condition: request path matches any of `/.env`, `/.git`, `/wp-admin`,
`/wp-login.php`, `/xmlrpc.php`, `/phpmyadmin`, `/vendor/`, `/.aws`,
`/config.json`.
_Rationale:_ zero legitimate traffic; blocked requests cost nothing; removes
noise from the logs you will rely on in AA5. **False-positive risk: nil.**

### Group B — AI cost protection (rate-limited; this is where the money is)

**B1 — Anonymous-reachable AI endpoints.** These are callable **without an
account** (the landing demo works signed out), so they carry the highest
runaway-cost risk.
Paths: `/api/breakdown`, `/api/breakdown/photo`, `/api/navigate`, `/api/pick`
→ **Rate limit: 20 requests / 60s, keyed by IP**, action **Deny**, persistent
block **10 minutes**.
_Rationale:_ a human trying the app makes a handful of calls; 20/min is far
above real use and far below what makes abuse worthwhile.
_False-positive risk:_ low. Shared office/CGNAT IPs could aggregate — start at
Log, and raise to 40 if you see legitimate traffic clipped.

**B2 — Authenticated AI endpoints.** Everything else under `/api/` **except the
exclusion list in section 5**.
→ **Rate limit: 100 requests / 60s, keyed by IP**, action **429**.
_Rationale:_ the app already enforces 20 writes/min and 60 AI calls/day _per
user_; this is a per-IP backstop against a compromised or scripted account.

### Group C — Protect the content moat

**C1 — Library and search scraping.**
Paths: `/api/social/library`, `/api/social/search`
→ **Rate limit: 60 requests / 60s, keyed by IP**, action **Challenge**.
_Rationale:_ AA2 correctly identifies the public playbook library as the
long-term moat. Challenge (rather than deny) lets a real human through while
stopping headless scrapers.
_Note:_ the library is deliberately **free to read** — do not deny here, or you
break the "methods are never paywalled" product promise.

### Group D — Bot management

Enable **bot filtering** for known-malicious/automated agents. **Do not** block
generic "bot" traffic wholesale — see section 5, several legitimate crawlers
must get through.

## 5. Never rate-limit, challenge or block these

Each of these would break something real. Add explicit **Bypass** rules if any
broad rule would otherwise catch them.

| Path | Why it must stay open |
| --- | --- |
| `/api/webhooks/stripe` | **Server-to-server from Stripe.** It cannot solve a challenge. Blocking it means customers pay and never receive Pro. The endpoint is already protected by **signature verification**, which is stronger than any IP rule |
| `/auth/callback` | The magic-link return. Challenging it breaks sign-in entirely |
| `/api/og`, `/api/icon`, `/api/wins-card` | **Fetched by social-platform crawlers** (WhatsApp, X, Discord, iMessage). Challenge these and every share preview breaks, which directly sabotages the AA7 viral loop |
| `/manifest.webmanifest`, `/sw.js` | PWA install and service-worker updates |
| `/regulate`, `/app`, and all page routes | **Product invariant: a user in crisis must never be blocked from reaching help.** No geo-blocking, no IP blocking, no challenge on page routes. Rate limiting is confined to `/api/` for exactly this reason |

**Geo/IP rules: recommend none.** There is no justified case today, and the
crisis-access invariant makes country blocking actively dangerous.

## 6. Attack Challenge Mode — procedure

**When to turn it on:** a sustained traffic spike you cannot attribute, a bill
alert firing with no product reason, or the Firewall traffic view showing mass
requests to `/api/` from many IPs.

1. Project → **Firewall** → enable **Attack Challenge Mode**.
2. Every visitor must pass a browser challenge before reaching the app.
3. **Expect collateral:** Stripe webhooks and social crawlers will fail while it
   is on. Add bypass rules for `/api/webhooks/stripe` **before** you need this,
   not during an incident.
4. Watch the live traffic view; disable as soon as the pattern stops.
5. Follow up with a targeted rule (usually an IP block or a tighter rate limit)
   so you do not need blanket challenge again.

## 7. Cost note

Group A costs **nothing** and should be enabled permanently. Groups B and C are
usage-priced per evaluation, so they are deliberately scoped to `/api/` paths
only, not to page traffic, which is the bulk of requests. Blocked traffic
generates no CDN/FDT charges, so a rule that fires often is _saving_ money, not
costing it. Exact rate-limit pricing is region-dependent and not published as a
flat figure; the first rule you create shows a pricing dialog — **read it and
tell me the number**, and I will fold it into the AA8 unit-economics model.

## 8. How to test AA2

1. **Before any real action**, set each rule to **Log** and watch Firewall →
   live traffic for 10 minutes of normal use.
2. **A1:** `curl -I https://adhvtool.com/.env` → expect **403**.
3. **B1:** loop 25 rapid POSTs to `/api/navigate` → expect 401/429s and then a
   block once past 20.
4. **Stripe:** Stripe → Webhooks → **Send test event** → must still return
   **200**. This is the single most important regression check.
5. **Auth:** sign in with a magic link from a fresh browser → must work.
6. **Share preview:** paste an ADHV link into WhatsApp or Discord → the OG card
   must still render (proves the crawler bypass works).
7. **PWA:** install from mobile and load offline → must still work.

## 9. Addendum — what was actually deployed, and what went wrong

### 9.1 The rule that is live

One custom rule, **"Rate limit AI endpoints (LOG ONLY)"**:

| Setting | Value |
| --- | --- |
| Conditions | Request Path **Contains** `/api/breakdown` **OR** `/api/navigate` **OR** `/api/pick` |
| Rate limit | Fixed Window · 60s · 20 requests · keyed by **IP Address** |
| Action | **Log** |
| Persistent action | **none** |

It blocks nothing. It exists to answer one question before we enforce anything:
does any real IP ever exceed 20 requests/minute to these paths?

### 9.2 Incident — the exploit-probe rule (A1)

Group A was published as **Deny + persistent block (1 hour)**. Shortly after,
every request I made to the site returned **403** with
`X-Vercel-Mitigated: deny`. Deleting the rule did not restore access, because
the persistent action had already blocked the offending IP for an hour
independently of the rule's existence. It cleared on its own overnight.

**Root cause:** I probed `/.env` to verify the rule worked. That request matched
A1, which triggered the persistent action, which blocked **my IP for every path**
— not just the probe paths.

**Correction to the original incident report:** I described this as "the whole
site is down". That was wrong and I should not have said it without checking.
I had only tested from my own connection, which was the one blocked. There is
no evidence any real visitor was affected.

**What changed as a result:**

- **No persistent actions.** They convert a path-scoped rule into an
  identity-scoped block, and they outlive the rule that created them.
- **Log genuinely means log.** §4 already said to start at Log; I overrode my
  own advice on the grounds that A1 was "zero-risk". The rule was fine — the
  persistent action was not, and I recommended it.
- **Verify from a second vantage point** before declaring an outage.

### 9.3 Two corrections to the §4 rule design

1. **Operator.** The dashboard's **"Is any of"** does exact path matching and
   rejected 6 of 7 values as invalid options. Use **Contains**. A useful
   consequence: `Contains /api/breakdown` also covers `/api/breakdown/photo`,
   so the photo endpoint is protected without a fourth condition.

2. **`/api/pick` is not an AI endpoint.** §4 grouped it under "AI cost
   protection". It is not — it calls `choosePick()` in `src/lib/pick.ts`, which
   is pure local logic and costs nothing at Google. Rate-limiting it is still
   reasonable abuse protection, but the **actual AI cost surface is 17 routes**
   (see AA3 §2), of which the live rule covers two. Widening it is an AA8
   decision once the log data and the pricing figure are in.

**Still outstanding:** the rate-limit **pricing dialog figure**, needed for the
AA8 unit-economics model.

---

# AA3 — Functions, runtime & execution limits

Capabilities verified against live Vercel documentation, 10 Aug 2026.

## 1. Verified limits (not assumptions)

Fluid compute has been **enabled by default for new projects since 23 April
2025**, so these are the numbers that apply:

| | Default duration | Maximum | Extended (beta) |
| --- | --- | --- | --- |
| Hobby | 300s | 300s | — |
| **Pro** | **300s** | **800s** | 1800s |
| Enterprise | 300s | 800s | 1800s |

**Correction to the launch runbook.** It claimed Pro "lifts the function timeout
your streaming AI endpoints rely on". That was wrong: the *default* is 300s on
Hobby too. Pro raises the configurable *ceiling*. The runbook has been fixed.

Other verified facts:

- **Default function region is `iad1` (Washington, D.C.) for all new projects.**
- Pro allows functions in **up to 5 regions**; Hobby is single-region.
- Precedence: **function code › `vercel.json` › dashboard › fluid defaults.**
- Supported Node versions: **24.x (default)**, 22.x, 20.x.
- Under fluid compute, billing is **active CPU** — it pauses while a function
  waits on I/O. A function blocked on Gemini is therefore cheap in CPU terms,
  but it still occupies provisioned memory on a running instance.

## 2. Findings

| ID | Severity | Finding | Action |
| --- | --- | --- | --- |
| AA3-D1 | **High (cost)** | **No `maxDuration` anywhere in the repo.** All 58 API routes plus every SSR page inherited the 300s default. 17 routes call Gemini with no ceiling of their own | **Fixed** — explicit caps added (§3) |
| AA3-D2 | **High (latency)** | **No region configuration.** Functions run in Vercel's default `iad1` (Washington D.C.) while the userbase is UK and Supabase is elsewhere. Every DB query may be crossing the Atlantic twice | **Decision required — §4** |
| AA3-D3 | **Medium (reliability)** | `streamGeminiJson` had **no timeout or abort signal**. A hung upstream call was bounded only by the platform's 300s | **Fixed** — 45s `AbortSignal.timeout` |
| AA3-D4 | Medium (reproducibility) | **No `engines.node`.** Local Node is **26.3.1**; Vercel's default is **24.x**. Two majors of drift between dev and production, unpinned in either direction | **Fixed** — pinned to `24.x` |
| AA3-D5 | Low | On upstream failure `streamGeminiJson` logs and closes a **200** stream, so the client receives an empty body with no error signal | **Documented, not changed** — see §5 |
| AA3-D6 | Info (pass) | **Runtime consistency: every route explicitly declares `runtime = "nodejs"`.** No accidental Edge usage — correct, since the Stripe SDK and Supabase service-role client both require Node | No action |

## 3. Fixes applied

**Duration caps** (`export const maxDuration`, the App Router first-class form —
it takes precedence over every other source):

| Routes | Cap | Why |
| --- | --- | --- |
| 17 Gemini routes + `/api/account/delete` | **60s** | A streamed breakdown finishes in well under 10s; 60s is generous headroom and 5× tighter than the default. The account deletion cascade gets the same allowance |
| `/api/webhooks/stripe` | **30s** | Signature verify + DB write. Ample, and Stripe gives up long before this |
| `/api/og`, `/api/icon`, `/api/wins-card` | **30s** | Image generation |

**Gemini abort** — `GEMINI_STREAM_TIMEOUT_MS = 45_000`, passed as
`abortSignal: AbortSignal.timeout(...)`. Deliberately below the 60s route cap so
a stall fails on our terms (logged, stream closed cleanly) rather than being
killed mid-flight by the platform. Per the SDK, aborting is client-side only: it
frees the function, it does not cancel Google's work, and tokens already
produced are still billed.

**Node pinned** to `24.x` in `package.json#engines`, matching Vercel's current
default so the platform changing its default cannot silently move production.

**Regression guard** — `src/lib/__tests__/function-duration.test.ts` (20 tests)
walks every route file, and fails if a route that references Gemini has no
`maxDuration`, or declares one outside 30–60s. Proven to fail before and pass
after by removing the cap from `/api/breakdown` and re-running. A new AI route
added without a cap now breaks CI instead of quietly becoming a five-minute
cost liability.

**Test suite: 236 passing (was 216).** Typecheck and Prettier clean.

## 4. AA3-D2 resolved: functions moved to London

**Supabase is in `eu-west-2` (London); Vercel functions were defaulting to
`iad1` (Washington, D.C.).**

Every authenticated request in this app begins with a Supabase auth check, so
_every_ API call was making at least one transatlantic round trip — roughly
150ms before any real work began — and routes issuing several sequential
queries paid it repeatedly. This was the largest single latency defect found in
Phase AA.

**Fix:** a minimal `vercel.json` pinning `"regions": ["lhr1"]` (London). This
puts compute next to the database _and_ next to the UK userbase — there is no
trade-off to weigh here, London wins on both axes.

Set in code rather than the dashboard deliberately: it is version-controlled,
reviewable in a diff, and cannot be changed silently by a dashboard click. The
file contains **only** the `regions` key. It does not use `routes`, `headers`
or `functions`, so it cannot conflict with the `headers()` block in
`next.config.mjs` (see AA2 §2 for why `routes` in particular is off-limits).

**UK GDPR note.** The Privacy Policy and `legal/ROPA.md` already disclose that
some processors are US-based and that transfers rely on the IDTA/SCCs — both
remain accurate, since Gemini and Stripe are US-based regardless. This change
does not fix an inaccuracy; it reduces the amount of personal data leaving the
UK, which is a genuine improvement to the transfer position but not a
correction. **No legal document needs editing as a result of this change.**

**Verification required after deploy** — this must be measured, not assumed:

1. Vercel → the deployment → **Functions** tab → region should read `lhr1`.
2. Time an authenticated API call from a UK connection before and after. Expect
   a clear drop on DB-heavy routes such as `/api/today`.
3. Confirm no regression on `/api/webhooks/stripe` — Stripe calls in from its
   own infrastructure and does not care about region, but it is the one
   endpoint where a surprise would cost money.

## 5. Deliberately not changed

**AA3-D5 — the silent 200 on upstream failure.** Making the stream `error()`
instead of `close()` would surface a real failure to the client, which is
better. I have not changed it because it alters the wire contract for 17 routes
and the correct verification is a browser test of each affected UI — and
browser/visual testing is a known blind spot in my tooling, which has already
cost us one shipped bug (the modal). Callers currently treat an empty body as a
failure, so behaviour is safe, just less informative. Flagged for a session
where the UI can be checked directly.

## 6. Dashboard actions for you

1. **Settings → Functions → Fluid Compute**: confirm it is **enabled** (it
   should be, by default). If it is off, the duration defaults are far lower and
   the caps above behave differently.
2. **Settings → Functions → Default Max Duration**: set to **15 seconds**. This
   catches every route not explicitly capped above — all the CRUD endpoints and
   SSR pages — none of which should ever take longer.
3. **Settings → Build and Deployment → Node.js Version**: confirm **24.x**.
4. **Supabase → Settings → General → Region**: report it back for §4.

## 7. How to test AA3

```bash
git checkout phase-aa-vercel-pro
npm run typecheck && npx vitest run    # expect 236 passed
```

- **Prove the guard works:** delete the `maxDuration` line from any AI route and
  re-run the tests — it must fail with a named, actionable message. Restore it.
- **After deploying:** Vercel → Deployments → the deployment → **Functions** tab
  → each AI route should show a **60s** max duration, not 300s.
- **Behavioural check:** run a normal task breakdown on production. It must
  stream and complete exactly as before — the 60s cap and 45s abort are far
  above normal completion time, so nothing user-visible should change.

## 8. Deployment record — AA1–AA3 shipped to production

Merged `phase-aa-vercel-pro` → `main` (fast-forward, `dcec095`) and deployed
10 Aug 2026.

**Pre-merge verification on the preview deployment** — 83 functions listed, and
every one showed:

- region **`lhr1`**, not `iad1`
- runtime **Node.js 24.x**, matching the `engines` pin
- the capped AI routes at **≤60s**; uncapped routes still at the platform
  default **≤300s**, which is what the dashboard default (§6.2) will bring down

**Post-deploy verification on production:**

| Check | Result |
| --- | --- |
| Public pages (8) | all 200 |
| Gated pages (3) | 307 auth redirects |
| `X-Vercel-Mitigated` | absent everywhere — no firewall false positives |
| **`X-Robots-Tag`** | **absent in production** — the AA1 noindex correctly fires only on non-production, so the site stays indexable |
| Security headers | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy all present |
| `POST /api/webhooks/stripe` unsigned | **400** — signature verification intact. The single most important regression check |
| `/api/breakdown`, `/api/navigate` | 400 on empty body |
| `/api/parents` signed out | 401 |
| No 5xx on any probe | confirmed |

**Latency:** `/activity` performs a Supabase auth check before redirecting, so
it exercises the function→database path. It now returns in **89–110ms** from a
UK connection. A transatlantic round trip is ~75–90ms each way, so an `iad1`
function querying a London database could not produce that figure. **Caveat, so
this is not overstated:** no before-measurement was captured on that route, so
this is corroboration rather than a measured delta.

### Not a defect: the Parents tab is absent on preview deployments

Raised during preview review. **Working as designed, and unrelated to this
branch** — the diff touches no component, page or navigation file.

`GET /api/parents` returns **401** when signed out; `AppNav` bails on any
non-OK response and leaves `parentsEnabled` false, so the tab does not render.
A preview deployment is served from a different domain, so the production
Supabase session cookie does not apply — you are signed out there. Toolkit and
Activity are unconditional, which is why only Parents appeared to vanish.

Two conditions must both hold for the tab to show: signed in **and**
`profiles.parents_mode` true. Until Parents Mode is enabled it is reachable
only via the header dropdown.

**Open UX question (not an AA item):** a Pro user who has never enabled Parents
Mode has no signpost to it in the tab bar. That is deliberate, but it is worth
asking whether the pinnacle feature of the product should be that quiet. Logged
for a product session, not changed inside an infrastructure merge.

---

# AA4 — Cron jobs

Capabilities verified against live Vercel documentation, 11 Aug 2026.

## 1. The finding this workstream actually produced

AA4 was scoped as "cron jobs". The question worth asking first was not _what
should we schedule_ but _what have we already promised that nothing performs_.

**AA4-D1 — Critical (compliance).** The Privacy Policy tells users "anonymous
usage counters roll off after 30 days" and that moderation reports are kept
"for up to 12 months". `legal/RETENTION-AND-BREACH.md` went further and stated
those buckets "roll off **automatically**".

**None of it was implemented.** Across 23 migrations there was no scheduled
job, no TTL, no trigger and no delete path. `anon_usage`, `usage_log`,
`feature_usage`, `reports` and `handle_reservations` accumulated indefinitely.
`anon_usage` rows are keyed on a **salted hash of an IP address**, so the
longest-lived of these was also the most sensitive.

Two distinct problems:

1. **Storage limitation** — Art. 5(1)(e) UK GDPR requires personal data be
   kept no longer than necessary. Indefinite retention of pseudonymous IP
   hashes is not defensible when the stated need is a 24-hour rate limit.
2. **Transparency** — Art. 13. A published privacy notice described deletion
   behaviour the system did not perform. The ICO treats an inaccurate notice as
   a compliance failure in its own right, independent of the underlying
   retention. This was, in my view, the more serious half.

This was found **before launch and before any real user data existed**, which
is the best possible time to find it.

## 2. Verified Vercel cron capabilities

| | Cron jobs per project | Minimum interval | Precision |
| --- | --- | --- | --- |
| Hobby | 100 | Once per **day** | ±59 min |
| **Pro** | **100** | **Once per minute** | **Per-minute** |
| Enterprise | 100 | Once per minute | Per-minute |

- **Cost:** cron jobs are included on all plans. They invoke a normal Vercel
  Function, so the only charge is that invocation. **One daily job is
  effectively free** and needs no AA8 provision.
- Vercel sends a **GET** to the production deployment; preview and development
  deployments are never invoked.
- Requests carry `vercel-cron/1.0` as user agent and an
  `x-vercel-cron-schedule` header.
- **Delivery is best effort.** Runs can be missed *and* can double-fire, so the
  work must be idempotent.
- **Cron jobs do not follow redirects** — a 3xx ends the invocation silently.
- Vercel **does not retry** a failed invocation.
- Instant Rollback does **not** revert cron configuration.

## 3. The fix

**`supabase/migrations/0024_retention_purge.sql`** — a `purge_expired_data()`
function, `SECURITY DEFINER` with a pinned `search_path`, `EXECUTE` revoked
from `public`/`anon`/`authenticated` and granted only to `service_role`:

| Table | Rule |
| --- | --- |
| `anon_usage` | `usage_date` older than 30 days |
| `usage_log` | `usage_date` older than 30 days |
| `feature_usage` | `usage_date` older than 30 days |
| `reports` | `status = 'reviewed'` and older than 12 months |
| `handle_reservations` | `reserved_until` in the past |

It returns a JSON row-count summary. Four supporting indexes were added,
because each purge filters on a column that is not the leading column of its
table's primary key and would otherwise sequential-scan.

**Open moderation reports are deliberately never deleted on a timer.** An
unresolved report is outstanding safeguarding work; expiring it automatically
would be the wrong trade against the OSA duties documented in
`legal/OSA-ILLEGAL-CONTENT-RISK-ASSESSMENT.md`. Instead the function *counts*
open reports older than 12 months and returns that figure, so a moderation
backlog surfaces in the logs rather than being silently aged out.

**`src/app/api/cron/purge/route.ts`** — verifies
`Authorization: Bearer $CRON_SECRET` and **fails closed**: if `CRON_SECRET` is
unset it returns 401 rather than treating `undefined === undefined` as a pass.
Capped at `maxDuration = 60`. Logs its row counts, which is the evidence that
the retention promise is being kept.

**`vercel.json`** — `"crons": [{ "path": "/api/cron/purge", "schedule": "0 3 * * *" }]`.
Daily at 03:00 UTC. Idempotent by construction, so the double-fire and
missed-run cases the docs warn about are both safe.

**Tests — 7 new (243 total).** Four cover authorisation alone, including the
fail-closed case, because this endpoint deletes data and its auth *is* its
security model.

**Documents corrected.** `legal/RETENTION-AND-BREACH.md` now describes the real
mechanism and carries an explicit **correction of record** stating that the
previous "roll off automatically" claim was untrue and when it was fixed. That
is deliberate: a controller who can show they found and remedied a gap is in a
far better position than one whose documents were quietly edited.

## 4. ⚠️ Two manual steps — the fix is INERT without both

Deploying the code alone does nothing. Both of these are required:

1. **Apply migration `0024_retention_purge.sql`** in Supabase → SQL Editor.
2. **Add `CRON_SECRET`** in Vercel → Settings → Environment Variables
   (Production), a random string of 16+ characters, then redeploy.

Until both are done the job runs and returns 401 or 500 — it fails safely and
deletes nothing, but the retention gap remains open.

## 5. Interaction with the firewall (AA2)

The live rule matches `/api/breakdown`, `/api/navigate` and `/api/pick`, so it
does not touch `/api/cron/purge`. **But AA2 §4's proposed B2 rule — "everything
else under `/api/`" — would.** If B2 is ever enabled, `/api/cron/` must be
added to the bypass list in AA2 §5 alongside the Stripe webhook, or the
retention job will be throttled by our own WAF.

## 6. Deliberately not scheduled

Nothing else in this app needs a cron:

- **Daily quotas** reset by date arithmetic (`usage_date = current_date`), not
  by a job.
- **Trial expiry and subscription state** are driven by Stripe webhooks.
- **No digests or reminder emails exist**, and adding scheduled email would be
  a product and PECR-consent decision, not an infrastructure one.

## 7. How to test AA4

```bash
npx vitest run src/lib/__tests__/cron-purge.route.test.ts   # expect 7 passed
```

- **Auth, against production** (after `CRON_SECRET` is set):
  `curl -i https://adhvtool.com/api/cron/purge` → **401**. Anything else is a
  serious defect — report it immediately.
- **Authorised run:**
  `curl -H "Authorization: Bearer $CRON_SECRET" https://adhvtool.com/api/cron/purge`
  → 200 with a row-count summary.
- **Idempotency:** run it twice. The second run must return 200 with zeroes,
  not an error.
- **Scheduling:** Vercel → Settings → **Cron Jobs** → the job should be listed;
  **View Logs** after 03:00 UTC shows the invocation and its counts.

## 8. Deployed and verified — with live evidence the gap was real

Verified against production on 11 Aug 2026:

| Test | Result |
| --- | --- |
| No `Authorization` header | **401** |
| Wrong secret | **401** |
| Correct secret without the `Bearer` prefix | **401** |
| Correct secret | **200** |

The first authorised run returned:

```json
{ "anon_usage": 4, "feature_usage": 12, "usage_log": 0,
  "reports_reviewed": 0, "handle_reservations": 0,
  "reports_open_over_12m": 0 }
```

**Sixteen rows of genuinely expired data were deleted**, four of them
`anon_usage` rows — salted IP hashes older than 30 days that the Privacy
Policy already told users had been removed. AA4-D1 was not a theoretical
finding; there was real personal data sitting past its stated retention.

A note on the deployment itself: the first attempt **failed the build** because
the pasted `CRON_SECRET` carried a trailing newline, and Vercel rejects
whitespace in a value destined for an HTTP header. Worth recording as a
positive — the platform refused to ship a broken configuration, and a failed
build never replaces the running deployment, so production was untouched
throughout.

---

# AA5 — Observability

## 1. Audit: does the ROPA's claim about logs hold?

`legal/ROPA.md` states error logs "contain no PII or content". Given AA4 had
just disproved a comparable claim, it was worth testing rather than assuming.

**It holds.** Reviewed all 35 `console.*` call sites:

- Every one logs a **fixed string** plus either `error.message` (a Supabase
  error) or a caught exception. None logs a parsed request body, query, email
  or user id — verified by pattern search, not by reading alone.
- The highest-risk site was `console.error("navigate generate failed:", err)`,
  where `err` comes from the Gemini SDK — if that error carried the request, it
  would log the user's free-text problem description, which is about as
  sensitive as this app gets. **It does not.** `@google/genai`'s `ApiError`
  declares exactly two fields, `message` and `status`. No payload.

**Two narrow residual paths**, recorded for honesty rather than as defects:

1. A Stripe validation error can quote the offending value, so a malformed
   email could appear in a message at `checkout/route.ts:78`.
2. A Postgres unique-violation message can include the conflicting key, so a
   username could surface via `error.message`.

Both are edge cases in error paths, not systematic logging of personal data.
Vercel log retention is short and the logs are access-controlled. **No change
made** — the accurate description is "no systematic PII in logs", which is what
the ROPA already conveys.

## 2. AA5-D1 — High: nothing tells you when the app breaks

This is the finding that matters, and it is an operational one rather than a
code defect.

**If checkout fails at 02:00, nothing alerts anyone.** You would learn about it
from a customer email, or not at all. Specifically, today:

| Signal | Status |
| --- | --- |
| Uptime monitoring | **none** |
| Error alerting | **none** — no Sentry or equivalent |
| Product analytics | **inert** — PostHog has no key (AA1-D2), every `capture()` is a no-op |
| Vercel Observability | included on Pro, but **pull-only** — it shows you things when you go and look |
| Stripe webhook failures | Stripe emails after repeated failures — the one alert that does exist |
| Spend alert | Vercel default, **$200/cycle** |

For a solo operator this is the difference between a ten-minute outage and a
weekend one. It matters much more once real payments are flowing.

## 3. The fix: `/api/health`

Added `GET /api/health` — a machine-readable liveness check for an external
monitor.

**Why not just ping `/`:** the marketing page is statically generated and
served from the CDN. It will happily return 200 long after the database has
gone away and every signed-in user is broken. `/api/health` deliberately
exercises the path that actually matters — function → Supabase — using a
head/count query that reads **no rows and no user content**.

Design decisions worth stating:

- **Returns 503, not 200, when unhealthy.** Uptime monitors alert on status
  code. A health check that returns 200 with `{"status":"error"}` never pages
  anybody. There is a test pinning exactly this.
- **Says as little as possible.** No version, no environment, no error text. It
  is unauthenticated by necessity — a monitor cannot sign in — so it must not
  become a reconnaissance endpoint. A test asserts the database error string
  never reaches the response body.
- **`no-store`.** A cached 200 during an outage would actively hide it.
- Capped at `maxDuration = 10`.

5 tests added (**248 total**).

## 4. Cost position

**Recommended spend for AA5: £0.**

| Option | Cost | Verdict |
| --- | --- | --- |
| External uptime monitor (Better Stack / UptimeRobot free tier) | **free** | **Yes** — 5-minute checks on `/api/health` with email/SMS alerts |
| Vercel Observability (base) | included | Yes, already on |
| Stripe webhook failure emails | free | Yes — confirm they are enabled |
| Vercel spend alert | free | Yes — lower it from the $200 default |
| Observability Plus | $1.20/1M events | **No** — revisit near 10k MAU |
| Speed Insights | $10/mo | **Defer to AA6**, where it is actually needed |
| Sentry or similar | free tier exists | **Not yet.** Adds a processor to the ROPA and a DPA to accept, for value the health check plus Vercel logs already largely provide at this scale |

## 5. Dashboard actions for you

1. **Set up free uptime monitoring.** Better Stack or UptimeRobot → monitor
   `https://adhvtool.com/api/health` every 5 minutes → alert to your email and
   phone. This is the single highest-value item in AA5 and takes five minutes.
2. **Lower the Vercel spend alert** from $200 to something that would actually
   surprise you — $40–50 given a ~$20 baseline.
3. **Stripe → Developers → Webhooks** → confirm failure notifications are
   enabled and pointed at an inbox you read.
4. **PostHog remains inert.** That is an AA7 decision (it needs a key *and*
   PECR consent gating first), not something to switch on casually.

## 6. How to test AA5

```bash
npx vitest run src/lib/__tests__/health.route.test.ts   # expect 5 passed
curl -i https://adhvtool.com/api/health                 # expect 200 + {"status":"ok","db":true}
```

The meaningful test is the failure case, and it cannot be safely simulated in
production. It is covered by unit test instead: when the database check fails
the endpoint must return **503**, and the error text must not appear in the
body.

---

# AA6 — Performance & caching

Measured from a real production build, not estimated.

## 1. AA6-D1 — Medium: `/login` was the heaviest page in the app

| | Before | After |
| --- | --- | --- |
| Page JS | 66.5 kB | **2.32 kB** |
| First Load JS | 172 kB | **108 kB** |

`/login` was **40 kB heavier than any other page** — heavier than `/parents`
(130 kB), which contains an entire feature suite. It is also the first page a
new user ever loads, and the one standing between them and an account.

**Cause:** `import { createSupabaseBrowser } from "@/lib/supabase/client"` at
module scope. The function is only *called* inside `onSubmit`, but a static
import bundles the whole Supabase browser client into the initial payload
regardless. 66.5 kB of JavaScript downloaded, parsed and executed by every
visitor, to support an action most of them take once.

**Fix:** moved to a dynamic `await import(...)` inside `onSubmit`. The client
now loads only when the form is actually submitted — by which point the user
has typed an email address, and a chunk fetch is invisible next to the auth
round trip that follows it.

Two details worth noting:

- The email check moved **above** the import, so an empty submission no longer
  triggers a network fetch at all.
- A `try/catch` was added around the whole block. A dynamic import can fail
  (offline, or a deploy landing mid-session); without it the form would sit on
  "Sending…" forever with no way out. This is the failure mode dynamic imports
  usually introduce and it is worth pre-empting rather than discovering.

`/login` is now in line with every other page in the app.

## 2. Audits passed — no action needed

**Fonts: correct.** `layout.tsx` uses `next/font/google` for Fraunces and
Inter, which **self-hosts at build time** rather than requesting from Google's
CDN at runtime. Three consequences, all good: no third-party request on page
load (so no `font-src` CSP exception needed, and none is present), no
layout shift from late font swap, and no data sent to Google on every visit —
which also keeps a processor off the ROPA.

**Static asset caching: correct.** Verified live:

```
GET /_next/static/chunks/webpack-*.js
Cache-Control: public, max-age=31536000, immutable
```

One year, immutable — the correct answer for content-hashed build output.
Nothing to tune.

**Shared bundle: healthy.** 103 kB First Load JS shared across all routes, of
which 54.2 kB is the React runtime. That is a normal, unremarkable figure for
a Next.js 15 app and not worth chasing.

**Service worker: sound.** Cache-first for immutable build assets,
network-first for navigations with a cached fallback, network-only for
`/api/` and `/auth/` — correctly never serving stale API data (re-confirmed
from AA1).

## 3. Observations recorded, deliberately not changed

**Middleware is 90.5 kB and runs on every request.** It is the Supabase SSR
client, and it is there to call `getUser()`, which *validates* the JWT against
the auth server. The cheaper `getSession()` only reads the cookie and trusts
it. Trimming this would mean weakening authentication to save a cold start —
a bad trade, and precisely the kind of "optimisation" that becomes a security
incident. **Left alone deliberately.** Now that functions run in `lhr1`
alongside the database (AA3), the call it makes is a local hop rather than a
transatlantic one, which is where the real cost was.

**Most pages are `force-dynamic`.** Static: `/`, `/login`, `/privacy`,
`/terms`, `/guidelines`, `/accessibility`, `/_not-found`. Everything else
renders per request. Some — `/toolkit` and `/pricing` — plausibly could be
static with client-side personalisation, which would cut a function invocation
per visit.

**Not changed**, for two reasons: the saving is negligible at current traffic,
and changing a page's rendering mode risks silently breaking the personalised
elements (plan badges, signed-in state) in ways a build cannot catch and I
cannot verify without a browser. That is the same class of blind spot that
produced the modal bug. Worth revisiting in a session where the UI can be
checked directly.

## 4. Cost position

**Recommended AA6 spend: £0** — for now.

**Speed Insights ($10/mo per project)** is the one paid item genuinely worth
considering here, because Core Web Vitals from real users cannot be inferred
from a build report or synthetic test. My recommendation is unchanged from
AA1: **not yet**. There is no traffic to measure. Revisit once marketing
starts and the numbers would actually inform a decision — the `/login` fix
above was found from a free build report, which is where the obvious wins are
at this stage.

## 5. How to test AA6

```bash
npm run build
```

- `/login` must report roughly **2.3 kB / 108 kB**, not 66.5 kB / 172 kB. If it
  regresses, something has re-imported the Supabase client at module scope.
- **Behavioural check that matters:** on production, load `/login`, enter a
  real email, submit. The magic link must still arrive. The code-split changes
  *when* the Supabase client loads, so this is worth confirming once by hand —
  a passing build does not prove the auth flow still works.

---

# AA7 — Growth infrastructure

## 1. AA7-D1 — High: no `robots.txt`, no `sitemap.xml`

Both returned **404** in production. For a product days away from marketing,
that is a straightforward discovery gap:

- Search engines had **no map of the site** at all.
- With no `robots.txt`, crawlers default to indexing everything — including
  the ~16 signed-in routes that 307 to `/login`. Crawl budget spent on
  redirects, and a real risk of a login page ranking instead of the product.

**Added `src/app/robots.ts` and `src/app/sitemap.ts`** (Next.js App Router
conventions — statically generated, zero runtime cost).

### The trap in this change, and why there is a test for it

The obvious `robots.ts` disallows `/api/` wholesale. **That would have broken
every social share preview.**

The share cards — `/api/og`, `/api/icon`, `/api/wins-card` — live under
`/api/`. Twitterbot and several other social crawlers **respect `robots.txt`
when fetching `og:image`**. A blanket disallow would have stopped link
previews rendering on Twitter, WhatsApp and Discord: the exact viral loop AA2
§5 identifies as the growth mechanism.

Nothing would have errored. Shares would simply have stopped showing an image,
and nobody would have connected that to a `robots.txt` edit weeks earlier.

The file therefore carries three explicit `allow` entries that beat the
general disallow by longest-match, and
`src/lib/__tests__/robots-sitemap.test.ts` fails loudly if any of them is ever
removed. **This is the kind of change that only bites months later, which is
precisely why it needs a test rather than a comment.**

Other decisions:

- `sitemap.xml` lists **only routes verified to return 200 anonymously**: `/`,
  `/app`, `/toolkit`, `/pricing`, `/guidelines`, `/accessibility`, `/privacy`,
  `/terms`. A sitemap containing redirects or 404s devalues the whole file.
- `/app` **is** listed. It works without an account, so it is a genuine entry
  point, not a gated page.
- `/login` is **not** listed — no search value, and it would compete with the
  landing page on brand queries.
- `/welcome` is excluded and disallowed: transactional, and it carries a
  checkout session id.
- Non-production deployments disallow everything, reinforcing the AA1
  `X-Robots-Tag: noindex` header. A preview URL entering an index is painful
  to reverse, so it is worth defending twice.

9 tests added (**257 total**).

## 2. Audit passed: the sharing surface works

`GET /api/og` → **200**, `Content-Type: image/png`,
`Cache-Control: public, immutable, max-age=31536000`. Full Open Graph and
Twitter card metadata present and pointing at the production domain. The
viral loop is intact — it just needed protecting from the robots.txt change
above.

## 3. Analytics: the honest position

**PostHog remains inert and I am not switching it on.** This is not an
oversight, so it is worth setting out the reasoning.

Enabling it is not a config change. Under **PECR** (the UK's cookie rules,
which sit alongside UK GDPR), analytics storage is **not** "strictly
necessary", so it requires **opt-in consent before it fires** — not a banner
that assumes consent, and not legitimate interests. Doing it properly means:

1. a consent UI,
2. persisting the choice,
3. initialising PostHog **only after** consent,
4. honouring withdrawal,
5. adding PostHog to `legal/ROPA.md` and the Privacy Policy as a processor,
   and accepting their DPA.

There is also a product cost that is specific to this app: **a consent banner
is friction on first load, for an audience whose defining difficulty is
starting things.** ADHV's landing page exists to get someone from "I can't
start" to a first step in seconds. A modal asking about cookies is precisely
the wrong first interaction.

**Recommendation:** treat analytics as a deliberate product decision, not an
infrastructure switch. If measurement is needed at launch, a **cookieless,
consent-exempt** approach (aggregate, no per-user identifiers, no persistent
storage) gets most of the value without a banner. That is a design
conversation worth having properly rather than a toggle to flip during an
infrastructure phase.

**Nothing was changed. Every `capture()` call remains a no-op.**

## 4. Kill switch: you already have one

AA2 raised feature flags and kill switches, and AA1 costed Vercel's **Flags
Explorer at $250/mo** (rejected) with Edge Config as the cheap alternative.

**Neither is needed.** The Vercel **Firewall** already provides an instant
kill switch: a custom rule denying `/api/breakdown` (or any path) takes effect
**without a redeploy** and can be reverted just as fast. If Gemini costs spike
or the model starts misbehaving at 2am, the response is a dashboard rule, not
a deployment.

Building an Edge Config flag layer would add a lookup to every AI request to
duplicate a capability already paid for. Recorded here so it is a considered
decision rather than an omission.

## 5. Referral mechanics: already built

The influencer growth path exists and needs no infrastructure work: Stripe
**promotion codes** (one per creator, 10% off, validated server-side in
`/api/checkout`), with `legal/AFFILIATE-TERMS.md` covering the commercial
relationship. Adding a creator is a Stripe dashboard action.

## 6. Cost position

**Recommended AA7 spend: £0.** Flags Explorer rejected ($250/mo — the
firewall already does the job). PostHog deferred on legal and product grounds,
not cost.

## 7. How to test AA7

```bash
npx vitest run src/lib/__tests__/robots-sitemap.test.ts   # expect 9 passed
```

After deploy:

```bash
curl -s https://adhvtool.com/robots.txt     # expect Allow: /api/og ...
curl -s https://adhvtool.com/sitemap.xml    # expect 8 <url> entries
```

- **The check that actually matters:** paste an ADHV link into WhatsApp or
  Discord and confirm the preview card still renders an image. That proves the
  `/api/og` allow is doing its job, and it is not something a unit test can
  demonstrate.
- Google Search Console: submit `https://adhvtool.com/sitemap.xml` once the
  domain is verified.

---

# AA8 — Cost control & unit economics

Prices verified against live Google AI pricing documentation, 11 Aug 2026.

## 1. Inputs

| | Figure |
| --- | --- |
| Gemini 2.5 Flash input | **$0.30** / 1M tokens |
| Gemini 2.5 Flash output | **$2.50** / 1M tokens (thinking included; `thinkingBudget: 0`, so none is generated) |
| Tokens per breakdown — input | ~1,000 (system prompt + user task, capped at `MAX_INPUT_CHARS = 500`) |
| Tokens per breakdown — output | ~450 typical, **2,048 hard ceiling** (`maxOutputTokens`) |
| Pro price | £7.99/mo · £59/yr |
| Stripe UK fee | ~1.5% + 20p |

**Cost per breakdown:** ~**£0.0011** typical, ~**£0.0043** worst case.
**Net revenue per Pro month:** £7.99 − £0.32 = **£7.67**.

## 2. The healthy news: margins on genuine use are excellent

A heavy genuine user doing **20 breakdowns a day** (already far beyond
plausible — most people break down a handful of tasks) costs:

| | Monthly AI cost | Gross margin |
| --- | --- | --- |
| Typical output length | **£0.66** | **91%** |
| Worst-case output length | £2.58 | 66% |

**Break-even is ~232 breakdowns/day** at typical token counts, or ~59/day at
the absolute worst case. No real person approaches that.

Fixed costs are ~$20/mo (Vercel Pro; Supabase, Resend and Google all within
free tiers at present) plus £52/yr ICO. **Roughly three Pro subscribers cover
the entire infrastructure bill.**

## 3. AA8-D1 — Medium (commercial): the adversarial ceiling

Pro is sold as **"Unlimited breakdowns & focus sessions"** (landing page and
`PricingCards`), and the code honours that literally: `identity.plan === "pro"`
sets `limit: Infinity`. The **only** ceiling is `BURST.breakdown = 8/min`.

Sustained, that is 11,520 calls/day — **345,600/month from one subscription**:

| | Cost to you | Revenue | Multiple |
| --- | --- | --- | --- |
| Typical tokens | **£380/mo** | £7.99 | **48×** |
| Worst-case tokens | **£1,486/mo** | £7.99 | **194×** |

**The sharper version is the free trial.** `TRIAL_DAYS = 7` with unlimited
access and no daily cap: 80,640 calls before a penny is charged —
**£89–£347 of Gemini spend for £0 revenue**, then cancel.

**Mitigating factors, stated honestly so this is not overblown:**

- Stripe Checkout collects a **card** even for a trial, so an abuser is
  identifiable and chargeable. That is real friction, not none.
- This requires deliberate scripting. It is not something a real user drifts
  into.
- At current traffic the expected loss is **£0**.

It is a tail risk, not a present bleed — but it is uncapped, and uncapped tail
risks are worth closing *before* the marketing push rather than during it.

## 4. What I did, and what I deliberately did not

**Did not: add a daily cap on Pro breakdowns.** It is the obvious fix and I am
not doing it unilaterally, because **your public pricing says "unlimited"**.
Quietly capping it would make a published commercial promise untrue — exactly
the failure mode AA4 found in the retention schedule, pointing the other way.
If the marketing says unlimited, either the product is unlimited or the
marketing changes. That is your call, not mine.

**Your Terms already cover you contractually.** Section 8 prohibits using
"automated tools to bulk-generate AI content" and reserves the right to
"restrict features, or suspend or close an account". Section 9 discloses that
per-minute limits apply. So enforcement against a scripted abuser is already
supported — **the gap was detection, not permission.**

**Did: close the detection gap.** `consumeFeature` returns early for Pro
("Pro users skip counting"), so no daily quota rows exist for them. But
`checkBurst` runs for **every** caller including Pro, writing to
`feature_usage` under `burst:<name>:<minute>`. The data has been accumulating
since launch; nothing had ever read it.

`0025_ai_usage_report.sql` adds `ai_usage_report()`, called by the existing
daily cron so it costs no extra invocation. Each night the logs now carry:

```json
{"window_days":1,"total_ai_calls":N,"distinct_subjects":N,
 "max_calls_one_subject":N,"subjects_over_200_calls":N}
```

**It deliberately returns no identifiers.** `subject` holds `user:<uuid>` or
`ip:<hash>` — both pseudonymous personal data — and this output goes to Vercel
logs, which `legal/ROPA.md` states contain no PII. Aggregates keep that
statement true. `max_calls_one_subject` is enough to tell you something is
wrong; identifying who is a deliberate second step (query in §7).

A reporting failure returns 200 and `usage: null` — the retention purge is the
job that must not be missed, and a cosmetic fault must not make a compliance
run look failed. There is a test for that.

## 5. Decisions for you

1. **Set a Google Cloud billing budget and alert.** This is the actual hard
   stop and the single most important item in AA8. Everything above only
   *tells* you; a budget alert bounds the damage. Suggested: alert at £25 and
   £50/month on the Gemini project. **£0, five minutes, do it before launch.**
2. **Consider `BURST.breakdown: 8 → 4`.** No human produces 8 breakdowns a
   minute; 4 still allows one every 15 seconds. It halves the adversarial
   ceiling and does **not** contradict "unlimited" — per-minute limits are
   already disclosed in Terms §9. Not changed unilaterally because it is
   user-facing behaviour I cannot test in a browser.
3. **Decide the "unlimited" position deliberately.** Either keep it as a
   genuine promise backed by the abuse clause and monitoring, or add a
   fair-use cap *and* update the landing page and `PricingCards` copy in the
   same change. Both are defensible; a mismatch between them is not.
4. **Lower the Vercel spend alert** from the $200 default to ~$40.

## 6. Cost position

**Recommended AA8 spend: £0.** Every control above is free. The paid options
considered and rejected across Phase AA — Password Protection ($150/mo), SAML
($300/mo), Flags Explorer ($250/mo), Observability Plus, Speed Insights
($10/mo, deferred) — total **$710/mo avoided** against a ~$20/mo actual bill.

## 7. How to test AA8

```bash
npx vitest run src/lib/__tests__/cron-purge.route.test.ts   # expect 9 passed
```

Apply `0025_ai_usage_report.sql`, then:

```sql
select public.ai_usage_report(1);   -- expect aggregates, no identifiers
```

**If `max_calls_one_subject` ever looks alarming**, identify the account
ad-hoc — deliberately not part of the automated job:

```sql
select subject, sum(count) as calls
  from public.feature_usage
 where usage_date > current_date - 1
   and feature like 'burst:%'
 group by subject
 order by calls desc
 limit 10;
```

`subject` is `user:<uuid>` (join to `auth.users`) or `ip:<hash>`.

---

# AA9 — Final regression & GO/NO-GO

Run 11 August 2026.

## 1. AA9-D1 — High (process): the CI gate was red, and nobody knew

The final pass ran the CI workflow's steps individually rather than trusting
that they passed. **Two of the eight were failing on `main`.**

**(a) `npm audit --audit-level=critical` exited 1.** `vitest <=3.2.5` carries a
**critical** advisory — arbitrary file read and execution when the Vitest UI
server is listening. Dev-only, and the UI is never run here, so real exposure
was nil. But it made the audit step permanently red.

**Fixed:** vitest `2.1.9 → 4.1.10`. All 270 tests pass unchanged — the suite
only uses `vi.hoisted`, `vi.mock` and the standard assertions, which are stable
across those majors. Criticals **1 → 0**; total advisories **11 → 6**.

**(b) `crisis-routing-adversarial.ts` exited 1** on a case its own label
described as a `KNOWN LIMITATION`. The failing case is a false **positive** —
the gate fires on *"I want to die of embarrassment"* — which is the safe
direction of error.

**I did not loosen the crisis regex to make it pass.** Allowing "want to die"
through would risk a false **negative** on someone who means it. That trade is
not acceptable in this product, and it is worth being explicit that the fix was
to the *reporting*, never to the detection.

**Fixed:** an explicit `known` flag. Accepted false positives are printed and
counted but do not fail the build; a false negative still does. The script also
now flags a `known` case that starts *passing*, so it cannot silently go stale.

**Why this mattered more than either bug:** a gate that is permanently red is a
gate nobody reads. Both failures were individually harmless; the habit they
create is not.

## 2. Deliberately not fixed: the remaining `high` advisories

`next@15.5.22` is flagged high via transitive `postcss` and `sharp`. The
available fix is **Next 16 — a framework major**.

**Assessment: no realistic attack path in this app.**

- The codebase imports `next/image` **zero times**. `sharp` is pulled in for
  image optimisation that is never invoked, so the libvips CVEs have nothing to
  process.
- The `postcss` advisories are build-time and require attacker-controlled CSS
  or `sourceMappingURL`. No user supplies CSS to this project.

A framework major upgrade days before launch risks considerably more than it
protects. **Revisit post-launch**, deliberately, with time to test.

## 3. Full CI gate — green

| Step | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run format:check` | 0 |
| `npm test` (270 tests, 18 files) | 0 |
| `npm run build` | 0 |
| `scripts/parsecheck.ts` (38 checks) | 0 |
| `scripts/crisis-routing-adversarial.ts` (22 pass, 0 fail, 1 accepted) | 0 |
| `npm audit --audit-level=critical` | 0 |

## 4. Production verification

**Routes** — all correct, no `X-Vercel-Mitigated` anywhere:

| Result | Routes |
| --- | --- |
| 200 | `/`, `/app`, `/pricing`, `/toolkit`, `/login`, `/privacy`, `/terms`, `/guidelines`, `/accessibility`, `/welcome` |
| 307 (auth redirect) | `/activity`, `/parents`, `/account` |
| 404 | unknown paths |

**Phase AA surfaces:** `robots.txt` 200 · `sitemap.xml` 200 (8 entries) ·
`/api/health` `{"status":"ok","db":true}` · `/api/og` 200 image/png ·
`/api/cron/purge` **401** to anonymous · manifest 200 · `sw.js` 200.

**Security headers:** CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy,
Permissions-Policy all present. **No `X-Robots-Tag`** (production stays
indexable). No `x-powered-by`.

**Money path:** `POST /api/webhooks/stripe` unsigned → **400**. Signature
verification intact — the single most important regression check.

**🔴 Crisis-safety invariant, verified live in production:**

```
POST /api/navigate  {"query":"i want to end my life"}
→ {"crisis":true,"message":"... call Samaritans free, any time, on 116 123.
   If you're in immediate danger, call 999."}
```

Deterministic, before any AI call, with a benign control query routing normally
to `/app`. **This is the invariant that matters more than every other line in
this report, and it holds.**

## 5. What I could NOT verify

Stated plainly, because an unverified claim is worse than a known gap:

| Not verified | Why it matters |
| --- | --- |
| **The magic-link login flow end to end** | AA6 changed *when* the Supabase client loads on `/login`. The page renders and 270 tests pass, but nothing here exercises click → `signInWithOtp` → inbox |
| **Social share previews** | The `robots.txt` OG allowlist is unit-tested, but only pasting a link into WhatsApp proves a crawler renders the card |
| **Any real payment** | Stripe is still in sandbox |
| **Visual/browser behaviour generally** | A structural blind spot in my tooling that has already cost one shipped bug (the modal). Every UI claim in this report rests on build output and unit tests, not on a rendered page |

## 6. GO / NO-GO

### The app: **GO**

Deployed, verified, safe. Nine workstreams complete, defects found and fixed,
CI green, the crisis invariant proven in production.

### Taking money: **NO-GO** — three gates

1. **🔴 Stripe live cutover is incomplete.** Blocked on 2FA (support ticket
   open). No live keys, no live prices, no verified payment.
2. **🔴 Price mismatch.** The site advertises **£9.99/£99**; Stripe still holds
   **£7.99/£59** sandbox prices. Nobody can be wrongly charged today because
   sandbox takes no real money — but going live without reconciling these would
   charge a price the site does not advertise.
3. **🔴 The real payment test has not run.** Test mode passing does not prove
   live mode works: different keys, different webhook secret, a real card, real
   3-D Secure.

### One open question that could be a compliance gate

**Which Gemini tier is the API key on?** On the **free** tier Google may use
submitted data to improve their models — and the Privacy Policy and Terms §6
both state content is *never* used to train AI models. If the key is on the
free tier, that statement is untrue and must be fixed **before** launch, not
after. This is a five-minute check at `aistudio.google.com` and it outranks
every other outstanding item except Stripe.

### Recommendation

Do not announce or send creator codes until gates 1–3 close and the Gemini tier
is confirmed. Everything else outstanding — uptime monitoring, billing alerts,
preview protection, branch protection — is hardening that improves the odds but
does not gate a launch.
