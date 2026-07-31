# ADHV — Phase Z1 Test Report

**Branch:** `phase-z-final` · **Date:** 31 Jul 2026 · **Supersedes** the Phase X
version of this file.

**Verdict for Z1: PASS with documented gaps.** All automated suites green
(205 tests / 12 files), live DB integrity clean, RLS/IDOR harness 20/20,
4 defects found and fixed (each with a fails-before/passes-after regression
test). No known Critical or High defect open. Gaps that remain (Playwright
E2E, two-account social flows, offline/slow-network cells) are scheduled for
Z2 and listed in §6 — none of them blocks Z1 sign-off.

---

## 1. Feature inventory (every phase G→Y)

| # | Feature | Surface | Verification status |
|---|---|---|---|
| 1 | Breakdown (normal/smaller/subtask/rescue) | `/app`, `/api/breakdown` | Automated (parser, prompts, gating) + manual smoke on prod domain |
| 2 | Photo-to-plan | `/app`, `/api/breakdown/photo` | Prompt automated; flow manual (smoke, 28 Jul) |
| 3 | Morning landing | `/app` (AM) | Manual (smoke) |
| 4 | Evening wind-down | `/winddown` | Manual (smoke); prompt automated |
| 5 | Today timeline + deadline mode | `/today` | Timeline maths automated (10 tests); UI manual |
| 6 | Morning plan (brain dump) | `/plan` | Prompt + parser automated; UI manual |
| 7 | Routine builder | `/routines` | Prompt automated; UI manual |
| 8 | Regulate suite (cool-down / decompress / spiral) | `/regulate` | Prompts automated (crisis rule proven); UI manual |
| 9 | Dopamine menu | `/dopamenu` | 7 unit tests + prompt automated |
| 10 | SOS / Pick-for-me | `/app` | Pick logic 5 unit tests; UI manual |
| 11 | Idea Vault | `/ideas` | Prompt automated; UI manual |
| 12 | Impulse Pause | `/impulse` | Manual |
| 13 | Focus Profile | `/profile` | Prompt automated; UI manual |
| 14 | Connection | `/connect` | Prompt automated; UI manual |
| 15 | Focus Room (AI body double) | `FocusRoom` | Check-in prompts automated (4 phases); UI manual |
| 16 | Navigator (AI intent router) | `/toolkit`, `/api/navigate` | **Fully automated route suite** (10 tests) + catalog tests (5) |
| 17 | Activity Center: usernames | `/api/social/handle` | 19 validation unit tests + DB uniqueness/reservation harness proofs |
| 18 | Activity: wins feed + scopes | `/api/social/posts` | **Fully automated route suite** (13 tests) |
| 19 | Activity: comments + tone-guard | `/api/social/comments`, `assist` | Assist crisis gate automated (3 tests); comment flow Z2 |
| 20 | Activity: search | `/api/social/search`, `search_posts()` | Privilege lockdown proven live (harness); relevance/leak matrix in Z2 |
| 21 | Activity: DMs / boosts / status / challenges / buddy | `/api/social/*` | Code-reviewed (DM crisis delivery verified in source); two-account live test in **Z2** |
| 22 | Activity: block / report / mute | `/api/social/safety` | Code-reviewed (3-distinct-reporter auto-hide, viewability check); live test in Z2 |
| 23 | Parents Mode (zero-child-data, device-only) | `/parents` | Zero-child-data **proven live** (§4); full overhaul + test in **Z3** |
| 24 | Parents coach AI (5 kinds) | `/api/parents/coach` | Prompts automated (safeguarding rule proven); flows in Z3 |
| 25 | Auth (magic link) | `/login`, `/auth/*` | Manual (smoke, 28 Jul — Resend SMTP) |
| 26 | Paywall / billing / discount codes | `/pricing`, `/api/checkout`, webhook | **Fully automated route suite** (7 tests) + live test purchase (28 Jul) |
| 27 | Quotas & burst limits | `lib/quota` | Enforced in route tests (429 paths); live limit cells manual |
| 28 | PWA / offline / install | manifest, SW | **Pending** (Z7 checklist) |
| 29 | Landing site + OG + pricing page | `/`, `/pricing` | Manual (smoke); Lighthouse in Z7 |
| 30 | Crisis + safeguarding routing | every AI/free-text surface | **Automated: 87-assertion prompt sweep + route gates** (navigate, posts, assist) + DM source verify |

