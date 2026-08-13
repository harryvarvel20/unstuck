# ADHV — Record of Processing Activities (RoPA)

**Controller:** ADHV (sole trader — Harry Varvel), UK · **Contact:**
harryvarvel@gmail.com · **DPO:** none required
**ICO registration:** ZC213841 — registered 4 Aug 2026, expires 3 Aug 2027
**Version:** 1.1 · **Date:** 10 Aug 2026 · Art. 30 UK GDPR record.
Self-completed; not legal advice.

> Art. 30(5) exempts organisations under 250 staff _except_ where processing
> is not occasional, or could risk rights and freedoms, or involves special
> category data. ADHV's processing is regular and involves potentially
> sensitive free-text, so we keep a full record voluntarily.

## A. Processing activities

| #   | Activity                                                                                                 | Categories of data subject    | Categories of personal data                                                                                                                                  | Purpose                                                           | Lawful basis                                                  | Recipients                                                | Transfers                               | Retention                                                                               |
| --- | -------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | **Account & authentication**                                                                             | Registered users (adults 18+) | Email address; user id; timestamps                                                                                                                           | Create and secure the account; passwordless sign-in               | Contract                                                      | Supabase (auth/db); Resend (email delivery)               | EU/UK hosting; Resend EU                | Life of account; deleted immediately on account deletion                                |
| 2   | **Core app features** (breakdowns, plans, routines, timeline, wind-down, ideas, journal, focus sessions) | Registered users              | Free-text the user writes; generated steps; completion and timing data                                                                                       | Deliver the requested feature and retain the user's own work      | Contract                                                      | Supabase; Google (Gemini API — transient, for generation) | Gemini API (US) under supplier DPA/SCCs | Life of account; user can delete individual items any time                              |
| 3   | **AI generation**                                                                                        | Registered + anonymous users  | The text submitted, plus numeric context (available hours, pace ratio, age band). **No identifiers sent**                                                    | Generate steps/plans/drafts                                       | Contract (registered); legitimate interests (anonymous demo)  | Google (Gemini API)                                       | US, supplier DPA/SCCs                   | Not retained by us beyond the resulting item the user owns; not used for model training |
| 4   | **Activity Center (social)**                                                                             | Pro users who opt in          | Handle; display name; wins/posts; comments; reactions; direct messages; boosts; challenge membership; buddy pairing; friendship records; visibility settings | Operate the opt-in social layer for the audience the user chooses | Contract                                                      | Supabase; (photos) Supabase Storage                       | EU                                      | Life of account or until user deletes the item                                          |
| 5   | **Social photos**                                                                                        | Pro users who opt in          | Images uploaded to a post, DM or challenge (EXIF stripped client-side)                                                                                       | Let users attach an image                                         | Contract                                                      | Supabase Storage (private bucket, signed URLs)            | EU                                      | Until the item or account is deleted                                                    |
| 6   | **Rate limiting & abuse prevention**                                                                     | All visitors                  | Per-subject counters; **salted one-way hash of IP** for signed-out users (the IP itself is never stored)                                                     | Enforce free-tier limits; prevent cost abuse and spam             | Legitimate interests (protecting the service and other users) | Supabase                                                  | EU                                      | Daily/minute counters roll off; ≤30 days                                                |
| 7   | **Trust & safety / moderation**                                                                          | Reporters and reported users  | Report records (reporter id, subject type/id, reason, status); block records; flags                                                                          | Keep the social spaces safe; meet online-safety duties            | Legitimate interests; legal obligation (OSA)                  | Supabase                                                  | EU                                      | Up to 12 months from resolution                                                         |
| 8   | **Billing & subscriptions**                                                                              | Paying users                  | Stripe customer id; plan status; subscription events. **No card data ever reaches us**                                                                       | Take payment; grant/revoke Pro                                    | Contract; legal obligation (tax records)                      | Stripe                                                    | US, Stripe DPA/SCCs                     | Plan status: life of account. Financial records: 6 years (tax law)                      |
| 9   | **Product analytics** (optional; disabled unless a key is configured)                                    | All visitors                  | Cookieless event names + non-identifying properties. **No events on kid-facing screens**                                                                     | Understand feature usage in aggregate                             | Consent (where enabled)                                       | PostHog                                                   | EU host                                 | Per PostHog config; no cross-site tracking                                              |
| 10  | **Error logging**                                                                                        | All visitors                  | Error objects and route names. **No message content, no PII, no secrets**                                                                                    | Diagnose faults                                                   | Legitimate interests                                          | Vercel                                                    | US, Vercel DPA                          | Platform default retention                                                              |
| 11  | **Support correspondence**                                                                               | Anyone who emails us          | Email address and the content of the message                                                                                                                 | Answer questions; handle rights requests and appeals              | Legitimate interests; legal obligation (rights requests)      | Email provider                                            | —                                       | 24 months                                                                               |

