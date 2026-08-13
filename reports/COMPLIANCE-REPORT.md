# ADHV — Phase Z6 Legal & Regulatory Compliance Report (UK-first)

**Branch:** `phase-z-final` · **Date:** 31 Jul 2026.
**I am not a lawyer and this is not legal advice.** This is the engineering
evidence + status table for a solicitor to review. Technical measures are
implemented; every item needing professional sign-off is marked **⚖ LEGAL**.

Status key: ✅ compliant-by-design/evidence · 🔧 action taken this phase ·
📋 owner to-do (dashboard/paperwork) · ⚖ LEGAL sign-off needed.

## 1. Children's data — HIGHEST PRIORITY: ✅ strongest available posture

| Item | Status | Evidence |
|---|---|---|
| No child personal data collected/processed/stored server-side | ✅ | Tables dropped (0023); live audit **fails if they return**; full inventory in PARENTS-REPORT §1 |
| Nothing child-related sent to third parties / AI | ✅ | Coach payload = age band + parent text only; safeguarding gate BEFORE model (CI-tested) |
| No child profiling / behavioural advertising / trackers on kid surfaces | 🔧✅ | Z3-D2 stripped every kid-surface analytics event (incl. the emotional-state one); no ads exist anywhere |
| Data minimisation by default | ✅ | Device-only storage; "nickname or nothing" steer; one-tap erase; sign-out/delete clearing (Z3) |
| Account holder is an adult; age assurance | 🔧 | 18+ + Terms/Privacy acknowledgement now at sign-in; Activity "public" additionally requires the 18+ confirmation toggle (server-downgraded otherwise, CI-tested) |
| COPPA (US) exposure | ✅/⚖ | Service is directed at adults and collects no child data, so COPPA should not attach — **⚖ confirm** if actively marketing in the US |
| ICO Children's Code conformance statement | ⚖ | Posture is aligned (minimisation, no profiling, no nudging children); solicitor should bless the written statement |

## 2. UK GDPR / DPA 2018 generally

| Item | Status | Notes |
|---|---|---|
| ICO registration + fee | ✅ | **Done.** Registered 4 Aug 2026, reference **ZC213841**, expires **3 Aug 2027**. Now cited in the Privacy Policy, RoPA and DPIA |
| Lawful bases per activity | 🔧/⚖ | Draft mapping: contract (accounts, billing, AI features the user invokes), legitimate interests (abuse limits, security logs), consent (optional analytics). Needs ⚖ review |
| Record of Processing Activities | 🔧/⚖ | The processor table + data inventory across PARENTS-REPORT/SECURITY-REPORT serves as the working RoPA; formalise with solicitor |
| DPIA (health-adjacent, vulnerable users, children context) | ⚖ | **Required.** The reports give a solicitor ~90% of the inputs; commission before scale marketing |
| Data-subject rights in-product | ✅ | Access/portability (account data visible; export via request), erasure (one-tap delete with cascade — harness-verified clean), rectification (edit in place) |
| Retention & deletion | ✅/⚖ | User-controlled deletion everywhere; no server-side retention of AI inputs; formal retention schedule doc needs ⚖ |
| Processor agreements | 📋 | Standard DPAs exist self-serve for Supabase, Vercel, Stripe, Google (Gemini API), PostHog, Resend — accept each in-dashboard |
| International transfers | ✅/📋 | Supabase EU (Ireland region confirmed for Resend; verify Supabase project region 📋); US processors under UK IDTA/SCCs via their standard DPAs |
| Breach notification | 🔧 | Procedure documented (SECURITY-REPORT §11): contain → assess → ICO within 72h if risky → affected users if high risk |

## 3. Special category data — ⚖ KEY QUESTION

ADHV avoids diagnosis and never asks for health data, but users may type
ADHD-related content, and the product is marketed to people with ADHD — a
solicitor should assess whether Article 9 attaches and whether an explicit-
consent checkpoint at signup is prudent. Engineering hooks exist (the signup
acknowledgement line) if the advice is yes. **Do not scale marketing before
this answer.**

## 4. Online Safety Act 2023 (user-to-user service)

| Item | Status |
|---|---|
| Reporting/complaints mechanism | ✅ report on every post/comment/DM/profile; viewability-checked; 3-distinct-reporter auto-hide + human queue |
| Content moderation & takedown | ✅ flagging pipeline + author deletion + block/mute; deterministic abuse screen |
| Terms setting out prohibited content | 🔧/⚖ Terms exist; add explicit prohibited-content clause — ⚖ |
| Illegal-content & children's-access risk assessments | ⚖ **Required documents** — small-service templates exist (Ofcom); solicitor/you to complete |
| Record-keeping | ✅ reports table retains reporter/subject/status |

## 5. Medical-device boundary (MHRA) — ✅ with copy evidence

