# ADHV — Phase Z3 Parents Mode Report (overhaul + zero child data)

**Branch:** `phase-z-final` · **Date:** 31 Jul 2026 · **Result:** all surfaces
verified content-complete across the three age bands; 1 orphaned feature wired
in (the positivity engine); kid-surface analytics stripped; device-data
lifecycle completed (sign-out / account-delete / one-tap erase). **Zero child
data on the server — evidenced below, and guarded by a failing-if-regressed
audit.**

## 1. Data inventory — what is and isn't stored (the evidence table)

| Data | Where it lives | Server? | Notes |
|---|---|---|---|
| Child nickname (optional; copy steers to "a nickname — or leave blank") | Device localStorage only | **Never** | Cleared on sign-out, account delete, remove-child, or one-tap erase |
| Age band (4–7 / 8–12 / 13–17) | Device localStorage only | **Never** | Sent per-request to the coach AI as a throwaway content-adaptation parameter; never persisted server-side, never logged with identity |
| "What's hardest" free-text | Device localStorage only | **Never** | Screened by the on-device safeguarding gate before saving |
| Reward chart (behaviours, rewards, tokens) | Device localStorage only | **Never** | Earning-only; max 3 behaviours |
| "Wins about my kid" log | Device localStorage only | **Never** | Screened on-device; capped at 200 entries |
| Child DOB / exact age / photos / voice / school / location / health / diagnosis / behaviour history | **Nowhere** | **Never** | No fields exist to hold them; parents-space posts block photos server-side |
| Parent's Parents-Mode on/off flag | `profiles.parents_mode` (parent's own row) | Yes | Parent data, not child data |
| Parent's own free-text to coach AI | Sent to Gemini per-request | Not persisted | Safeguarding gate runs BEFORE the AI on every kind (proven in `prompts-crisis` + coach route source) |

**Live proof:** the Z1 DB audit asserts `children`, `kid_rewards`, `kid_wins`
tables are **gone** (PGRST205) and fails if they ever return. The AI request
payload carries `{ ageBand, text }` only — no identifiers. Storage buckets
hold no parents-space objects (photo upload is skipped server-side for
`space="parents"`, proven in `posts.route.test.ts`).

## 2. Defects found & fixed in Z3

| ID | Sev | What | Fix |
|---|---|---|---|
| Z3-D1 | **Medium (missing feature)** | `PositivityView` — the W6 positivity engine (labeled-praise coach, Special Time nudge, private "wins about my kid" log) — was built but **rendered nowhere**; the area was unreachable. This was the real "left blank" gap. | Wired into the hub as its own area: 💛 **Notice the good** (Coach / With your child / Notice the good / Just for you / School). |
| Z3-D2 | **Medium (Children's Code)** | Kid-facing shared-screen tools fired analytics **during child interaction** — `emotion_checked {level}` telemetered the child's emotional state; also `reward_earned`, `kid_routine_run`, `firstthen_used`, `boost_used`, `homework_helper_used`. | All interaction events stripped from every `kid/*` component. The only event left on a kid surface is `child_safety_routed {surface}` — safety-system observability containing no content and no child information. |
| Z3-D3 | Low | Device child-data survived **sign-out** and **account deletion** (localStorage isn't touched by either). | `clearAllParentsLocal()` now runs on sign-out (header form) and after successful account deletion. |
| Z3-D4 | Low | No **one-tap erase** of everything parent-related. | "Erase all Parents data from this device" added beside the turn-off control — clears children, charts, wins, active-child pointer in one tap. |

## 3. Surface-completeness verification (all three bands)

Every Parents surface was read end-to-end and verified content-complete — no
blank panes, every state has a real surface:

- **Home (situation-first):** 9 flashpoints, all age-filtered, each ending in a
  concrete action (plan / meltdown coach / reframe / parent reset / school);
  "enabled but no child" shows the add-your-child empty state (fixed in Y3);
  the "what's hardest" contextual card offers a plan for the parent's own words.
- **Coach:** 9 micro-lessons (labeled praise, special time, effective
  instructions, when–then, transitions, planned ignoring, token economies,
  teen autonomy, home–school), one at a time, band-filtered — teens get the
  autonomy lesson *instead of* charts; + the "kids do well if they can"
  reframe tool (AI, safeguarded).
- **With your child:** visual routine, reward chart (stickers → points →
  self-owned privileges by band; earning-only), First–Then (4–12 only, by
  design), feelings check (4-level thermometer with co-regulation guidance,
  younger/older wording), Calm Corner (never a time-out), boost menu,
  homework helper (AI, safeguarded, movement breaks).
- **Notice the good (newly wired):** labeled-praise phrasings, Special Time
  nudge, private wins log (device-only).
- **Just for you:** parent SOS ("I'm in the red", 90-second reset) +
  bad-day decompress; explicit signpost to real support.
- **School:** UK SEN Support / EHCP explainer, meeting prep, AI-drafted
  teacher emails — the app sends nothing, the parent copies.
- **Meltdown Mode:** co-regulate-the-parent-first steps, then repair-not-
  lecture, then the Collaborative Problem-Solving flow (3-step Plan B with
  age-tuned phrasings).
- **Activity Center Parents space:** separate feed, Parents-Mode-gated,
  no photos server-enforced, safeguarding on every field, parent-strategy
  copy steering — all proven live in Z2/Z1 suites.

## 4. Design check (stressed-parent lens)

The route from "this is hard right now" to "one thing to try" is: open
Parents → tap the flashpoint → plan ends in `firstStep`. Two taps to concrete
help; hub shows 9 situations + 5 areas and nothing else (one primary question
per screen). No changes needed beyond wiring D1.

## 5. Remaining notes

- Age band is stored per-"child" on the device rather than as a single parent
  preference — strictly more private than the spec's minimum (nothing on the
  parent's server row at all), so kept.
- Ephemerality of kid surfaces: no child login, no session history, no
  external links, no ads anywhere in `kid/*` — verified by read-through.
