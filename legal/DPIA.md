# ADHV — Data Protection Impact Assessment (DPIA)

**Controller:** ADHV (sole trader — Harry Varvel) · **Contact:**
harryvarvel@gmail.com
**ICO registration:** ZC213841 — registered 4 Aug 2026, expires 3 Aug 2027
**Version:** 1.1 · **Date:** 10 Aug 2026 · **Status:** self-completed,
pending professional review
**Prepared by:** the controller, with AI assistance, following the ICO DPIA
template. **Not legal advice.**

> Why a DPIA: the ICO requires one where processing is likely to result in a
> high risk. ADHV touches two triggers — data concerning **vulnerable
> individuals** (adults with ADHD; a mental-health-adjacent context) and a
> **children's context** (Parents Mode). We are completing this proactively
> even though the child-data risk has been engineered to zero.

---

## Step 1 — Identify the need for a DPIA

ADHV is a UK web application helping adults with ADHD start and finish tasks,
with an opt-in social layer and an opt-in Parents Mode. It processes free-text
the user writes about their life, sends it to a third-party AI to generate
steps, and stores the results. It includes user-to-user content and private
messaging. Payments are taken by subscription.

High-risk indicators present: vulnerable data subjects; large-ish volume of
free-text that may incidentally reveal health or emotional state; innovative
use of AI; a children's-adjacent feature. Indicators **absent**: no automated
decision-making with legal effect, no profiling for advertising, no biometric
data, no systematic public monitoring, no children as data subjects.

## Step 2 — Describe the processing

**Nature.** Users type free-text; it is transmitted over TLS to our server,
validated, screened by a deterministic safety gate, then sent to Google's
Gemini API to generate structured output which is returned, validated and
stored against the user's row in Supabase (Postgres, EU region). Social
content is stored with an explicit visibility level. Files go to private
buckets served by short-lived signed URLs. Billing state is derived from
Stripe webhooks.

**Scope.** Personal data processed: email address; user-generated text
(tasks, plans, journal entries, wins, comments, direct messages); timing and
completion data; a chosen social handle; usage counters; a salted one-way hash
of IP for signed-out rate limiting; plan status and a Stripe customer ID;
moderation reports. **Not processed:** name (unless volunteered), address,
date of birth, phone, payment card details (Stripe only), location,
biometrics, and **any personal data about a child** (see Step 4).

**Context.** Data subjects are adults (18+, enforced at signup) who are
self-selecting for ADHD support and may be in distress at the time of use.
This creates a duty of care beyond the legal minimum. The relationship is
direct B2C, with a free tier and a paid tier. Users have high expectations of
confidentiality for this category of content.

**Purposes.** To deliver the requested features; to enforce fair-use limits;
to keep the social spaces safe; to take payment; to fix faults.

## Step 3 — Consultation

Not formally consulted: no DPO is required (we are not a public authority, do
not conduct large-scale systematic monitoring, and do not process special
category data at scale). Users are informed via the Privacy Policy. Suppliers'
security posture assessed via their published documentation and DPAs. **Action:
seek professional review before scaling marketing.**

## Step 4 — Necessity and proportionality

**Lawful bases** (see Privacy Policy for the per-item table): _contract_ for
account, features and billing; _legitimate interests_ for abuse prevention,
security logging and moderation (LIA summary: the interest is protecting users
and the service; the processing is minimal and expected; users can object);
_legal obligation_ for retaining billing and certain moderation records.

**Special category data.** We do not ask for health data and none is required.
Users may nonetheless volunteer text that reveals a mental or emotional state.
We do not infer, tag, or use any health characteristic; such text is treated as
ordinary user content, is never used for advertising or model training, and is
deleted on request. **Open question flagged for legal review:** whether the
product's ADHD-specific context means Article 9 attaches, and whether an
explicit-consent step at signup is prudent.

**Data minimisation measures actually implemented:**

- Anonymous use is possible without an account; sign-in requires only an email.
- No name, DOB, address, or phone is ever requested.
- Signed-out rate limiting uses a one-way hash — the IP itself is never stored.
- AI requests carry the user's text plus numeric context only; no identifiers.
- **Parents Mode holds zero child data on our servers** (Step 5).
- Social content defaults to private; public sharing requires an explicit 18+
  confirmation and is downgraded server-side if absent.

**Purpose limitation.** No secondary use: no advertising, no sale, no
profiling, no model training on user content.

## Step 5 — Children's data (the central risk, and how it was eliminated)

Parents Mode originally stored a child record (optional name, age band,
free-text) plus reward and wins tables. That was **removed by design**:

| Data                                                                                       | Location                       | On our servers?                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| Child nickname (optional; UI steers to "or leave blank")                                   | Parent's device (localStorage) | **No**                                                                               |
| Age band (4–7 / 8–12 / 13–17)                                                              | Parent's device                | **No** — passed per request to the AI as a throwaway content parameter, never stored |
| Reward chart, tokens                                                                       | Parent's device                | **No**                                                                               |
| "Wins about my kid" notes                                                                  | Parent's device                | **No**                                                                               |
| Child DOB, exact age, photo, voice, school, location, health, diagnosis, behaviour history | Nowhere — no field exists      | **No**                                                                               |
| Parent's Parents-Mode on/off flag                                                          | Parent's own account row       | Yes (parent data)                                                                    |

**Technical evidence:** database migration `0023` drops the `children`,
`kid_rewards` and `kid_wins` tables; a committed audit script asserts their
absence and **fails** if they reappear (`scripts/db-integrity-audit.mjs`).
Parents-space social posts reject photo uploads server-side. Kid-facing
screens emit **no analytics events at all**. There is no child login, no child
account, and no session or interaction history about a child anywhere.

