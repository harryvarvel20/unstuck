# ADHV — Phase X Summary & Go/No-Go

**Branch:** `phase-x-harden-refinish` (not merged — awaiting your approval)
**Workstreams:** X1 security · X2 testing · X3 code health · X4 redesign ·
X5 regression. Full detail in the four sibling reports in `/reports`.

---

## Recommendation: **GO** — proceed to the strip-and-vertical work.

Conditional on running the browser-only verification passes (below) against
a Vercel preview before the app is put in front of real users. **None of
those block the strip-and-vertical development work** — they're launch-gate
checks, not code blockers, and the logic base they'd run against is proven
correct.

---

## Findings by severity (across all workstreams)

| Severity | Found | Fixed | Ticketed |
|---|---|---|---|
| **Critical** | 0 | — | — |
| **High** | 2 | **2** | 0 |
| **Medium** | 5 | 4 | 1 |
| **Low** | 6 | 3 | 3 |
| **Info** | 6 | 3 | 3 |

**The two High findings** (single-report content auto-suppression; no rate
limiting on any social/parents write route) were both fixed and are covered
by regression tests / live harness checks. Zero Critical. No security
regression from the redesign (X5 re-verified RLS 20/20 + all 6 headers).

## What was done

**X1 — Security.** Threat-modelled all roles; enumerated RLS on all 34
tables (all enabled; `SECURITY DEFINER` functions pin `search_path`);
line-by-line authz review of every social/parents route (the real gate,
since those use the service-role client); fixed the 2 Highs + 2
defence-in-depth items; added a full security-headers baseline (CSP/HSTS/
X-Frame/etc., verified live); proved cross-user isolation with a live
two-account harness (20/20); scanned full git history for secrets (clean);
`npm audit` triaged (dompurify fixed; sharp/postcss dormant/unreachable —
`next/image` is never used).

**X2 — Testing.** Vitest installed; **44 unit tests** (timeline math,
crisis/safeguarding gates incl. injection-wrapped, pick, dopamenu); live DB
integrity audit (0 orphans, timestamps timezone-correct); migration `0020`
adds 6 secondary indexes; feature × role × state matrix.

**X3 — Code health.** ESLint + Prettier installed & configured (were
missing), all 7 lint errors fixed, tree formatted; confirmed baseline was
already strong (strict TS, **0 `any`**, **0 TODO**); 5 improvement proposals
documented for your sign-off (none applied without approval).

**X4 — Redesign.** Full "Old Money" re-skin (ivory/navy/aged-gold, editorial
serif, hairline gold, near-zero motion, gold "seal" replacing confetti),
light-default with an opt-in midnight variant. AA-verified token table.
Presentational only — no IA/flow/copy/routing change.

**X5 — Regression (this pass).** All green on the redesigned, refactored app:

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| ESLint | ✅ 0 errors, 0 warnings |
| Prettier | ✅ clean |
| Unit tests (Vitest) | ✅ 44/44 |
| Crisis-routing adversarial | ✅ 22/23 (the 1 is a safe-direction false positive) |
| `next build` | ✅ succeeds |
| Live RLS/IDOR isolation | ✅ 20/20 |
| Live DB integrity | ✅ clean |
| Security headers (live) | ✅ 6/6 present |
| Server-side gating (raw hits) | ✅ 401/402, never 500; public library 200 |

## Metrics — before → after Phase X

| Metric | Before | After |
|---|---|---|
| Automated tests | 0 (1 homegrown script) | 44 unit + 3 live/adversarial harnesses, all in CI |
| CI | none | typecheck + lint + format + test + build + audit on every push |
| ESLint / Prettier | not installed | installed, enforced, 0/0 |
| Security headers | 0 | 6 (CSP, HSTS, X-Frame, X-CTO, Referrer, Permissions) |
| Rate-limited write routes | 2 (AI only) | all social/parents writes |
| Explicit `any` / TODOs | 0 / 0 | 0 / 0 (held) |
| DB indexes | 22 | 28 (migration 0020) |
| Known npm advisories | 4 | 2 (both dormant/build-time-only) |
| Theme | dark jewel default | light "Old Money" default + midnight |

## Residual tickets (none are blockers)

**Must run before public launch (browser-only — cannot run in this env):**
- Playwright E2E across flows/breakpoints/roles + PWA install/offline.
- axe + manual a11y pass on every screen; Lighthouse ≥90 mobile+desktop.
- Before/after redesign screenshots (a Playwright script can capture these).
- DAST (OWASP ZAP) against the Vercel preview.

**Engineering backlog (proposed, awaiting your pick — CODE-HEALTH.md P1–P5):**
- Nonce-based CSP (drop `unsafe-inline`) — needs real-browser verification.
- Re-verify `/api/account/delete` cascades every Phase U/W table.
- Consolidate route `json()` boilerplate; generate Supabase types.
- Collapse the challenges-GET N+1; per-route error boundaries + Sentry-style logging.
- Routine Next.js upgrade to clear the dormant sharp/postcss advisories.

**Migrations to apply** (idempotent, safe): `0020_x2_indexes.sql`.

## To reproduce the whole regression
```bash
git checkout phase-x-harden-refinish
npm ci
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
node scripts/rls-isolation-harness.mjs        # 20/20, self-cleaning
node scripts/db-integrity-audit.mjs           # clean
node --experimental-strip-types scripts/crisis-routing-adversarial.ts
```

## Merge

Branch is ready to merge on your approval. Recommended sequence: review the
four reports → skim the redesign locally (light + toggle to midnight) → apply
migration 0020 → merge → deploy the Vercel preview → run the browser-only
gate checks above → then start strip-and-vertical.
