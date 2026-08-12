# ADHV — Legal & Compliance Pack

**Version 1.0 · 31 July 2026**

> **Read this first.** Everything in this folder was **self-completed by the
> controller with AI assistance**. It has **not been reviewed by a solicitor**.
> Self-completion is a legitimate route that the ICO and Ofcom actively
> support for small businesses — both publish templates and toolkits for
> exactly this — but it is not legal advice, and the documents are only as
> good as their factual accuracy. Before relying on them in a dispute, or
> before scaling marketing, get them reviewed. Where a document depends on a
> judgement a lawyer should make, it says so explicitly rather than guessing.

## What's here

| Document                                 | What it is                                        | Why it exists                                                                                     |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DPIA.md`                                | Data Protection Impact Assessment                 | Required where processing is high-risk. Triggered here by vulnerable users + a children's context |
| `ROPA.md`                                | Record of Processing Activities (Art. 30)         | The definitive map of what data is processed, why, on what basis, and for how long                |
| `OSA-ILLEGAL-CONTENT-RISK-ASSESSMENT.md` | Online Safety Act illegal-content risk assessment | Legal duty for a user-to-user service                                                             |
| `OSA-CHILDRENS-ACCESS-ASSESSMENT.md`     | Online Safety Act children's access assessment    | Legal duty; concludes children's duties are **not** triggered, with reasoning                     |
| `RETENTION-AND-BREACH.md`                | Retention schedule + breach response procedure    | Art. 5(1)(e) and Art. 33/34 — includes the 72-hour ICO process and an incident log                |
| `SAFEGUARDING-POLICY.md`                 | Crisis and safeguarding policy                    | States exactly what the product does on a disclosure, and its limits, honestly                    |
| `AFFILIATE-TERMS.md`                     | Creator/affiliate partnership terms               | ASA/CAP compliance — the #ad disclosure duty falls on the brand as well as the creator            |

**User-facing documents live in the app**, not here: `/terms`, `/privacy`,
`/guidelines`, `/accessibility`.

## Outstanding actions (in priority order)

| #   | Action                                                                                                                                                 | Cost          | Blocking?                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **Register with the ICO** and pay the data protection fee                                                                                              | ~£52/yr       | **Yes — legally required.** Note: the Privacy Policy deliberately does _not_ claim registration until this is done |
| 2   | Accept/download each processor's **DPA** (Supabase, Vercel, Google, Stripe, Resend, PostHog) and file copies here                                      | Free, ~30 min | Should be done before launch                                                                                       |
| 3   | **Professional review** of: Terms, Privacy, the Article 9 question (does ADHD-context text make this special category data?), and both OSA assessments | Varies        | Before scaling marketing                                                                                           |
| 4   | Confirm **COPPA** non-applicability if marketing into the US                                                                                           | —             | Before US marketing                                                                                                |
| 5   | **Trademark search** on "ADHV"                                                                                                                         | —             | Before significant brand spend                                                                                     |
| 6   | Issue `AFFILIATE-TERMS.md` to every creator and keep their written acceptance                                                                          | Free          | Before the first creator posts                                                                                     |
| 7   | Decide **sole trader vs limited company** (affects Stripe account, liability, tax)                                                                     | —             | Before real revenue                                                                                                |

## Known open questions flagged for a lawyer

1. **Article 9 / special category data.** Users write free-text that can reveal
   mental or emotional state, and the product is explicitly for people with
   ADHD. We do not ask for, infer, tag, or commercially use health data — but
   whether Art. 9 attaches is a judgement call. If it does, an explicit-consent
   step is the likely remedy; the hook for it exists at signup. _(DPIA risk R9,
   the single open Medium risk.)_
2. **Consumer Contracts Regulations wording.** The Terms use the standard
   digital-content immediate-supply waiver alongside a 4-day free trial. The
   drafting is conventional but should be confirmed.
3. **OSA proportionality.** Our conclusion is that the systems are
   proportionate for a small, paid, adults-only service with no stranger
   contact and no amplification. Worth a second opinion before growth.

## Maintenance

Review annually, and immediately whenever any of these happen:

- a new free-text field or user-to-user feature is added (**a text field
  without a safety gate is a defect**);
- any child data would be stored server-side (would require redoing the DPIA
  and the children's access assessment);
- a new processor or an international transfer is introduced;
- advertising, profiling, or automated decision-making is introduced;
- an incident occurs (log it in `RETENTION-AND-BREACH.md`).
