# ADHV — Launch Runbook

Follow top to bottom. Everything before "Go live" is reversible; the point of
no return is clearly marked. Keep this open on launch day.

---

## Phase 1 — The three gates (tomorrow)

### 1a. Stripe live activation — **start this first**

It's the only step with a queue (business + bank verification, minutes to ~2
working days). Stripe → **Switch to live account / Activate**.

You'll need: business type (sole trader is fine), your name/DOB/address, a UK
bank account for payouts, possibly photo ID. Starting it breaks nothing —
sandbox keeps working alongside.

### 1b. ICO registration — ✅ **DONE**

Registered **4 August 2026**, reference **ZC213841**, expires **3 August 2027**.
Now cited in the Privacy Policy, `legal/ROPA.md` and `legal/DPIA.md`.

> ⚠️ **Put 3 August 2027 in your calendar now.** Letting the registration lapse
> while still processing personal data is a criminal offence under s.137 of the
> Data Protection Act 2018. Set the reminder for a month early.

### 1c. Vercel → Pro — ~5 min, ~$20/mo

Vercel → team **HarryVarvel** → Settings → Plans → upgrade. Required for
commercial use. It also unlocks WAF custom rules, multi-region functions, and
raises included usage to 1 TB transfer / 10M edge requests.

> Correction: an earlier draft of this runbook said Pro "lifts the function
> timeout your streaming AI endpoints rely on". That was wrong. Under fluid
> compute the **default** max duration is 300s on Hobby _and_ Pro; Pro raises
> the configurable **ceiling** (300s → 800s), which this app does not need —
> AA3 caps the AI routes at 60s deliberately. Pro is still required, for the
> reasons above.

---

## Phase 2 — Rebuild Stripe in LIVE mode

⚠️ **Nothing copies from sandbox.** Live mode is a separate world. Toggle out
of sandbox (top of the Stripe dashboard) before every step below.

### 2a. Product + prices

1. **Product catalogue → + Add product**
2. Name: `ADHV Pro`
3. Price 1: **Recurring · £9.99 · GBP · Monthly** · _Include tax in price: No_
4. Save, then **+ Add another price**
5. Price 2: **Recurring · £99 · GBP · Yearly** · _Include tax in price: No_
6. Copy both **price IDs** (`price_…`) into a scratch note, clearly labelled
   which is monthly and which is annual.

> ⚠️ **Do not add a trial on the price** — the app adds the 7-day trial in
> code. Setting it here too would double it.

### 2b. Discount code

1. **Product catalogue → Coupons → New**
2. **Percentage discount: 10%**, **Duration: Once**, name `Creator 10%`
3. On that coupon → **Add promotion code** → enable **customer-facing code** →
   code: `LAUNCH10`
4. Leave every limit box unticked (no expiry, no redemption cap).

_(For each new influencer later: same coupon, new promotion code.)_

> 🔴 **`Duration: Once`, not `Forever`.** An earlier version of this runbook
> said Forever. A discount is a conversion instrument — it buys the signup and
> does nothing in month nine except charge the customer less. At a 14-month
> average lifetime, Forever costs ~£11.20 per creator customer versus £0.80.
>
> **Stripe cannot change a coupon's duration after creation.** If a `Forever`
> coupon already exists, create a **new** one and issue promotion codes from
> that — do not try to edit it. See `reports/PRICING-AND-TRIAL-REVIEW.md`.

### 2c. Webhook

1. **Developers → Webhooks → Add endpoint**
2. URL: `https://adhvtool.com/api/webhooks/stripe`
3. Events — exactly these four:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Create → open it → **reveal the signing secret** (`whsec_…`)

### 2d. Live API keys

**Developers → API keys** → copy the **publishable** key (`pk_live_…`), then
reveal and copy the **secret** key (`sk_live_…`).

---

## Phase 3 — Swap the keys in Vercel

Vercel → project **adhv** → Settings → **Environment Variables**. **Edit** each
of these five (don't add duplicates):

| Variable                             | New value                     |
| ------------------------------------ | ----------------------------- |
| `STRIPE_SECRET_KEY`                  | `sk_live_…`                   |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…`                   |
| `STRIPE_PRICE_MONTHLY`               | the **£9.99/month** `price_…` |
| `STRIPE_PRICE_ANNUAL`                | the **£99/year** `price_…`    |
| `STRIPE_WEBHOOK_SECRET`              | the new `whsec_…`             |

Then **Deployments → ⋯ → Redeploy** and wait for **Ready**.

> ⚠️ Double-check the two price IDs aren't swapped. If they are, monthly
> subscribers get charged £99. Open each price in Stripe and match the amount
> to the ID before pasting.

---

## Phase 4 — The real payment test 🔴 **non-negotiable**

Test mode passing does **not** prove live mode works: different keys,
different webhook secret, a real card, real 3-D Secure.

1. On `adhvtool.com`, sign in with a **fresh email** you control (not your
   existing Pro account — that one is already Pro and will 409).
2. Pricing → **Have a discount code?** → `LAUNCH10` → pick **monthly**.
3. Pay with your **real card**.
4. Verify all four:
   - checkout shows **10% off** (£9.99 → £8.99)
   - it returns you to the welcome page
   - **Account shows Pro**
   - Stripe → Webhooks → **Event deliveries** shows **200s**
5. Then in Stripe: **refund** the payment and **cancel** that subscription.

If any step fails, stop and fix before telling anyone the app is live.

---

## Phase 5 — Final checks before you tell anyone

- [ ] Real payment test passed and refunded (Phase 4)
- [ ] `LAUNCH10` works end to end
- [ ] Sign-up by magic link works on a fresh email
- [x] Privacy Policy updated with ICO registration (ZC213841)
- [ ] Processor DPAs accepted: Supabase, Vercel, Google, Stripe, Resend
- [ ] GitHub: 2FA on, repo private, branch protection, Dependabot
- [ ] Supabase: confirm backup posture
- [ ] Creator terms (`legal/AFFILIATE-TERMS.md`) sent to any influencer, with
      their written acceptance saved, **before** they post

---

## If something goes wrong

| Problem               | Fix                                                                          |
| --------------------- | ---------------------------------------------------------------------------- |
| Bad deploy            | Vercel → Deployments → **Instant Rollback** (one click)                      |
| Checkout broken       | Vercel → Logs → find `POST /api/checkout` → read the real error              |
| Webhook failing       | Stripe → Webhooks → Event deliveries → inspect the response                  |
| Wrong price charged   | Pause the code, fix the price ID in Vercel, redeploy, refund anyone affected |
| Suspected data breach | `legal/RETENTION-AND-BREACH.md` — 72-hour ICO clock starts at discovery      |
| Safeguarding report   | `legal/SAFEGUARDING-POLICY.md`                                               |

## Day-one watch list

Check these once in the morning and once at night for the first week:

- Stripe → Payments (are charges succeeding?)
- Stripe → Webhooks → Event deliveries (all 200s?)
- Vercel → Logs (any 500s?)
- Supabase → Auth → Users (are signups completing?)
- Your inbox (support + safeguarding — you are the only responder)
