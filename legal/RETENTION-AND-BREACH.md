# ADHV — Retention Schedule & Personal Data Breach Procedure

**Controller:** ADHV · **Version:** 1.0 · **Date:** 31 July 2026
Self-completed; not legal advice.

---

# Part 1 — Retention schedule

Principle: keep personal data only as long as it serves the purpose it was
collected for. The user is in control of nearly all of it, and account
deletion is immediate and irreversible.

| Data                                                                              | Retention                                           | Trigger / mechanism                                                                                                       |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Account (email, user id)                                                          | Life of account                                     | Hard-deleted immediately on account deletion (cascade verified by test harness)                                           |
| User content (tasks, steps, plans, routines, ideas, journal, wins, comments, DMs) | Life of account, or until the user deletes the item | Self-service delete in-product; cascade on account deletion                                                               |
| Social photos                                                                     | Until the parent item or account is deleted         | Storage object removed with the item                                                                                      |
| Focus/timing data                                                                 | Life of account                                     | Cascade on deletion                                                                                                       |
| Friendships, blocks, buddy pairs                                                  | Life of account                                     | Cascade; blocks are removable by the user                                                                                 |
| **Moderation reports**                                                            | **Up to 12 months** from resolution                 | Needed to spot repeat behaviour and to evidence OSA duties; then deleted                                                  |
| Rate-limit counters (incl. hashed IP)                                             | **≤30 days**                                        | Daily/minute buckets roll off automatically                                                                               |
| **Billing records** (Stripe customer id, invoices, subscription events)           | **6 years**                                         | Legal obligation — UK tax record-keeping. Retained by Stripe; we keep plan status only, which is deleted with the account |
| Support correspondence                                                            | 24 months                                           | Manual mailbox housekeeping                                                                                               |
| Error logs                                                                        | Platform default (short)                            | Vercel retention; contain no PII or content                                                                               |
| Username reservations                                                             | 30 days after release                               | Anti-impersonation cool-down; expired rows purged automatically                                                           |
| **Parents Mode child-related data**                                               | **Never held by us**                                | Device-only; cleared on sign-out, account deletion, remove-child, or one-tap erase                                        |

**Deletion guarantee.** "Delete my account & data" performs an immediate hard
delete of the auth user; every table cascades from it. There is no soft-delete
and no archive copy. Backups held by processors follow their own rotation and
expire naturally; no restore is performed to recover deleted user data.

---

# Part 2 — Personal data breach procedure

A "personal data breach" is any security incident leading to accidental or
unlawful destruction, loss, alteration, unauthorised disclosure of, or access
to personal data. **This includes accidental disclosure by us, not just
attacks.**

## Step 1 — Contain (immediately, target: within 1 hour of discovery)

1. Identify what is exposed and stop the bleeding: revoke/rotate the affected
   credential (Supabase service key, Stripe key, Gemini key, Resend key), or
   take the deployment down via `vercel rollback`.
2. If sessions may be compromised, revoke sessions via Supabase Auth admin.
3. **Do not destroy evidence** — preserve logs before changing anything you
   don't have to.
4. Start a written incident log: time discovered, who by, what is known.

## Step 2 — Assess (target: within 24 hours)

Record: what data, whose, how many people, how it happened, whether it is
recoverable, and what harm could realistically follow (identity fraud,
distress, exposure of sensitive free-text, safeguarding implications).

**Risk decision:**

- **No risk to rights and freedoms** → record internally, no notification.
- **Risk** → notify the ICO (Step 3).
- **High risk** → notify the ICO _and_ affected individuals without undue
  delay (Step 4).

Given ADHV holds mental-health-adjacent free-text, **default to treating any
disclosure of user content as high risk** unless clearly shown otherwise.

## Step 3 — Notify the ICO (**within 72 hours** of becoming aware)

Report at ico.org.uk (or 0303 123 1113). Include: nature of the breach,
categories and approximate number of individuals and records, likely
consequences, measures taken/proposed, and our contact details. **If the full
picture isn't known, report anyway within 72 hours and supply details in
phases** — late reporting is a breach in itself.

## Step 4 — Notify affected users (if high risk, without undue delay)

Plain-English email: what happened, when, what data, what it means for them,
what we've done, what they should do (e.g. secure their email inbox), and how
to contact us and the ICO. No jargon, no minimising, no blame-shifting.

## Step 5 — Learn

Within 14 days: root-cause analysis, fix, and a regression test where the fix
is code. Update this procedure, the DPIA and the RoPA if data flows changed.
Record the outcome in the incident log.

## Contacts and tooling

| Need                                 | Where                                       |
| ------------------------------------ | ------------------------------------------- |
| Rotate DB/service keys               | Supabase dashboard → Project Settings → API |
| Rotate payment keys / inspect events | Stripe dashboard → Developers               |
| Rotate AI key                        | Google AI Studio                            |
| Rotate email key                     | Resend dashboard                            |
| Roll back a bad deploy               | Vercel → Deployments → Instant Rollback     |
| Revoke user sessions                 | Supabase → Authentication → Users           |
| Report to the ICO                    | ico.org.uk · 0303 123 1113                  |

## Incident log (append entries here)

| Date | Discovered by | Summary                | Data affected | Risk decision | ICO notified? | Users notified? | Resolution |
| ---- | ------------- | ---------------------- | ------------- | ------------- | ------------- | --------------- | ---------- |
| —    | —             | _No incidents to date_ | —             | —             | —             | —               | —          |
