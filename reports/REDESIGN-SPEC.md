# ADHV — Phase X4 Redesign Spec: "Old Money"

**Branch:** `phase-x-harden-refinish`
**Nature:** presentational only. No IA, flow, one-primary-action structure,
zero-shame copy, disclaimer, crisis/safeguarding routing, or routing change.

## The idea

A Mayfair private-bank / Aston Martin-brochure restraint: **ivory paper,
deep navy, aged gold**, editorial serif headings, hairline rules, near-zero
decorative motion. Light is now the **default**; a **midnight** dark variant
is opt-in via the header toggle.

---

## Colour system (AA-verified)

Raw `R G B` CSS custom properties (so Tailwind `rgb(var(--x) / <alpha>)`
opacity modifiers keep working). Contrast ratios computed with the WCAG 2.1
relative-luminance formula.

### Light (default, `:root`)

| Token | Hex | Role | Contrast vs bg | AA? |
|---|---|---|---|---|
| `--bg` | `#F5F0E6` ivory | page background | — | — |
| `--surface` | `#FBF8F1` | card surface | — | — |
| `--surface-2` | `#EDE7DA` | stone / insets | — | — |
| `--border` | `#D6CDBB` | taupe hairline | 1.3:1 (non-text) | n/a |
| `--text` | `#1B2531` charcoal ink | body + UI text | **13.6 : 1** | ✅ AAA |
| `--muted` | `#5C5648` taupe | secondary text | **6.4 : 1** | ✅ AA |
| `--accent` | `#0F1F34` deep navy | **interactive** (links, buttons, active) | **14.6 : 1** | ✅ AAA |
| `--accent-2` / `--gold` | `#B08D57` aged gold | **decorative ONLY** | 2.7 : 1 | ❌ (by design — never text) |
| `--accent-3` | `#7A2E2E` oxblood | destructive only | 6.9 : 1 | ✅ AA |
| `--accent-soft` | `#E8E3D6` parchment | chip / callout bg (navy text on it) | — | ✅ (navy on it) |
| `--accent-ink` | `#F5F0E6` ivory | text on the navy accent | 14.4 : 1 (on navy) | ✅ AAA |

**The critical design rule:** the *interactive* accent is **navy** (which is
AA as text everywhere), and **gold is decorative-only** on light — it is
2.7:1 on ivory and is therefore used exclusively for hairline rules, borders,
the timeline "now" line, the wordmark rule and ornament, and **never for
text**. This was enforced across the codebase (grep-verified: zero
`text-accent-2` / `text-accent-3`; the one white-on-gold gradient card was
rebuilt to solid navy + ivory text).

### Midnight (`.dark`)

On a dark base, gold *becomes* AA-legible, so it flips to the interactive
accent — pairing gold accent with a navy-black base exactly as the brief
describes.

| Token | Hex | Role | Contrast vs bg | AA? |
|---|---|---|---|---|
| `--bg` | `#0C1320` navy-black | background | — | — |
| `--surface` | `#131C2C` | card | — | — |
| `--text` | `#F0EADE` warm ivory | body text | ~15 : 1 | ✅ AAA |
| `--muted` | `#A8ACB6` cool stone | secondary | **6.7 : 1** | ✅ AA |
| `--accent` / `--gold` | `#C7A770` gold | interactive accent | **6.5 : 1** | ✅ AA |
| `--accent-ink` | `#0C1320` | text on gold buttons | ~6.5 : 1 | ✅ AA |
| `--accent-3` | `#B0605A` muted oxblood | destructive | ~4.6 : 1 | ✅ AA (large) |

Focus ring = `--accent` (navy light / gold dark) at 2px + 2px offset — ≥3:1
against adjacent surfaces in both themes.

---

## Typography

