# ADHV — Pricing, Margin & Free-Trial Review

**Date:** 11 August 2026 · Prepared alongside Phase AA8.
Gemini pricing verified against live Google AI documentation, 11 Aug 2026.
Commercial analysis, not financial advice.

---

## 0. Correction to the working figure: it is £6.16, not £6.49

**Confirmed structure:** list £7.99 → customer pays 10% less → creator takes
10% of the resulting revenue.

£7.99 × 0.9 × 0.9 = £6.47, which is where the ~£6.49 came from. **That
calculation omits Stripe.**

| | Amount |
| --- | --- |
| List price | £7.99 |
| Customer pays (−10%) | **£7.19** |
| Creator commission (10% of £7.19) | −£0.72 |
| Stripe (1.5% + 20p on £7.19) | −£0.31 |
| **Actual net** | **£6.16** |

That is **33p per customer per month** below the working figure — 4.2% of
revenue, or **£330/month at 1,000 subscribers**. Every model below uses
**£6.16**.

**You keep 77% of list price on a creator-acquired customer.** That is not
unreasonable for an affiliate channel, but it means the list price has to carry
a ~23% load, and right now it does not.

---

## 1. The headline: your margins are strong, your leakage is structural

**Cost to serve a genuine heavy user (20 breakdowns/day): £0.66/month.**

| | Per month |
| --- | --- |
| Net revenue | £6.49 |
| AI cost (heavy user) | £0.66 |
| **Contribution margin** | **£5.83 (90%)** |

Fixed costs are ~£16/month (Vercel Pro; Supabase, Resend and Google all within
free tiers). **Three subscribers cover the infrastructure. The business works.**

The problems are not cost problems. They are three structural decisions that
each quietly give away margin.

---

## 2. 🔴 Finding 1: the discount code runs **forever**

`docs/LAUNCH-RUNBOOK.md` §2b specifies **"Percentage discount: 10%, Duration:
Forever"**. Every customer arriving through a creator code pays 10% less for
**the entire life of their subscription** — not just the first month.

**A discount is a conversion instrument.** Its job is to overcome hesitation at
the moment of signup. It does no work in month nine — the customer has already
decided, and is now simply paying you less.

At an assumed 14-month average lifetime:

| Coupon duration | Lost per customer | Per 1,000 creator customers |
| --- | --- | --- |
| **Forever** (current) | £0.80 × 14 = **£11.20** | **£11,200** |
| Repeating, 3 months | £0.80 × 3 = £2.40 | £2,400 |
| **Once** (first month) | £0.80 × 1 = **£0.80** | **£800** |

**Recommendation: change the coupon to `Duration: Once`, or `Repeating` for
3 months.** You have not launched, so no customer is affected and nothing needs
grandfathering. This is the single highest-value change in this document and it
takes two minutes in Stripe.

> ⚠️ **You must do this before issuing any creator code.** Stripe coupon
> duration **cannot be edited** after creation — you would have to create a new
> coupon and reissue every promotion code. Doing it now costs nothing; doing it
> in three months means contacting every creator.

If you keep "Forever" deliberately — as a genuine loyalty position — that is a
legitimate choice, but it should be a decision, not an inherited default from a
runbook I wrote.

---

## 3. 🟠 Finding 2: the annual plan is priced below the monthly plan's economics

£59/year against £7.99/month (£95.88) is a **38.5% discount**. That is steep;
the common benchmark is "two months free" (≈17%) or 20–25%.

| Plan | Gross | Net after Stripe | Net per month |
| --- | --- | --- | --- |
| Monthly | £7.99 | £7.67 | **£7.67** |
| Annual £59 | £59.00 | £57.92 | **£4.83** |
| Annual £69 | £69.00 | £67.77 | £5.65 |
| Annual £79 | £79.00 | £77.62 | **£6.47** |

**An annual subscriber at £59 is worth 37% less per month than a monthly one.**

The break-even question: a monthly customer at £7.67 net accumulates £57.92 in
**7.6 months** (8.9 months at your stated £6.49).

> **So £59/year only creates value if your average monthly subscriber would
> churn in under ~8 months.** Beyond that, you are paying a 38.5% discount for
> cash you would have received anyway.

For an ADHD audience, churn genuinely may be high — tools get abandoned — so
this is not obviously wrong. But it should be a deliberate bet on churn, and
**£59 is the aggressive end of that bet**.

**Recommendation: £79/year.** It still reads as a clear saving (2 months free),
it preserves the upfront-cash and lower-churn benefits, and at £6.47/month net
it makes annual and monthly **economically equivalent** — so you become
indifferent to which one a customer picks, which is exactly where you want to
be pre-launch when you have no churn data.

---

> **Decision: the trial is 5 days** (7 → 4 on 12 Aug 2026, settled at 5 on
> 13 Aug). The analysis below recommended keeping 7 and still stands on the
> economics — a genuine trial costs about 3p, so cost was never the reason to
> shorten it. The owner's call was made on urgency and perceived value, which
> are legitimate grounds this analysis did not weigh. Recorded rather than
> rewritten, so the reasoning on both sides survives: if conversion disappoints
> after launch, trial length is the first variable to test, and §4 explains
> why.

