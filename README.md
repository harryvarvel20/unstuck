# ADHV

_(formerly "Unstuck")_

A production self-management web app for ADHD adults — and, in Parents Mode,
for the parents supporting a child with ADHD. Type the thing you're avoiding;
AI breaks it into tiny, doable micro-steps, then an AI body double sits with
you while you do them. Around that core sits a full toolkit, an opt-in social
layer, and a parenting-support section.

> ADHV is a self-management and skills tool — not therapy, diagnosis, or
> medical advice.

## What's in it (Phases G→W, all shipped)

**Core execution**

- **AI Body Double (Focus Room)** — a calm full-screen session: shrinking
  countdown, streamed check-ins, and a "Struggling" button that shrinks or
  swaps the step — options, never disappointment.
- **Time-Truth** — learns how long tasks _really_ take you and adjusts every
  plan. **Timeline / deadline mode** reflows the day from "now" (overruns just
  move forward — nothing is ever marked "late").
- **Pick for me / photo-to-plan / SOS / cool-down** — decision paralysis, a
  snapped photo, or a full stop, each handled in a couple of taps. Safety tools
  are never paywalled.
- **Morning plan, evening wind-down, resilient routines** (routines compress to
  a minimum viable version on a rushed day rather than breaking).
- **Regulate suite** (cool-down, big-feelings decompress, message-spiral
  defuser), **Dopamenu**, **Idea Vault**, **Impulse Pause**, **Focus Profile**,
  **Connection** nudges, and a shareable **weekly wins** recap.
- **Navigator** — a plain-language "what would you like to solve today?" bar on
  the Toolkit: the AI reads the intent and routes to the right tool (pre-filling
  the composer for a named task). Crisis/child-safety is screened
  deterministically first, so it signposts help instead of routing.

**Activity Center** (Pro social layer) — friends by handle (mutual-accept,
silent unfriend), a finite reverse-chron **wins feed** (reactions are faces,
never counts), **playbooks** + a public **method library** (free to browse),
1:1 **DMs**, private **boosts**, collective **group challenges**, an
**accountability buddy**, and full **block/report/mute** safety. No follower
counts, no leaderboards, no comparison tax.

**Parents Mode** (Pro, opt-in) — age-adaptive (4–7 / 8–12 / 13–17) support for
a parent of a child with ADHD. A situation-first hub ("what's hard right
now?"), bite-size Behavioral-Parent-Training coaching + a "kids do well if
they can" reframe tool, shared-screen kid tools (visual routine, reward chart,
first–then, feelings thermometer, Calm Corner, boost menu, homework helper),
Meltdown Mode + Collaborative Problem-Solving, a positivity engine, parent
anti-burnout tools, and school/EHCP help. Shared-screen (no child login), UK
Children's-Code posture, child-safety routing on every free-text field.

## Stack

- **Next.js 15** (App Router) + **TypeScript** (strict, `noUncheckedIndexedAccess`) + **Tailwind CSS**
- **Google Gemini** (`gemini-2.5-flash`) — all server-side, streamed, strict
  JSON, thinking disabled, Zod-validated
- **Supabase** — Postgres + passwordless magic-link auth, Row Level Security on
  every table, private Storage buckets (signed-URL access only)
- **Stripe** — Checkout, customer portal, signature-verified idempotent webhooks
- **PostHog** (cookieless) · **next/og** (OG + wins images) · installable **PWA**
- **Vitest** unit tests + live RLS/DB/adversarial harnesses, wired into GitHub Actions CI
- Deployed on **Vercel**

## Product rules (enforced everywhere)