**Children's Code (Age Appropriate Design Code) position.** Children are not
users of ADHV; the service is 18+ and no child data is processed. The
standards are nonetheless honoured in spirit on kid-facing shared screens:
data minimisation (nothing collected), no profiling, no nudge techniques, no
behavioural advertising, no third-party trackers, no external links, high
privacy by default.

**COPPA (US):** the service is directed at adults and collects no data from
children, so COPPA should not attach. Flagged for confirmation if actively
marketed in the US.

## Step 6 — Identify and assess risks

Likelihood/severity scored _low / medium / high_; risk is the combination.

| #   | Risk                                                                             | Likelihood | Severity | Risk       |
| --- | -------------------------------------------------------------------------------- | ---------- | -------- | ---------- |
| R1  | Unauthorised access to another user's private text (broken authorisation / IDOR) | Low        | High     | **Medium** |
| R2  | A crisis disclosure is met with an AI task list instead of support               | Low        | High     | **Medium** |
| R3  | Child personal data enters the system via Parents Mode or a parent's post        | Low        | High     | **Medium** |
| R4  | Third-party AI provider misuses or retains user text                             | Low        | High     | **Medium** |
| R5  | Data breach at a processor (database/hosting)                                    | Low        | High     | **Medium** |
| R6  | Abusive user harms another user in social features                               | Medium     | Medium   | **Medium** |
| R7  | Excessive retention — data kept after the user expects deletion                  | Low        | Medium   | **Low**    |
| R8  | User can't exercise rights (access/erasure)                                      | Low        | Medium   | **Low**    |
| R9  | Special category data processed without a valid Article 9 condition              | Medium     | Medium   | **Medium** |
| R10 | Account takeover via compromised email inbox (magic link)                        | Low        | High     | **Medium** |

## Step 7 — Measures to reduce risk

| #   | Measures implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Residual risk     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| R1  | Row-level security on every table; every API route authorises server-side; object-level checks on every id-addressable resource; storage in private buckets with short-lived signed URLs only. **Verified by two committed live harnesses** (cross-user isolation 20/20; full social API 65/65) that fail CI-style on any regression.                                                                                                                                                   | **Low**           |
| R2  | Deterministic (non-AI) crisis and safeguarding gates run **before** any AI call on every free-text surface; on detection the app returns a compassionate signpost (Samaritans / Childline / NSPCC / 999) and generates nothing. Never paywalled. Prompt-level backstop additionally required in every AI prompt and **enforced by an 87-assertion automated test** that fails the build if any prompt loses it. Adversarial phrasing battery run (22/23; the miss is a false-positive). | **Low**           |
| R3  | Zero child-data architecture (Step 5); server-side rejection of photos in the Parents space; safeguarding screen on every parent free-text field; Terms and Guidelines prohibit identifying a child; kid screens emit no telemetry.                                                                                                                                                                                                                                                     | **Low**           |
| R4  | Paid Gemini API terms (no training on submitted data); minimal payload (no identifiers); TLS in transit; no retention by us of the request beyond the stored result the user owns.                                                                                                                                                                                                                                                                                                      | **Low**           |
| R5  | Reputable processors under DPAs (Supabase, Vercel, Stripe, Google, Resend); EU regions where offered; encryption in transit and at rest; least-privilege keys, service-role key server-only; secrets never in the client bundle or git history (scanned).                                                                                                                                                                                                                               | **Low**           |
| R6  | Report on every object; block/mute (silent, bidirectional); multi-reporter auto-hide with human review; deterministic abuse screen; AI tone-guard nudge; per-minute write limits; no follower counts or rankings by design (removes the incentive structure that drives most harm).                                                                                                                                                                                                     | **Low–Medium**    |
| R7  | Documented retention schedule; immediate hard delete on account deletion with cascade (verified); no server retention of AI inputs; anonymous counters roll off.                                                                                                                                                                                                                                                                                                                        | **Low**           |
| R8  | One-tap self-service deletion in-product; rights explained in the Privacy Policy with a one-month response commitment.                                                                                                                                                                                                                                                                                                                                                                  | **Low**           |
| R9  | No health data requested or inferred; no advertising or profiling use; **flagged for legal review** with a consent step ready to implement if advised.                                                                                                                                                                                                                                                                                                                                  | **Medium — open** |
| R10 | Magic-link only (nothing to phish or reuse); short-lived links; session revocation available; guidance to secure the inbox in the Terms.                                                                                                                                                                                                                                                                                                                                                | **Low**           |

## Step 8 — Sign off and record outcomes

| Item                           | Outcome                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Residual risks accepted        | R1–R8, R10 reduced to Low / Low–Medium and accepted                                               |
| **Open risk requiring advice** | **R9 (Article 9 / special category)** — obtain professional confirmation before scaling marketing |
| DPO advice                     | N/A — no DPO required                                                                             |
| ICO consultation needed?       | No — no high residual risk remains that cannot be mitigated                                       |
| Measures approved by           | Controller, 31 July 2026                                                                          |
| Review date                    | On any material change to data flows, or within 12 months                                         |

**Actions outstanding:** (1) ~~ICO registration and fee~~ — **done, 4 Aug 2026,
reference ZC213841**; (2) accept processor DPAs in each supplier dashboard;
(3) professional review of R9 and of the Terms/Privacy; (4) re-run this DPIA if
child data, advertising, or automated decision-making is ever introduced.

**Renewal:** the ICO registration must be renewed by **3 August 2027**. Lapsing
is a criminal offence under s.137 DPA 2018, so this date belongs in a calendar,
not only in this document.
