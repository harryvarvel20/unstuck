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
