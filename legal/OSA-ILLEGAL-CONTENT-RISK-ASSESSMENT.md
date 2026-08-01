# ADHV — Online Safety Act 2023: Illegal Content Risk Assessment

**Service:** ADHV (adhvtool.com) · **Provider:** ADHV (sole trader — Harry
Varvel) · **Contact:** harryvarvel@gmail.com
**Service type:** user-to-user service (Part 3), small service, UK-linked
**Version:** 1.0 · **Date:** 31 July 2026 · **Status:** self-completed,
pending professional review. **Not legal advice.**

> Completed following Ofcom's risk-assessment guidance for small services.
> Kept as a living record; to be reviewed on any significant change to
> functionality, on becoming aware of a new kind of harm, or annually.

---

## 1. Service description

ADHV is a self-management app for adults with ADHD. Its user-to-user surface
("the Activity Center") is opt-in, behind a paid tier, and deliberately
minimal:

- **Wins/posts** with three visibility levels (private / friends / public).
- **Comments** on posts (friends-only by default; can be disabled per post).
- **Direct messages** — 1:1 only, **friends only**, no group chat.
- **Boosts** — short private encouragement notes to a friend.
- **Collective challenges** — a shared progress total, no per-person ranking.
- **Search** over content the searcher is already entitled to see.
- **Parents space** — a separate feed for parents, Parents-Mode users only.

**Explicitly absent by design:** anonymous public posting to strangers, group
chats, live streaming, video/audio, ephemeral content, follower counts,
recommender/ranked feeds, virality mechanics, open discovery of users, and
any way to browse or search for other users.

**User base:** adults 18+ (enforced at signup and by an adult-confirmation
gate before any public sharing). Pre-launch; user numbers currently in single
figures.

## 2. Risk assessment method

For each priority illegal-content kind we assess (a) whether the service's
functionality could plausibly be used to commit or facilitate it, (b)
likelihood given our design and user base, (c) severity, and (d) the controls
in place. Scores: low / medium / high.

## 3. Priority illegal content — assessment

| Kind of illegal content                                                   | Plausible on ADHV?                     | Likelihood                                                                                                                                       | Severity | Risk           | Key controls                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Child sexual exploitation and abuse (CSEA)**, incl. grooming            | Only via DMs or images on public posts | **Low** — no child users, no way to discover or contact strangers, DMs require _mutual_ friendship, no group chat, parents-space uploads blocked | High     | **Low–Medium** | Mutual-consent-only DMs; no stranger contact; no user discovery; image uploads only on main-space posts; report on every object; zero-tolerance policy and immediate escalation/report to authorities; account closure                                                                                                                      |
| **Terrorism**                                                             | Text posts/DMs                         | **Low** — no reach mechanics, no virality, tiny audience                                                                                         | High     | **Low**        | Prohibited in Terms/Guidelines; report + human review; removal and account closure; no amplification exists to exploit                                                                                                                                                                                                                      |
| **Encouraging or assisting suicide**                                      | Text posts/comments/DMs                | **Medium** — the user base is people in distress, so the topic genuinely arises                                                                  | High     | **Medium**     | **Deterministic crisis detection runs before publication on posts and comments — content is not published and the author is shown crisis support instead.** DMs deliver (a friend reaching out must not be silenced) but the sender is also shown support. Prompt-level AI backstop, automatically tested. Report + review. Never paywalled |
| **Harassment, stalking, threats, abuse**                                  | Comments/DMs                           | **Medium**                                                                                                                                       | Medium   | **Medium**     | Mutual-friendship gate for DMs; comments friends-only by default and disableable; silent block/mute severing both directions; deterministic abuse screen flags for review; AI tone-guard nudges unkind drafts pre-post; per-minute write limits; report on every object                                                                     |
| **Hate offences**                                                         | Comments/DMs/posts                     | Low–Medium                                                                                                                                       | Medium   | **Low–Medium** | Same controls as above; explicit prohibition in Terms and Guidelines; removal + closure                                                                                                                                                                                                                                                     |
| **Controlling or coercive behaviour**                                     | DMs                                    | Low                                                                                                                                              | High     | **Low–Medium** | DMs friends-only; block is instant, silent and total; report; guidance signposting support                                                                                                                                                                                                                                                  |
| **Drugs/psychoactive substances; firearms/weapons**                       | Posts/DMs                              | Low                                                                                                                                              | High     | **Low**        | Prohibited; no marketplace, no payments between users, no listings functionality; report + removal                                                                                                                                                                                                                                          |
| **Sexual exploitation of adults; unlawful immigration/human trafficking** | DMs                                    | Low                                                                                                                                              | High     | **Low**        | No stranger contact; no recruitment/advertising surface; report + escalation                                                                                                                                                                                                                                                                |
| **Fraud and financial offences; proceeds of crime**                       | Posts/DMs                              | Low                                                                                                                                              | Medium   | **Low**        | No user-to-user payments; no external link previews; no advertising surface; prohibited; report                                                                                                                                                                                                                                             |
| **Extreme/intimate image abuse; obscenity**                               | Image on a post or DM                  | Low–Medium                                                                                                                                       | High     | **Medium**     | Images only via authenticated upload to private storage; served by short-lived signed URLs; report on every object; removal + closure; EXIF stripped                                                                                                                                                                                        |
| **Foreign interference; epilepsy-trolling (flashing images)**             | Posts                                  | Very low                                                                                                                                         | Medium   | **Low**        | No virality/reach; no video/GIF/animation upload; report                                                                                                                                                                                                                                                                                    |