## 4. 🟢 Finding 3: the free trial is **not** your problem

This is the one you were most worried about, and the maths says the opposite.

**A genuine 7-day trial costs you about 3 pence.**

| Trialist behaviour | Breakdowns over 7 days | AI cost |
| --- | --- | --- |
| Curious (tries it twice) | 5 | £0.006 |
| Typical | 25 | £0.03 |
| Very engaged | 100 | £0.11 |

Even at **0% conversion**, 1,000 trials cost you about **£30 in AI**. The trial
is close to free.

**Do not shorten it to 3 days.** Your audience is people who struggle to start
things — some will sign up, not open the app for four days, and only then form
a habit. A 7-day window is doing real conversion work for a cohort that a
3-day window would lose entirely. You would be trading meaningful conversion to
save pennies.

**The trial is also protected already:** Stripe Checkout collects a **card**
even for a trial, so a trialist is identifiable, chargeable, and disputable.

### What *is* the risk

Not the trial length — the **uncapped ceiling behind it**. `BURST.breakdown =
8/min` with no daily cap means a scripted account could make 80,640 calls in
7 days: **£89–£347 of Gemini spend for £0 revenue**, then cancel.

That same uncapped ceiling costs **£380–£1,486/month** on a *paid* account
too, so the fix belongs at the cap, not at the trial.

---

## 5. 🔴 Finding 4: "Unlimited" is unbounded, and £6.49 makes the maths tighter

Your landing page and `PricingCards` promise **"Unlimited breakdowns & focus
sessions"**, and the code honours it literally (`limit: Infinity`).

At £6.49 net, the cap that keeps even a pathological user profitable:

| Daily cap | Typical monthly cost | Worst-case monthly cost | Verdict at £6.49 net |
| --- | --- | --- | --- |
| None (current) | up to £380 | up to £1,486 | **unbounded** |
| 200/day | £6.60 | £25.80 | loss-making at worst case |
| **100/day** | **£3.30** | £12.90 | **49% margin typical** |
| 75/day | £2.48 | £9.68 | comfortable |
| 50/day | £1.65 | £6.45 | profitable even at worst case |

"Worst case" assumes **every single call** maxes the 2,048-token output ceiling.
Real breakdowns run 300–600 tokens, and a user consistently maxing output is
itself an anomaly the new nightly monitoring will surface.

**Recommendation: a fair-use ceiling of 100/day**, which is roughly **5× the
heaviest plausible genuine user** (20/day) and would never be felt by a real
customer.

**If you do this, the copy must change in the same release** — "Unlimited
breakdowns" → "Unlimited breakdowns (fair use)" or similar, on the landing
page and `PricingCards`. Terms §9 already discloses per-minute limits and §8
already prohibits automated bulk generation, so a fair-use ceiling is
consistent with the contract. It is the *marketing* that would otherwise be
inaccurate — and shipping a cap while the page still says "unlimited" is
exactly the failure mode AA4 found in the retention schedule.

---

## 5b. Is the creator structure valid? Yes — but the list price is not carrying it

The 10% + 10% structure is sound in principle. One point of design worth
stating, because it should guide any future change:

> **Prefer commission over discount.** Commission is performance-based — it
> only pays when a sale happens. A discount is unconditional and permanent.
> If you ever need to motivate creators harder, raise the commission, not the
> customer discount.

The problem is not the split. It is that **£7.99 was set as if every customer
were organic**, and then a 23% channel load was placed on top of it without
adjusting the list.

### What the same structure yields at different list prices

Assumes 10% customer discount, 10% creator commission on the discounted price,
Stripe at 1.5% + 20p.

| List | Customer pays | Creator | Stripe | **Net (creator channel)** | **Net (organic)** |
| --- | --- | --- | --- | --- | --- |
| **£7.99** | £7.19 | £0.72 | £0.31 | **£6.16** | £7.67 |
| £8.99 | £8.09 | £0.81 | £0.32 | £6.96 | £8.65 |
| **£9.99** | £8.99 | £0.90 | £0.33 | **£7.76** | £9.64 |
| £10.99 | £9.89 | £0.99 | £0.35 | £8.55 | £10.63 |

**At £9.99, a creator-acquired customer nets £7.76 — more than an organic
customer currently nets at £7.99.** The channel stops being a tax.

### Market position

| App | Monthly | ≈ GBP |
| --- | --- | --- |
| Tiimo | $7.99 | ~£6.30 |
| **ADHV (current)** | **£7.99** | **~$10.15** |
| **ADHV (proposed)** | **£9.99** | **~$12.70** |
| Numo | ~$16 | ~£12.60 |
| Inflow (incl. coaching) | $47.99 | ~£37.80 |

