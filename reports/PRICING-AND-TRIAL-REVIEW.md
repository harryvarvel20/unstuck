# ADHV — Pricing, Margin & Free-Trial Review

**Date:** 11 August 2026 · Prepared alongside Phase AA8.
Gemini pricing verified against live Google AI documentation, 11 Aug 2026.
Commercial analysis, not financial advice.

---

## 0. What I need you to confirm

You said you net **~£6.49 per customer per month** after marketing. That figure
is consistent with two different structures, and they behave very differently:

| Reading | Composition | Implication |
| --- | --- | --- |
| **(a)** Full price | £7.99 − £0.32 Stripe − **£1.18 marketing** = £6.49 | Marketing is ~15.4% of gross |
| **(b)** Creator-code price | £7.19 − £0.31 Stripe − **£0.39 commission** = £6.49 | The 10% code is doing most of the work |

**Which is it?** And more importantly: is that marketing cost a **one-off**
cost of acquiring the customer, or a **recurring** monthly payment (a creator
commission that keeps paying out)?

- **One-off** → it is CAC. It stops. Every month after the first is worth
  £7.67, and the analysis is about payback period.
- **Recurring** → it is a permanent revenue share, and £6.49 is your true
  ceiling forever.

Everything below uses **£6.49 as the recurring net**, which is the
conservative reading. Tell me if it is one-off and I will redo the LTV maths —
it materially improves the picture.

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

## 6. Is £7.99 the right price?

**Cost is not the constraint.** At a 90% contribution margin, your AI cost is
essentially a rounding error in the pricing decision. That has a specific
consequence worth being explicit about:

> **Price should be set by conversion, not by cost.** Moving £7.99 → £9.99 is a
> 25% revenue increase that flows almost entirely to profit. It is only wrong
> if it reduces conversion by more than ~20%. Nothing in your cost structure
> argues for £7.99 over £9.99 — only your belief about willingness to pay.

Two things genuinely argue for staying at £7.99 for now:

1. **You have no conversion data.** Optimising price before you know your
   baseline is guessing. Launch, measure, then test.
2. **Positioning.** ADHV is deliberately for people "already carrying enough".
   A lower price is coherent with that, and there is a real argument for
   accessibility over margin in this category. That is a values call and it is
   legitimately yours.

**My recommendation: keep £7.99, fix the three structural leaks above.** They
are worth more than a price rise and cost you no conversion risk whatsoever:

| Change | Effect |
| --- | --- |
| Coupon `Forever` → `Once` | ~£10.40 recovered per creator customer |
| Annual £59 → £79 | +£1.64/month per annual subscriber |
| Fair-use cap at 100/day | Removes an unbounded £1,486/month tail risk |

Revisit price after roughly 100 paying customers, when a change is measurable
rather than a guess.

---

## 7. Actions, in order

1. **Stripe coupon → `Duration: Once` (or Repeating 3 months).** Before you
   issue a single creator code. **Cannot be changed later.**
2. **Google Cloud billing budget + alert** at £25 and £50/month. The hard stop
   behind everything above.
3. **Decide the annual price** — £79 recommended, £59 only if you expect sub-8-
   month retention.
4. **Decide the fair-use position** — cap + copy change together, or neither.
5. **Confirm the £6.49 composition** (§0) so the LTV model can be finished.

Items 1 and 2 are the ones that lose real money if left. Items 3–5 are
decisions rather than defects.
