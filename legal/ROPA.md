# ADHV — Record of Processing Activities (RoPA)

**Controller:** ADHV (sole trader — Harry Varvel), UK · **Contact:**
harryvarvel@gmail.com · **DPO:** none required
**Version:** 1.0 · **Date:** 31 July 2026 · Art. 30 UK GDPR record.
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

| Processor           | Role                    | Location  | Safeguard                                               |
| ------------------- | ----------------------- | --------- | ------------------------------------------------------- |
| Supabase            | Database, auth, storage | EU        | DPA; SCCs/IDTA as applicable                            |
| Vercel              | Hosting, edge, logs     | US/global | DPA; SCCs/IDTA                                          |
| Google (Gemini API) | AI generation           | US        | DPA; paid-tier terms exclude training on submitted data |
| Stripe              | Payments                | US/EU     | DPA; PCI-DSS; SCCs/IDTA                                 |
| Resend              | Transactional email     | EU        | DPA                                                     |
| PostHog             | Analytics (optional)    | EU        | DPA; cookieless mode                                    |

**Outstanding action:** formally accept/download each processor's DPA from
its dashboard and file copies alongside this record.

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