ADHV at £7.99 already sits above Tiimo. At £9.99 it would sit **below Numo and
far below Inflow**, for a product carrying an AI Navigator, Parents Mode, the
Activity Center, focus sessions and a crisis-safety layer. There is room.

### The argument that matters most

**You get one chance to set a launch price.** Raising £7.99 → £9.99 in six
months means either grandfathering your earliest and most loyal cohort at a
permanently lower rate, or asking the people who backed you first to pay more.
Both are bad. Launching at £9.99 and running promotions *down* is easy;
pricing up later is not.

At a 90% contribution margin you have unlimited room to discount tactically.
You have almost none to raise.

### The counter-argument, stated fairly

ADHV is positioned for people "already carrying enough". For part of that
audience £2/month is not nothing. Choosing accessibility over margin is a
legitimate values decision and it is yours to make — but it should be made
deliberately, not inherited from a number picked before the creator channel
existed.

**Recommendation: launch at £9.99/month and £99/year**, with the duration
fixes in §2. If accessibility is the priority, £8.99 still recovers most of
the channel load.

---

## 6. Is £7.99 the right price?

**Cost is not the constraint.** At a 90% contribution margin, your AI cost is
essentially a rounding error in the pricing decision. That has a specific
consequence worth being explicit about:

> **Price should be set by conversion, not by cost.** Moving £7.99 → £9.99 is a
> 25% revenue increase that flows almost entirely to profit. It is only wrong
> if it reduces conversion by more than ~20%. Nothing in your cost structure
> argues for £7.99 over £9.99 — only your belief about willingness to pay.

**Revised recommendation — this section originally said "keep £7.99".** That
was written before the creator structure was confirmed as 10% discount **plus**
10% commission. A 23% channel load changes the answer: £7.99 was chosen as if
every customer were organic, and it cannot carry that load.

**Recommendation: launch at £9.99/month, £99/year.**

| Change | Effect |
| --- | --- |
| **£7.99 → £9.99** | **+£1.60/month per creator customer, +£1.97 organic** |
| Coupon `Forever` → `Once` | ~£10.40 recovered per creator customer |
| Annual £59 → £99 | +£3.28/month per annual subscriber |
| Fair-use cap at 100/day | Removes an unbounded £1,486/month tail risk |

The one genuine argument for staying at £7.99 is **positioning** — accessibility
for an audience already under strain. That is a values call and it is yours. If
you take it, £8.99 is the compromise: it recovers most of the channel load and
still undercuts every AI-assisted competitor in the category.

What is *not* a good reason to stay at £7.99 is "we can raise it later". You
realistically cannot, without grandfathering your first cohort permanently or
charging your earliest supporters more than they signed up for.

---

## 7. Actions, in order

Everything here happens **in Stripe live mode plus five env vars**, and all of
it must be settled before the first creator code goes out.

1. **Decide the list price.** £9.99 recommended; £8.99 if accessibility wins.
   Then create the live prices and update `STRIPE_PRICE_MONTHLY` /
   `STRIPE_PRICE_ANNUAL` in Vercel. Also update the figures in
   `src/app/terms/page.tsx` §10 and `PricingCards` — the Terms state the price
   explicitly and must match.
2. **Stripe coupon → `Duration: Once`** (or Repeating, 3 months). **Coupon
   duration cannot be edited after creation** — if one already exists with
   `Forever`, create a new coupon rather than trying to change it, and issue
   promotion codes from that.
3. **Define the commission term in writing.** `legal/AFFILIATE-TERMS.md` §5
   leaves rate and term "agreed separately", which in practice means
   open-ended. A recurring 10% with no end date is a permanent revenue share.
   Standard practice is 12 months from signup. Fill this in before signing any
   creator.
4. **Set the annual price** — £99 at a £9.99 list (2 months free). £59 is only
   right if you expect sub-8-month retention.
5. **Google Cloud billing budget + alert** at £25 and £50/month. The hard stop
   behind the fair-use question.
6. **Decide the fair-use position** — cap *and* copy change together, or
   neither.

Items 2 and 3 lose real money if left, and both become expensive to fix once
creators are live. Items 1, 4 and 6 are decisions rather than defects.

---

## 8. Summary of the numbers

| | Current | Recommended |
| --- | --- | --- |
| List | £7.99 | **£9.99** |
| Annual | £59 (38.5% off) | **£99** (17% off) |
| Coupon duration | Forever | **Once** |
| Commission term | undefined | **12 months** |
| Net, creator channel | **£6.16** | **£7.76** (£8.64 after month 1) |
| Net, organic | £7.67 | **£9.64** |
| AI cost, heavy user | £0.66 | £0.66 |
| Contribution margin | 89% | **93%** |

Sources for market comparison: [Tiimo pricing](https://lifestack.ai/blog/tiimo-pricing),
[Numo](https://numo.ai/journal/best-adhd-planner-apps),
[Inflow cost](https://mutra.app/compare/pricing/inflow/).
