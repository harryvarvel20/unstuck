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