Zero-shame tone (no streaks, no guilt, no "failed" states). Crisis + child-
safeguarding routing on every free-text surface (a compassionate signpost —
Samaritans 116 123 / Childline 0800 1111 / NSPCC 0808 800 5000 / 999 — instead
of any AI output). Not therapy/medical; disclaimer everywhere. One primary
action per screen. All AI is structured (no open chat). Mobile-first at 390px;
ARIA, full keyboard nav, `prefers-reduced-motion`, WCAG AA. Server-side gating,
per-user and per-IP rate limits, and RLS on every table.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values (see the table below)
npm run dev                  # http://localhost:3000
```

Minimum to see breakdowns work: `GEMINI_API_KEY` (free key at
<https://aistudio.google.com>). Add the Supabase keys for accounts, saving,
the social + parents features, and per-account limits. Add Stripe keys for Pro.

### Environment variables

| Variable                                                     | Where  | Purpose                                               |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------- |
| `GEMINI_API_KEY`                                             | server | Powers all AI. Never client-side.                     |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase project + anon/publishable key               |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | server | Rate limits, webhooks, storage, deletion. **Secret.** |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                | server | Checkout + webhook verification. **Secret.**          |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                         | public | Stripe publishable key                                |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`               | server | Price IDs (£9.99/mo, £99/yr)                          |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`       | public | Analytics (optional; no-op without a key)             |
| `NEXT_PUBLIC_APP_URL`                                        | public | Base URL for redirects, OG, Stripe                    |

`NEXT_PUBLIC_*` vars are inlined at **build** time — set them before building.

## Supabase setup

Run the migrations **in order** in the SQL Editor. They are idempotent
(`create … if not exists`), so re-running is safe.

**Core (0001–0015)**

1. `0001_anon_usage.sql` — anonymous daily-limit counter
2. `0002_profiles_tasks_usage.sql` — profiles (+ signup trigger), tasks, usage_log, per-user limit function
3. `0003_focus_sessions.sql` — focus sessions + generic `feature_usage` counter
4. `0004_time_truth.sql` — `step_completions` (estimated vs actual)
5. `0005_recovery_plans.sql` — task amnesty column + `plans`
6. `0006_task_photos.sql` — private `task-photos` storage bucket + RLS
7. `0007_winddown.sql` — wind-down plan columns
8. `0008_timeline.sql` — plan update/delete policies (timeline)
9. `0009_routines.sql` — resilient routines
10. `0010_regulate.sql` — journal + regulate usage log
11. `0011_dopamenu.sql` — dopamine menu
12. `0012_ideas.sql` — idea vault
13. `0013_impulses.sql` — impulse pause log
14. `0014_focus_signals.sql` — focus-profile signals (+ `profiles.focus_profile`)
15. `0015_connection.sql` — people + opt-in connection goal

**Activity Center (0016–0017)**

16. `0016_activity.sql` — friendships, posts, reactions, comments, DM threads/messages, boosts, statuses, challenges (+ members/ticks), buddies (+ check-ins), blocks, reports — all RLS
17. `0017_social_photos.sql` — private `social-photos` bucket + `photo_path` on DMs and challenge ticks (served via short-lived signed URLs only)

**Parents Mode (0018–0019)**

18. `0018_parents.sql` — `profiles.parents_mode` flag + `children` table (child data scoped under the parent, RLS)
19. `0019_parents_tools.sql` — `kid_rewards` (token economy) + `kid_wins` log

**Phase X (0020)**

20. `0020_x2_indexes.sql` — secondary-lookup index coverage found in the X2 audit (additive, no behaviour change)

Migrations 0006 and 0017 also create **Storage buckets** — run them in the SQL
editor like the rest. All tables have RLS on; every counter/limit runs through
a `SECURITY DEFINER` function (search_path-pinned) callable only by the service
role.

**Auth:** Authentication → URL Configuration → Site URL `http://localhost:3000`,
Redirect URLs `http://localhost:3000/**` (add your production domain too).

## Stripe setup (test mode first)

1. Create two recurring Prices (£9.99/mo, £99/yr) → IDs into `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`.
2. `STRIPE_SECRET_KEY` from Developers → API keys.
3. Webhook → endpoint `https://YOUR_URL/api/webhooks/stripe`, events:
   `checkout.session.completed`, `customer.subscription.created/updated/deleted`
   → signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
   Use test card `4242 4242 4242 4242`.