| Use | Family | Loading |
|---|---|---|
| Display / headings (`h1`–`h3`, `.font-display`, wordmark) | **Fraunces** (editorial serif, weights 400/500/600, italic) | self-hosted via `next/font/google` → `--font-fraunces` |
| Body / UI | **Inter** (humanist sans) | self-hosted → `--font-inter` |
| Data / time | Inter **tabular numerals** (`.tabular`, `time`, `[data-tabular]`) | — |

Restrained modular scale (unchanged sizes; the serif does the work),
generous `line-height: 1.6`, near-zero heading tracking (`-0.005em`).

## Materials & motion

| Before (Aurora Noir) | After (Old Money) |
|---|---|
| Glassmorphism cards (translucent + 20px blur + sheen) | Solid ivory `--surface` card, **hairline aged-gold border** (`gold / 0.3`), soft low single-direction shadow |
| Animated 4-bloom gradient mesh (emerald/cyan/violet, drifting 22s) | **Static** whisper of gold at the top + a corner over paper, plus a barely-there (3%) SVG **linen grain** — zero motion |
| Emerald→cyan gradient buttons with a jewel glow | **Solid engraved navy** button, ivory label, soft shadow, `brightness` hover |
| Multicolour **confetti burst** (14 pieces, 650ms) | A single **gold "seal"** — a thin gold ring with a ✓ that appears, holds, and fades (`seal-mark`, 950ms). Acknowledgement kept, spectacle gone |
| Springy `scale(0.97)` tap (bouncy cubic-bezier) | Silk: a 0.5px press + 160ms `ease` colour/opacity transitions |
| Glowing gradient "now" line on the timeline | A **fine gold rule** with a tabular time |
| Large bubbly radii (1.25rem / 1.75rem) | Restrained classic radii (0.625rem / 0.875rem) |
| Gradient wordmark + glowing dot | **Engraved serif ADHV** with a hairline gold rule beneath — a monogram |

`prefers-reduced-motion` still zeroes all animation globally (it was already
honoured; with the mesh + confetti gone there is very little left to reduce).

Icon / OG image / wins-card / manifest / error page all recoloured to the
navy-and-gold system (navy tile + ivory letter; navy OG background + gold V).

## Implementation note — why the diff is small for such a big change

The redesign is almost entirely in the **token layer** plus four shared
utility classes. The class *names* were deliberately kept — `.grad-primary`,
`.grad-text`, `.glass`, and the `burstConfetti()` function — and their
*definitions* swapped. So every button, card, and celebration across all of
G→W inherited the new treatment without per-component edits. Only a handful
of components needed hand-touches (wordmark, doorway, timeline now-line, the
one AA-fail card).

---

## Verification

- **AA contrast:** every text/background pairing computed above; all
  functional text ≥ AA, gold confined to non-text decoration (grep-enforced).
- **Build / types / lint / format / tests:** all green after the reskin
  (tsc clean, ESLint 0/0, Prettier clean, 44 unit tests pass, `next build`
  succeeds).
- **Live output:** confirmed the served CSS carries the ivory/navy/gold
  tokens + the `.dark` midnight block, the animated `mesh-drift` keyframes
  are **gone**, the `seal-mark` is present, both self-hosted font variables
  resolve, and `theme-color` is navy.

## Deferred (needs a real browser — cannot run here)

Per the brief, and consistent with X1–X2's environment limits:

1. **axe + manual contrast audit on every screen** at 390/768/1024/1440.
   The token math guarantees the *palette* is AA; a per-screen axe pass
   should still run to catch any component-specific combination.
2. **Before/after screenshots of every major surface** — the brief asks for
   these committed; they require a browser. **To capture:** run the Vercel
   preview (X5), then screenshot Home, SOS, Regulate, Dopamenu, Idea Vault,
   Activity feed, Parents home, paywall/landing at the four widths, light +
   midnight. (A Playwright screenshot script can automate this — recommended.)
3. **Lighthouse a11y ≥ green** — expected to *improve* vs the jewel theme
   (removed the animated mesh + confetti JS; higher text contrast).

These are the only outstanding X4 items and none are code-blocking — they're
verification passes that need your environment.