## B. Processing we deliberately do NOT do

No personal data about children (Parents Mode is device-only — see DPIA §5).
No advertising or ad-tech. No sale or sharing of personal data. No profiling
or automated decision-making with legal or similarly significant effects. No
biometric or location data. No special category data requested or inferred.
No use of user content to train AI models.

## C. Processors and safeguards

| Processor           | Role                    | Location                     | Safeguard                                                                                                                                                                                                                                                                               |
| ------------------- | ----------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase            | Database, auth, storage | **UK (London, `eu-west-2`)** | DPA; **no international transfer for the database itself**                                                                                                                                                                                                                              |
| Vercel              | Hosting, edge, logs     | US/global                    | DPA; SCCs/IDTA                                                                                                                                                                                                                                                                          |
| Google (Gemini API) | AI generation           | US                           | DPA; paid-tier terms exclude training on submitted data                                                                                                                                                                                                                                 |
| Stripe              | Payments                | US/EU                        | DPA; PCI-DSS; SCCs/IDTA                                                                                                                                                                                                                                                                 |
| Resend              | Transactional email     | EU                           | DPA                                                                                                                                                                                                                                                                                     |
| ~~PostHog~~         | ~~Analytics~~           | —                            | **NOT a processor.** Implemented but inert — no `NEXT_PUBLIC_POSTHOG_KEY` exists in any environment, so every `capture()` is a no-op and no data leaves the app. Becomes a processor only when a key is added, at which point a DPA **and** PECR consent gating are both required first |

> **Note on Vercel:** functions run in `lhr1` (London) as of AA3, so compute is
> UK-based. Vercel Inc. remains a US company, hence the transfer safeguard.

## C1. DPA status — Art. 28 evidence register

Art. 28 requires a **written contract** with each processor. An
auto-incorporated DPA satisfies this, but only if the document can be produced
on request — "it was in the terms I accepted" is not evidence.

**Store signed/downloaded copies OUTSIDE this repository** (they may carry the
controller's home address, and the repo is one setting away from public).
Suggested location: `ADHV/legal/DPAs/` in cloud storage.

| Processor       | How obtained                                                                   | Status                                                                        | Date obtained | Evidence filed |
| --------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------- | -------------- |
| Supabase        | Support ticket / `privacy@supabase.com`                                        | **Requested 13 Aug 2026** — awaiting reply on whether a paid plan is required | —             | —              |
| Vercel          | `vercel.com/legal/dpa` — states it applies to Enterprise **and Pro** customers | ☐                                                                             | —             | —              |
| Google (Gemini) | Cloud Data Processing Addendum, normally incorporated into the Cloud terms     | ☐                                                                             | —             | —              |
| Stripe          | DPA forms part of the Services Agreement accepted at activation                | ☐                                                                             | —             | —              |
| Resend          | Request via support                                                            | ☐                                                                             | —             | —              |

**⚠️ Open question with a decision attached:** Supabase's DPA may be gated to
paid plans. If so, the Free plan cannot satisfy Art. 28 for the processor
holding **all** user data — which would make the Pro upgrade a compliance
requirement, not merely a backup one. The support reply settles it.

## D. Technical and organisational measures (Art. 32 summary)

Row-level security on every table; server-side authorisation on every route;
object-level access checks; private storage buckets with short-lived signed
URLs; TLS in transit; encryption at rest by processors; secrets server-side
only and absent from the client bundle and git history; least-privilege keys;
per-user and per-IP rate limiting; security headers (CSP, HSTS, frame-
ancestors none, nosniff, referrer and permissions policy); deterministic
safety gates before AI processing; automated test suite and two live
isolation harnesses that fail on any authorisation regression; immediate hard
deletion with verified cascade on account deletion.

## E. Review

Reviewed on any material change to data flows, processors, or features; at
minimum annually. Owner: the controller.
