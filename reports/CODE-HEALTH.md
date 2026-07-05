# ADHV — Phase X3 Code Health Report

**Branch:** `phase-x-harden-refinish`

## Baseline — already strong (measured, not assumed)

| Metric | Before X3 | After X3 |
|---|---|---|
| TypeScript `strict` | ✅ on | ✅ on |
| `noUncheckedIndexedAccess` | ✅ on | ✅ on |
| Explicit `any` in `src/` | **0** | **0** |
| `TODO`/`FIXME`/`HACK` in `src/` | **0** | **0** |
| `@ts-ignore`/`@ts-expect-error` | **0** | **0** |
| ESLint | **not installed** | ✅ installed + **0 errors, 0 warnings** |
| Prettier | **not installed** | ✅ installed + **whole tree formatted** |
| Unit tests | 0 (one homegrown script) | **44 (Vitest) + 3 harness scripts** |
| CI | none | ✅ typecheck + lint + format + test + build + audit |

The pre-existing code quality was genuinely high — the meaningful gap was
**missing tooling** (ESLint/Prettier were never actually installed despite a
scaffold `lint` script), not messy code. That's now fixed and enforced in CI.

## Refactors / fixes applied (low-risk, internal only — no behaviour change)

1. **ESLint + Prettier installed and configured** (`.eslintrc.json`
   extending `next/core-web-vitals` + `next/typescript`, `.prettierrc.json`,
   `.prettierignore`); `format`/`format:check` scripts added; all wired into
   CI so regressions are caught on every push.
2. **Fixed all 7 ESLint errors** — unused imports/vars (`AgeBand`, `cycle`,
   `minutes` redundant state, `input`, two dead `signedIn` props) and one
   unescaped JSX entity. Each verified as safe:
   - The Dopamenu `minutes` state was **redundant** — the selected duration
     already flows to `/api/dopamenu/suggest` through a local variable at the
     call site, not this state. Removed the dead binding.
   - The `signedIn` prop on `SosButton`/`MorningLanding` was **dead** — both
     flows behave identically signed-in or anonymous (SOS is a safety tool
     that always works; the morning landing shows regardless), unlike sibling
     components that genuinely use it. Removed from the destructure.
3. **2 intentional `exhaustive-deps` patterns documented** with disable
   comments matching the codebase's existing convention (the `appetiser`
   re-roll trigger; the mount-once `start()` callback) — rather than
   "fixing" them and changing behaviour.
4. **Prettier `--write`** across the tree as an **isolated commit** (so it
   doesn't pollute the X4 diff). Verified: tsc clean, 44/44 tests, build green.

## Architecture review — single-source-of-truth engines

The brief's concern ("consolidate reused engines so there's ONE source of
truth each") was checked and is **already satisfied** — the engines are
genuinely shared, not duplicated:

| Engine | Single source | Reused by |
|---|---|---|
| Timeline/scheduling | `src/lib/timeline.ts` | today, plan, TodayGlance |
| Cool-down/reset | `components/regulate/CoolDown.tsx` | Regulate, SOS, Parents Calm Corner + Parent SOS |
| Breakdown parsing | `src/lib/parseBreakdown.ts` | every streaming AI route |
| Crisis/safeguarding | `src/lib/safety.ts` | every free-text surface (adult + kid) |
| Gating/limits | `src/lib/quota.ts` | every gated route (+ the X1 social-write limiter added there) |
| Design tokens | `src/app/globals.css` + `src/lib/design.ts` | app-wide |
| Dopamenu | `src/lib/dopamenu.ts` | Dopamenu + Parents Boost menu |

The duplication that *does* exist is trivial boilerplate — each API route
re-declares a 5-line `json()` helper and `runtime`/`dynamic` exports.
Consolidating that is proposed below (not done pre-X4, to avoid a 40-file
churn colliding with the redesign).

## Performance snapshot (bundle)

Build is healthy. Shared First-Load JS baseline **~103 kB**; middleware
**90.5 kB**. Heaviest routes: `/activity` (14.2 kB route / 120 kB first
load — the Activity Center is the biggest client surface) and the home/app
route. No route is alarmingly large. The X4 redesign will **remove** the
animated gradient mesh + confetti-burst JS, which should shave client JS and
improve CLS/INP. Real Lighthouse/Core-Web-Vitals numbers need a browser and
are captured in X5's deferred list.

---

## Proposals awaiting your sign-off (NOT applied — these touch behaviour or are larger refactors)

Per the brief, anything that changes product behaviour is flagged, not
silently done:

### P1 — Consolidate route boilerplate (internal, low-risk, but 40+ files)
Extract the repeated `json()` responder + standard `runtime`/`dynamic`
exports into a shared `src/lib/http.ts`. Pure cleanup, no behaviour change,
but a big diff — **recommend doing it AFTER X4 merges** to avoid conflicts.
Effort: ~1h. Risk: low (mechanical).

### P2 — Generate Supabase types as the DB type source (internal)
Routes currently hand-write row interfaces (`ChildRow`, etc.). `supabase gen
types typescript` would make the DB the single type source and catch schema
drift at compile time. **Needs the Supabase CLI + project access** (not
available in this environment). Effort: ~1h once CLI access exists. Risk: low.

### P3 — Collapse the challenges-GET N+1 (perf, internal)
`GET /api/social/challenges` loops per challenge issuing ~4 queries each.
Fine at current scale, but could be one aggregate query per concern.
**Behaviour-preserving** but worth a careful rewrite + a regression test.
Effort: ~2h. Risk: medium (query-shape change — test coverage first).

### P4 — Decide a convention for the two Supabase-client patterns (process)
Routes use either `getServiceClient()` (RLS bypassed — app code is the gate)
or `createSupabaseServer()` (RLS is the gate). Both are correct where used,
but mixing them risks a future accidental swap silently removing a route's
only protection (see SECURITY-REPORT.md). Propose: a short code-comment
convention + optionally a custom lint rule. No behaviour change.

### P5 — Standardise error handling + add error boundaries (reliability)
The brief wants an `error.tsx` boundary on every route + structured logging
(Sentry-style). Currently there's a global `error.tsx`/`global-error.tsx`
but not per-route boundaries, and logging is `console.error`. This is a real
reliability improvement but is **net-new surface**; propose scoping it as its
own small phase after X (with your choice of error-capture vendor). Effort:
~half a day. Risk: low-medium.

None of P1–P5 block the redesign or the go/no-go — they're the honest
"what I'd do next" list. Say which you want and I'll queue them.