## 2. Test matrix — feature × role × state

Cell codes: **A** automated · **H** live harness · **M** manual verified (smoke
tests, 28–31 Jul) · **Z2/Z3/Z7** scheduled that workstream · — not applicable.

| Feature | Anonymous | Free | Pro | Parent |
|---|---|---|---|---|
| Breakdown happy path | M | M | M | — |
| Breakdown limit reached | A (429) | A (429) | A (unlimited) | — |
| Breakdown malformed AI output | A | A | A | — |
| Breakdown crisis input | A | A | A | — |
| Navigator (route/crisis/fallback/limits) | A | A | A | A |
| Checkout (code/no-code/invalid/already-pro) | — | A | A | — |
| Webhook → plan grant | — | — | M (live purchase) | — |
| Feed scopes (friends/public/just_me) | — | A (402) | A | A |
| Posting gates (handle/crisis/photo) | — | A | A | A |
| Parents space gating | — | A | A | A |
| Search privilege (user/anon revoked) | H | H | H | H |
| RLS cross-user isolation | H | H | H | — |
| Handle uniqueness + reservations | — | — | H | — |
| DMs / challenges / buddy end-to-end | — | — | **Z2** | — |
| Comments / reactions / reports live | — | — | **Z2** | — |
| Parents flows all 3 age bands | — | — | — | **Z3** |
| Empty states / error states per screen | **Z2/Z3** sweep | | | |
| Offline / slow network / PWA | **Z7** | | | |

## 3. Automated coverage — 205 tests, 12 files (all green, wired into CI)

| Suite | Tests | What it proves |
|---|---|---|
| `parseBreakdown.test.ts` **new** | 17 | Strict-JSON streaming: complete/partial/malformed/empty never throw; clamps; sanitisation (Z1-D3 regression) |
| `prompts-crisis.test.ts` **new** | 87 | EVERY AI prompt builder carries crisis (Samaritans) or safeguarding (Childline/NSPCC/999) rule, strict-JSON contract, zero-shame rule |
| `navigate.route.test.ts` **new** | 10 | Crisis/child-safety fire BEFORE the model; catalog-locked slugs; hallucination + garbage fallbacks; 429s |
| `checkout.route.test.ts` **new** | 7 | Server-side promo validation; discounts XOR allow_promotion_codes; **managed_payments disabled on every session**; already-pro 409 |
| `posts.route.test.ts` **new** | 13 | Y6 scopes enforced in the query itself; handle gate; parents-space 403/photo-strip/safeguarding; adult-confirm downgrade |
| `assist.route.test.ts` **new** | 3 | Z1-D4 regression: assist crisis gate before any AI call |
| `username.test.ts` | 19 | Y1 validation/normalisation/homoglyph/blocklists |
| `safety.test.ts` | 22 | Crisis/child-safety/abuse pattern behaviour |
| `navigator.test.ts` | 5 | Catalog ↔ real routes, prompt shape |
| `timeline.test.ts` | 10 | Reflow/deadline maths |
| `dopamenu.test.ts` / `pick.test.ts` | 12 | Course logic / pick-for-me |

CI: `.github/workflows/ci.yml` runs typecheck + lint + format + **all of the
above** + build + `npm audit` on every push — the new suites are included
automatically.

## 4. Database integrity (live, read-only) — CLEAN

`node scripts/db-integrity-audit.mjs` (31 Jul 2026):

- **Orphans/dangling FKs:** 0 across all 7 relationship paths.
- **Zero-child-data invariant PROVEN live:** `children`, `kid_rewards`,
  `kid_wins` all return PGRST205 (table gone) — migration 0023 applied.