Grep-verified: no diagnostic/treatment/therapeutic claims anywhere in
app/landing copy; "self-management tool, not therapy or medical advice"
disclaimer on every surface incl. both AI prompt voices ("never diagnose,
never make treatment claims" is CI-tested prompt law). Positioning = general
wellness. **⚖ quick confirmation recommended pre-marketing.**

## 6. Consumer & subscription law

| Item | Status |
|---|---|
| Transparent pricing incl. VAT position | ✅ flat £9.99/£99 charged exactly (managed_payments off, CI-tested); not VAT-registered → prices as-charged; revisit at threshold 📋 |
| Pre-contract info + 14-day right | 🔧/⚖ 5-day free trial means no charge before day 5 (cooling-off exercisable in-product by cancelling); Terms should state the digital-content waiver wording — ⚖. **Note:** the trial has always been shorter than the 14-day statutory cancellation period (7 days until 12 Aug 2026, 5 days from 13 Aug 2026), so a customer can be charged while still inside it, and cancelling refunds nothing automatically. Not introduced by the shortening — but a shorter trial brings the first charge forward, which makes it more likely to be encountered. Worth the solicitor's attention alongside the waiver wording |
| Easy cancellation, no dark patterns | ✅ one-tap via Stripe portal from Account; "cancel in one tap" is marketing copy AND true |
| Auto-renewal transparency | ✅/⚖ stated at checkout (Stripe) + pricing page; upcoming UK subscription rules (DMCC) reminders — ⚖ watch-item |

## 7. Accessibility

WCAG 2.2 AA engineering measures in place (keyboard nav, focus-visible,
reduced-motion, 44px targets after Z4, AA-contrast palette from the redesign
spec); axe/browser verification is on your device pass + Z7 checklist.
📋 Publish an accessibility statement page post-launch (template task).

## 8. Marketing & affiliates (ASA/CAP)

📋/⚖ Before the influencer programme starts: written affiliate terms
requiring #ad disclosure and banning health-outcome claims. LAUNCH10 flows
are ready; the *contract template* is a solicitor task.

## 9. Cookies & tracking (PECR)

✅ No advertising or cross-site cookies. Auth cookies = strictly necessary
(exempt). PostHog runs cookieless and is currently keyless/no-op in prod;
**if** you enable it, ship the consent toggle first 📋. Kid-facing surfaces:
zero analytics events (Z3-D2) and no third-party calls.

## 10. Documents inventory

| Doc | Status |
|---|---|
| Privacy Policy | 🔧 updated (Parents zero-data section); ⚖ final review |
| Terms of Service | exists; ⚖ add prohibited-content + subscription/waiver clauses |
| Cookie note | ✅ covered inside Privacy (no non-essential cookies); standalone page optional |
| Community guidelines | 🔧/⚖ the Activity onboarding states the rules; formalise as a page |
| Safeguarding/crisis policy | ✅ implemented product-wide; write-up = extract of SECURITY/TEST reports |

## 11. IP

✅ Dependencies MIT/Apache/ISC (lockfile-audited); Fraunces + Inter under OFL
(commercial use permitted); all imagery is emoji/system. 📋⚖ **Trademark
search for "ADHV"** before heavy marketing spend — a solicitor/agent task.

## 🔴 Gemini API tier — verify before launch

**Added 13 Aug 2026.** Verified against Google's Gemini API Additional Terms
of Service, not assumed.

| | **Free tier** | **Paid tier** |
| --- | --- | --- |
| Training | "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services" | "Google doesn't use your prompts… or responses to improve our products" |
| **Human review** | **"human reviewers may read, annotate, and process your API input and output"** | not applicable |
| Retention | unspecified | limited period, solely to detect Prohibited Use Policy violations |

**The Privacy Policy already commits us to the paid tier.** It states plainly
that user text "is not used to train Google's models **under the paid API
terms**". If the key is on the free tier, that sentence is untrue.

**The human-review clause is the more serious half**, and it is not disclosed
anywhere in the Privacy Policy. On the free tier, Google reviewers may read
what users type — task descriptions, journal entries, Regulate spirals, brain
dumps, and text from someone approaching crisis. That is an undisclosed
processing activity covering the most sensitive content in the product, in an
app whose stated position is "we collect as little as we can".

**Action:** confirm the API key's Google Cloud project has billing enabled and
is on the paid tier. If it is not, **enabling it is mandatory before launch** —
the only alternative is amending the Privacy Policy to disclose that Google
staff may read user entries, which would be honest and commercially fatal.

**Cost impact: none material.** AA8 modelled paid-tier pricing throughout
(~£0.66/month for a heavy user). The economics already assume it.

## Launch-blocking shortlist (my honest ranking)

1. ~~**ICO registration**~~ — ✅ **complete** (ZC213841, 4 Aug 2026). Renew by
   **3 Aug 2027**; lapsing is a criminal offence under s.137 DPA 2018.
2. **Solicitor pass over Terms + Privacy + Art-9 question + OSA risk
   assessments** (⚖) — strongly advised before *marketing at scale*; a
   soft launch while it's in progress is a business-risk call that is yours.
3. Processor DPAs accepted in each dashboard (📋, ~30 min total).
Everything else is compliant-by-design or a watch-item, with evidence.
