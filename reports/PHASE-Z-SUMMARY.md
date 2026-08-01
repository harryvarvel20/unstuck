# ADHV — Phase Z Summary & Launch Decision

**Branch:** `phase-z-final` (8 commits, pushed, **not merged**) · **Date:** 31 Jul 2026

# RECOMMENDATION: **GO for soft launch — with two non-negotiable gates**

The engineering is launch-ready: every automated and live suite is green, no
Critical or High technical defect is open, and the highest-risk area
(children's data) is now provably zero. The two gates below are **business/
legal actions only you can complete** — neither is a code problem.

**Gate 1 — ICO registration** (~15 min, ~£40–60/yr, legally required for a UK
business processing personal data). **Gate 2 — Vercel Pro + Stripe live
activation** (Hobby forbids commercial use; live payments need Stripe's
business verification, which has real lead time).

**Strongly advised before *marketing at scale*** (not a hard blocker for a
quiet soft launch — that's your risk call): a solicitor pass over Terms +
Privacy, the Article 9 (health data) question, and the Online Safety Act risk
assessments. See COMPLIANCE-REPORT.

---

## Final regression — everything green (31 Jul, post-all-changes)

| Suite | Result |
|---|---|
| Typecheck / ESLint / Prettier | clean |
| Unit + route tests | **205 passed / 12 files** (was 68 at Phase Y) |
| Production build | compiles |
| DB integrity audit (live) | **clean — no warnings** |
| RLS / IDOR harness (live, 2 accounts) | **20/20** |
| Activity two-account harness (live, real HTTP) | **65/65** |
| Playbook-copy check | **2/2** |
| Adversarial crisis-gate battery | **22/23** (the 1 miss is a false-*positive* — over-caution, safe direction) |

## What was broken, by severity — all fixed

| ID | Sev | Defect | Fix |
|---|---|---|---|
| Z1-D4 | **Medium (safety)** | `/api/social/assist` sent tone-guard text + playbook drafts to Gemini with **no deterministic crisis gate** (that prompt carries no crisis rule) | Gate added before any AI call on both kinds; regression-tested |
| Z3-D2 | **Medium (Children's Code)** | Kid-facing tools fired analytics **during child interaction** — `emotion_checked` telemetered the child's emotional state; 5 others similar | Every interaction event stripped from `kid/*`; only content-free `child_safety_routed` remains |
| Z3-D1 | Medium (missing feature) | The positivity engine (praise coach, Special Time, wins log) was **built but unreachable** — the real "Parents left blank" gap | Wired in as its own hub area, "Notice the good" |
| Z1-D1/D2 | Medium (tooling) | Both DB harnesses still referenced the dropped child tables — they'd have crashed; Phase Y objects untested | Rewritten; the audit now *asserts* child tables are gone (turns drift into a guard) |
| Z1-D3 | Low | AI step titles/tips skipped the sanitiser messages get | `sanitizeText` applied to all model-output paths |
| Z3-D3/D4 | Low | Device child-data survived sign-out/account-deletion; no one-tap erase | `clearAllParentsLocal()` on both + an erase control |
| Z4-D1 | Low (a11y) | Three header targets were 40px vs the 44px invariant | Bumped to 44px |
| Z7-D1 | Low | `handle_reservations` never purged expired rows (unbounded growth) | Opportunistic expiry purge in the rename path; harness self-cleans |

**Zero defects were found in the Activity Center product code** — Z2's 67
checks passed against the app as-built; the only fixes there were to my own
test fixtures.

## The child-data evidence (the thing you cared most about)

- **Server-side child data: none.** `children`, `kid_rewards`, `kid_wins`
  are dropped; the live audit **fails** if they ever return.
- Child nickname (optional, steered to "or leave blank"), age band, reward
  charts and the wins log live **only in the parent's browser**; cleared on
  sign-out, account deletion, remove-child, or one-tap erase.
- Nothing child-related reaches the AI (payload = age band + parent's own
  text), analytics (all kid-surface events removed), logs, or storage
  (parents-space photo uploads refused server-side, CI-tested).
- Full inventory table: `reports/PARENTS-REPORT.md` §1.

## Improvements shipped this phase

Test suite **68 → 205** including an 87-assertion sweep that fails CI if any
AI prompt ever loses its crisis/safeguarding rule; two durable live harnesses
(RLS + full Activity) that rerun the entire security and social battery in one
command; the positivity engine surfaced; 44px targets; expiry purging.

## Residual risks & open tickets (honest list)

1. **CSP still uses `'unsafe-inline'`** — graduating to per-request nonces
   needs browser-verified plumbing through Next's hydration scripts. High
   priority, post-launch. Not exploitable on its own; every other header is
   strict.
2. **Two dev-chain npm advisories accepted** (esbuild/vite dev-server, postcss
   inside Next's build chain) — neither reachable in production; breaking
   upgrades deferred to a scheduled bump.
3. **No Supabase staging project** — mitigated by synthetic self-cleaning
   accounts; worth creating before you have real users.
4. **Browser-only checks are yours**: Lighthouse/Core Web Vitals, axe, PWA
   install + offline on Windows/mobile, and the 390px feel. Everything
   code-verifiable is done.
5. **Owner dashboard items**: GitHub 2FA + branch protection + Dependabot;
   Supabase backup posture; processor DPAs.

## Before/after

| | Phase Y end | Phase Z end |
|---|---|---|
| Automated tests | 68 | **205** |
| Live security checks | 20 (RLS only) | **87** (RLS 20 + Activity 65 + copy 2) |
| Crisis-gate coverage | prompts by inspection | **CI-enforced across every builder + route gates** |
| Child data on server | already zero | zero **+ audit-guarded + analytics-clean** |
| Known open Critical/High | 0 | **0** |

## Merge

Nothing is merged. `phase-z-final` is pushed and ready; merge on your word
after you've run your own pass — the exact commands are in each report.
