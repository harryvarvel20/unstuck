# ADHV — Safeguarding & Crisis Response Policy

**Controller:** ADHV · **Version:** 1.0 · **Date:** 31 July 2026
Self-completed; not legal advice. Reviewed at least annually.

---

## 1. Purpose and scope

ADHV serves adults with ADHD, some of whom will be in distress when they use
it, and supports parents of children with ADHD. This policy states what ADHV
does when someone discloses a crisis or a child-safety concern, and what we
will not do.

It applies to **every free-text field in the product** — task inputs, journal
entries, wins, comments, direct messages, search boxes, parenting inputs, and
kid-facing shared screens.

## 2. Principles

1. **Safety is never paywalled.** Crisis signposting, cool-down and SOS tools
   are available on every plan, including anonymous use.
2. **A person in crisis is not a support ticket for an AI.** When crisis
   language is detected, the app does not generate a task list, a plan, or a
   social post. It shows a warm, non-clinical signpost to real human help.
3. **Detection is deterministic and runs first.** Pattern-based screening runs
   _before_ any AI call, so the response cannot depend on model behaviour. A
   prompt-level rule acts as a second layer, and is enforced by an automated
   test that fails the build if any AI prompt loses it.
4. **We are not a crisis service and never claim to be.** Every surface
   carries the "not therapy or medical advice" disclaimer.
5. **Reaching out is never blocked.** A crisis message sent to a friend by
   direct message is still delivered — silencing someone reaching for help
   would be harmful. The sender is shown support information as well.

## 3. What the user sees

**Adult crisis (self-harm, suicidal ideation, harm to self or others):**
content is not generated or published, and the user is shown a warm message
directing them to someone they trust or to **Samaritans, free, any time, on
116 123**, and to **999 if in immediate danger**.

**Child-safety / safeguarding concern (any parenting or kid-facing surface):**
the same interception, with child-specific resources — **Childline 0800 1111**
(for the child), **NSPCC Helpline 0808 800 5000** (for a worried adult),
**Samaritans 116 123**, and **999 or A&E if anyone is in immediate danger**.

Signposts are compassionate and non-judgemental by design: never "your content
was blocked", always "this matters and you deserve real support".

## 4. Detection scope (implemented)

| Surface                                                                                  | Screened                   | Behaviour on detection                           |
| ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| Task input / breakdowns, photo-to-plan                                                   | Yes                        | No steps generated; signpost                     |
| Journal, wind-down, morning plan, routines, ideas, regulate flows                        | Yes                        | No AI output; signpost                           |
| Navigator search bar                                                                     | Yes                        | No routing; signpost                             |
| Wins/posts, comments                                                                     | Yes                        | **Not published**; signpost                      |
| Activity search box                                                                      | Yes                        | No results; signpost                             |
| Comment tone-guard and playbook drafting                                                 | Yes                        | No AI call; signpost                             |
| Direct messages                                                                          | Yes                        | **Delivered** (see §2.5); sender also signposted |
| Parents: add-child notes, situation plans, reframes, homework helper, CPS, school drafts | Yes (child-safety ruleset) | No AI output; child-safety signpost              |
| Parents: "wins about my kid", reward chart setup                                         | Yes (on-device)            | Not saved; child-safety signpost                 |
| Usernames                                                                                | Yes                        | Rejected                                         |

## 5. Reports involving risk to a person

Users can report any content. Where a report or content indicates:

- **A child at risk of harm** — treat as the highest priority. Remove/hide the
  content immediately, and report to the police (999 if immediate) or the
  NSPCC. Where child sexual abuse material is involved, preserve evidence, do
  not distribute it, report to the police and the Internet Watch Foundation,
  and close the account.
- **An adult at immediate risk to life** — where there is enough information to
  identify a real, imminent risk, contact the emergency services. We do not
  hold enough identifying data to trace users generally, and we say so plainly
  rather than implying a monitoring capability we don't have.
- **Abuse or harassment between users** — apply the moderation process in the
  Community Guidelines.

**We do not monitor private messages proactively.** DMs are screened only for
the sender's own signposting; we do not read them, and no human sees message
content unless it is reported.

## 6. Limits — stated honestly

- Detection is pattern-based and will miss indirect or metaphorical
  disclosures; it is a safety net, not a diagnosis. It errs deliberately
  toward over-flagging (tested: the known failure mode is a false positive).
- ADHV cannot provide crisis intervention, cannot verify identity, and cannot
  reliably locate a user in an emergency.
- ADHV is not a regulated health service and holds no clinical staff.

## 7. Responsibility and review

The provider (sole trader) is the named safeguarding contact and handles all
escalations: **harryvarvel@gmail.com**. If the user base grows materially,
this must be reviewed to introduce defined response times and a second
responder so escalations are never dependent on one person's availability.

Reviewed annually, on any incident, and whenever a new free-text surface is
added — the addition of a text field without a safety gate is treated as a
defect, not a feature request.
