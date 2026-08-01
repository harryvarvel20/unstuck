# ADHV — Phase Z4 ADHD-Benefit Sweep

**Branch:** `phase-z-final` · **Date:** 31 Jul 2026. Code-level sweep of every
surface against the ADHD-benefit checklist, with evidence; changes applied
where a gap was found. The on-device visual pass (390px feel, tap-flow) is
folded into your own end-to-end test — everything checkable in code is below.

## Checklist findings (evidence-based)

| Lens | Verdict | Evidence |
|---|---|---|
| **Activation cost** | PASS | Home is one box + one button; demo works signed-out; Navigator carries intent into a pre-filled composer; HandlePicker arrives pre-filled with a valid suggestion (+shuffle); Pick-for-me exists for decision paralysis; morning landing keeps AM from opening on a task wall. |
| **No blank-page moments** | PASS (after Z3) | Every feed scope has a calm empty state with one action; Parents no-child state fixed (Y3); search empty state suggests example queries; "Where was I?" restores abandoned flows. The one true blank surface found — the unreachable positivity engine — was wired in Z3. |
| **Working-memory load** | PASS | One primary action per screen held everywhere read; state is visible not remembered (progress line, feed scope persisted per space, checked steps persisted server-side); Navigator example chips remove recall burden. |
| **Time blindness** | PASS | Focus Room countdown; Today timeline reflows from "now"; Time-Truth calibrates estimates against the user's real pace and says so ("your brain says 23"). |
| **Tiny first step** | PASS | Enforced in the prompt contract itself ("laughably small and physical") and CI-tested (87-assertion prompt sweep); rescue mode shrinks further; re-entry ramp is a 30-second move. |
| **Immediate feedback** | PASS | Every interactive element read has hover/active/disabled states (`active:scale`, brightness, opacity); haptics on key taps; streamed AI output renders as it arrives (no dead spinners); aria-live on dynamic regions. |
| **Shame-free re-entry** | PASS | Grep for shame vocabulary (streaks, failed, lazy, discipline, willpower, overdue) found **zero** instances outside explicit negations; time-up copy is neutral by prompt contract; "Where was I?" reloads with zero guilt copy; day-collapse triage frames letting-go as amnesty. |
| **Cognitive accessibility** | PASS | No `window.alert/confirm`; plain-English copy throughout; `prefers-reduced-motion` honoured globally; jargon absent from user-facing surfaces. |
| **Hit targets** | **FIXED** | Three header icon targets were 40px (`h-10 w-10`) against the 44px invariant → bumped to `h-11 w-11` (44px). All other primary controls are ≥44px (py-3/py-3.5 buttons). |

## Changes applied in Z4

1. **Header hit targets 40px → 44px** (toolkit, cool-down, account buttons) —
   the only sub-invariant target found.
2. (Credited to Z3 but ADHD-relevant): the positivity engine wired in — the
   highest-value "counterweight to correction" surface for parents.

## Deliberately NOT changed

No screen redesigns: every surface read already satisfies the one-primary-
action rule and the design system; redesigning without a visual regression
suite the night before launch would add risk, not benefit. The restraint is
the ADHD feature.

## For your device pass (can't be code-verified)

390px feel of long feeds; thumb-reach of the composer on mobile; the Focus
Room countdown legibility at arm's length; VoiceOver/NVDA one-screen sample.