**Overall service risk: LOW–MEDIUM.** The dominant residual risks are
suicide/self-harm content (inherent to the user base, heavily mitigated) and
interpersonal abuse between connected users.

## 4. Why the design lowers risk structurally

The functionality choices made for ADHD-friendliness happen to remove most
illegal-harm vectors:

1. **No stranger contact.** DMs require accepted mutual friendship; there is
   no user directory, no discovery, no "people you may know", no group chat.
2. **No amplification.** No ranked or recommender feed, no trending, no
   follower counts, no shares/reposts, finite reverse-chronological feeds.
   Content cannot go viral, which is the mechanism most illegal content relies
   on for reach and harm.
3. **No anonymity to strangers.** Posting requires an account and a chosen
   handle; the only anonymity option ("someone with ADHD") applies to public
   wins and does not enable contact.
4. **Small, paid, adult, self-selecting user base.** Participation is behind
   a paid tier and an 18+ gate, which materially reduces bad-actor volume.
5. **Safety is not paywalled**, so no user is ever forced to choose between
   cost and safety.

## 5. Controls, systems and processes (all implemented)

**Prevention.** Deterministic crisis/safeguarding gates before publication and
before any AI call, on every free-text field; abuse pattern screening; AI
tone-guard nudge; per-minute write limits; server-side authorisation on every
action; child-identifying content blocked in the Parents space; no photos
permitted in the Parents space.

**User controls.** Report on every post, comment, message and profile; block
(instant, silent, bidirectional, severs feed/DMs/pairings); mute; comments off
per post or friends-only; DMs off entirely; "quiet the social layer".

**Takedown & review.** Reports are recorded immediately in a review queue with
reporter, subject and status. A single report never removes content (this
prevents weaponised reporting), but **content reported by multiple independent
users is hidden automatically pending human review**. Reporters must have been
entitled to see the content they report — enumerated ids cannot be used to
suppress content. Outcomes: leave / remove / restrict features / suspend /
close. CSEA is escalated immediately and reported to the authorities.

**Complaints.** Users may appeal any decision by email; we review again and
reply. Published in the Terms and Guidelines.

**Record-keeping.** Reports retained (subject, reporter, reason, status,
timestamp) for up to 12 months to identify repeat behaviour. This assessment
and its review history retained as the written record.

## 6. Governance

Sole trader: the provider personally performs review and takedown, is the
named safety contact, and is reachable at harryvarvel@gmail.com. Given single-
figure user numbers this is proportionate; **if the user base grows materially
(indicative trigger: >1,000 active users or >10 reports/week), a documented
moderation rota, defined response-time targets, and escalation contacts must
be introduced.**

## 7. Conclusion and actions

The service is assessed as **low–medium risk** for illegal content, with
proportionate systems in place and verified in code. Actions:

1. Professional/legal review of this assessment before scaling marketing.
2. Record moderation decisions consistently from launch day.
3. Re-assess on: adding group chat, stranger contact, discovery, video, or a
   recommender feed — any of which would materially raise the risk profile.
4. Review at least annually, and after any significant incident.
