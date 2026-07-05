# Unstuck

A specialist execution tool for ADHD adults who struggle to start — and finish
— tasks. Type the thing you're avoiding; AI breaks it into tiny, doable
micro-steps, then an AI body double sits with you while you do them.

> Unstuck is a productivity tool, not medical advice or treatment.

## What makes it more than an AI wrapper

- **AI Body Double (Focus Room)** — "Do this with me" opens a calm full-screen
  session: a visible shrinking countdown, gentle streamed check-ins, and a
  "Struggling" button that shrinks the step or swaps it — options, never
  disappointment.
- **Time-Truth** — learns how long tasks _really_ take you and adjusts every
  plan. "Your quick jobs average 2.3× your guess. That's not failure — that's
  data."
- **Pick for me** — kills decision paralysis: one next step in two taps.
- **Bad-day reset + morning plan** — "Day went sideways?" triages what matters
  and grants guilt-free amnesty to the rest; a morning brain-dump becomes a
  realistic day. "Where was I?" restores an abandoned task with a 30-second
  re-entry step.
- **Weekly wins recap** — a shareable card of only what you did. Zero mention of
  anything missed.

## Stack

- **Next.js 15** (App Router) + **TypeScript** (strict) + **Tailwind CSS**
- **Google Gemini** (`gemini-2.5-flash`) — breakdowns/check-ins/plans, all
  server-side, streamed, strict JSON, thinking disabled, Zod-validated
- **Supabase** — Postgres + passwordless magic-link auth, Row Level Security
- **Stripe** — Checkout, customer portal, signature-verified webhooks
- **PostHog** — cookieless analytics; **next/og** — OG + wins images; PWA
- Deployed on **Vercel**

## Product rules (enforced everywhere)

Warm, zero-shame tone (no streaks, no guilt). Crisis safety in every AI prompt
(no task list for self-harm/crisis input; a compassionate signpost to Samaritans
116 123 instead). Not medical; disclaimer everywhere. Mobile-first at 390px;
ARIA, keyboard nav, `prefers-reduced-motion`, WCAG AA. One primary action per
screen. No general chat interface — every AI interaction is structured.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

Minimum to see breakdowns work: set `GEMINI_API_KEY` (free key at
<https://aistudio.google.com>). Add the Supabase keys for accounts, saving,
Time-Truth, and per-account limits. Add Stripe keys for Pro checkout.

### Environment variables

| Variable                                                     | Where  | Purpose                                              |
| ------------------------------------------------------------ | ------ | ---------------------------------------------------- |
| `GEMINI_API_KEY`                                             | server | Powers all AI. Never client-side.                    |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase project + anon/publishable key              |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | server | Rate limits, webhooks, account deletion. **Secret.** |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                | server | Checkout + webhook verification. **Secret.**         |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                         | public | Stripe publishable key                               |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`               | server | Price IDs (£7.99/mo, £59/yr)                         |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`       | public | Analytics (optional; no-op without a key)            |
| `NEXT_PUBLIC_APP_URL`                                        | public | Base URL for redirects, OG, Stripe                   |

`NEXT_PUBLIC_*` vars are inlined at **build** time — set them before building.

## Supabase setup

Run the migrations in order in the SQL Editor:

1. `0001_anon_usage.sql` — anonymous daily-limit counter
2. `0002_profiles_tasks_usage.sql` — profiles (+ signup trigger), tasks,
   usage_log, per-user limit function
3. `0003_focus_sessions.sql` — focus sessions + generic `feature_usage` counter
4. `0004_time_truth.sql` — `step_completions` (estimated vs actual)
5. `0005_recovery_plans.sql` — task amnesty (archive) column + `plans`
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

Migration 0006 also creates a **Storage bucket** — run it in the SQL editor
like the rest (it inserts into `storage.buckets` and adds `storage.objects`
policies).

All tables have RLS on; every counter/limit runs through a `SECURITY DEFINER`
function callable only by the service role.

**Auth:** Authentication → URL Configuration → Site URL `http://localhost:3000`,
Redirect URLs `http://localhost:3000/**` (add your prod domain too).

## Stripe setup (test mode first)

1. Create two recurring Prices (£7.99/mo, £59/yr) → put their IDs in
   `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`.
2. `STRIPE_SECRET_KEY` from Developers → API keys.
3. Webhook → endpoint `https://YOUR_URL/api/webhooks/stripe`, events:
   `checkout.session.completed`, `customer.subscription.created/updated/deleted`
   → signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
   Use test card `4242 4242 4242 4242`.

## Limits (server-enforced; Pro = unlimited)

|                                      | Free | Pro |
| ------------------------------------ | ---- | --- |
| Breakdowns/day                       | 3    | ∞   |
| Focus sessions/day                   | 1    | ∞   |
| Time-Truth, morning plan, wins recap | —    | ✓   |

A per-minute burst ceiling protects the AI endpoints from rapid-fire abuse for
everyone (including Pro), since they spend real money.

## How to change things

- **Prompts / tone / crisis rule** — `src/lib/gemini.ts`
- **Model** — `BREAKDOWN_MODEL` in `src/lib/gemini.ts`
- **Free limits** — `ANON_DAILY_LIMIT` in `src/lib/constants.ts`; `LIMITS` /
  `BURST` in `src/lib/quota.ts`
- **Prices** — the two Stripe env vars (no code change)
- **Colours / theme** — CSS variables in `src/app/globals.css`

## Deploy to Vercel

Push to GitHub → import at <https://vercel.com/new> (Next.js auto-detected) →
add all env vars (production/live values) → deploy. Then point the Stripe
webhook and Supabase redirect URLs at the production domain and set
`NEXT_PUBLIC_APP_URL`.

## Scripts

```bash
npm run dev / build / start / typecheck / lint
node --experimental-strip-types scripts/parsecheck.ts   # streaming-parser tests
```