- **Phase Y schema present:** `handle_key/handle_set/handle_changed_at`,
  `posts.space/search_doc`, `handle_reservations` all live (0021/0022 applied).
- **Timezone:** every sampled `created_at` is timestamptz (+00:00).
- **Row counts sane** (3 profiles, 5 tasks, 1 post — pre-launch scale).

`node scripts/rls-isolation-harness.mjs` — **20/20 PASS**, covering: cross-user
SELECT/UPDATE/DELETE/list isolation (tasks, ideas, private posts, social
profiles), anon zero-access, **handle uniqueness enforced at the DB (23505,
case-insensitive)**, **handle_reservations denied to authed users and anon
(42501)**, **search_posts() revoked for authed + anon (42501)**, and clean
cascade on account deletion.

## 5. Defects found in Z1 — all fixed, each with a regression test

| ID | Sev | What | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| Z1-D1 | Medium (tooling) | `db-integrity-audit.mjs` referenced dropped child tables → audit would fail/mislead | Script not updated with migration 0023 | Rewritten for current schema + now asserts the child tables are GONE (turns the old drift into a guard) | Script exits 1 on any warning; run in Z-gates |
| Z1-D2 | Medium (tooling) | `rls-isolation-harness.mjs` inserted into dropped child tables → harness would crash; Y1/Y5 objects untested | Same drift | Rewritten: child tables removed, added social_profiles isolation, handle-uniqueness race (23505), reservations lockdown, search_posts revocation | Harness exits 1 on any fail |
| Z1-D3 | Low (defence-in-depth) | Step titles/tips from the model skipped `sanitizeText` (messages didn't) — control chars/angle brackets could reach the DOM text | Inconsistent parser paths | `coerceStep` + `parseItemsArray` now sanitise titles/tips | `parseBreakdown.test.ts` "strips control characters…" (failed before, passes after) |
| Z1-D4 | **Medium (safety)** | `/api/social/assist` sent tone-guard text + playbook drafts to Gemini with **no deterministic crisis gate** (and the tone-guard prompt carries no crisis rule) — crisis text could reach the model from those two fields | Route predates the "every free-text field" rule audit | `containsCrisisLanguage` gate added before ANY AI call on both kinds; signpost returned; comment/post endpoints still re-check downstream | `assist.route.test.ts` (all 3; the first two fail against the old route) |

Also verified-not-defects: DM crisis handling (delivers + signposts sender — by
design), report auto-hide (3 distinct reporters + viewability check), webhook
signature verification (test purchase 28 Jul).

## 6. Known gaps & environment constraints (honest list)

1. **No Supabase staging branch** — branching isn't available on the current
   free plan. Mitigation used: the harness creates *synthetic, self-cleaning*
   accounts and the audit is read-only; neither touches real user rows. Options
   before launch: (a) accept this (DB is pre-launch, 3 profiles), or (b) create
   a second free Supabase project as staging and run migrations 0001–0023 there.
   **Decision needed from you in Z2.**
2. **Playwright E2E not yet installed** — planned as the backbone of Z2's
   two-account live test (390px + desktop + keyboard-only). Will run against a
   local dev server with the two synthetic accounts.
3. **Live AI adversarial script** (`crisis-routing-adversarial.ts`) not run in
   Z1 (hits the real Gemini API); scheduled with Z5's prompt-injection pass so
   adversarial phrasings are tested in one place.
4. **Offline / slow-network / PWA cells** — Z7 device checklist.
5. **Lighthouse / axe / Core Web Vitals** — Z7.

## 7. Z1 conclusion

Every automatable Z1 item is automated and green; live DB integrity and RLS
isolation are proven on the current schema including all Phase Y objects; the
zero-child-data invariant is now *evidenced by a failing-if-regressed audit*,
not just by code reading. Four defects (2 tooling, 1 hardening, 1 safety) were
found and fixed with regression tests. Ready for Z2 on your go-ahead.