### Discount codes (influencers & partners)

Each creator gets their own code that gives their audience **10% off**. It's
entered on the pricing page ("Have a discount code?") and validated + applied
server-side; no code change is needed to add a new one.

1. **Make the coupon once** — Stripe dashboard → Product catalog → Coupons →
   **New**. Set **Percent off = 10%**, **Duration** = _Forever_ (or _Repeating_
   for a few months). Give it a clear name like "Creator 10%". You can reuse
   this one coupon for every creator.
2. **Make a promotion code per creator** — on that coupon, **Add a promotion
   code**. The **customer-facing code** is what the influencer shares (e.g.
   `SARAH10`, `ADHDJOURNEY`). Repeat for each new creator — one promotion code
   each, so you can track and deactivate them individually.
3. Optionally set per-code limits (max redemptions, expiry, first-time-only).
4. To retire a creator's code, toggle its promotion code to **inactive** in
   Stripe — inactive codes are rejected automatically.

Codes work in test mode too: create them under your test keys to try the full
flow before going live.

## Limits (server-enforced; Pro = unlimited)

|                                                                      | Free | Pro |
| -------------------------------------------------------------------- | ---- | --- |
| Breakdowns/day                                                       | 3    | ∞   |
| Focus sessions/day                                                   | 1    | ∞   |
| Time-Truth, plans, routines, Regulate, Activity Center, Parents Mode | —    | ✓   |

Per-minute burst ceilings protect the AI endpoints and every social/parents
write route from rapid-fire abuse (applies to Pro too).

## Design

**"Old Money"** — ivory paper, deep navy, aged gold; editorial serif
(Fraunces) headings + Inter body; hairline gold rules, restrained motion.
Light is the default; a **midnight** dark variant is opt-in via the header
toggle. Tokens live in `src/app/globals.css`. See `reports/REDESIGN-SPEC.md`
for the AA-verified palette.

## Testing & CI

```bash
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # ESLint
npm run format:check   # Prettier
npm test               # Vitest unit suite
npm run build          # next build

# live checks (need Supabase keys in .env.local)
node scripts/rls-isolation-harness.mjs                     # two-account RLS/IDOR, self-cleaning
node scripts/db-integrity-audit.mjs                        # orphans / timezone / index sanity
node --experimental-strip-types scripts/crisis-routing-adversarial.ts
```

CI (`.github/workflows/ci.yml`) runs typecheck + lint + format + test + build +
`npm audit` on every push.

## Phase X — hardening, testing, redesign

The `reports/` folder documents the last hardening pass: a full security audit
(`SECURITY-REPORT.md`), the test suite + DB audit (`TEST-REPORT.md`), code-
health + proposals (`CODE-HEALTH.md`), the redesign spec (`REDESIGN-SPEC.md`),
and the go/no-go summary (`PHASE-X-SUMMARY.md`).

## How to change things

- **Prompts / tone / crisis rule** — `src/lib/gemini.ts` (+ `src/lib/safety.ts` for the deterministic gates)
- **Navigator destinations** — `NAV_DESTINATIONS` in `src/lib/gemini.ts` (slug → route + description; the route map is derived from it in `src/app/api/navigate/route.ts`)
- **Model** — `BREAKDOWN_MODEL` in `src/lib/gemini.ts`
- **Free limits / burst** — `src/lib/constants.ts`, `LIMITS`/`BURST` in `src/lib/quota.ts`
- **Prices** — the two Stripe env vars (no code change)
- **Colours / theme** — CSS variables in `src/app/globals.css`

## Deploy to Vercel

Push to GitHub → import at <https://vercel.com/new> (Next.js auto-detected) →
add all env vars → deploy. Then point the Stripe webhook and Supabase redirect
URLs at the deployment domain and set `NEXT_PUBLIC_APP_URL`.
