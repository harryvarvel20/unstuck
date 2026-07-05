/**
 * Shared safety layer for the social surface (Phase U).
 *
 * Two independent screens, both deterministic (no AI cost, no latency):
 *  - crisis language → the write is handled compassionately (posts/comments
 *    are not published; DMs still deliver to the friend but the sender sees
 *    the signpost). Server-side, always.
 *  - abuse screen → content saves but is flagged for human review.
 */

const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(?:ing)?\s+myself\b/i,
  /\bsuicid/i,
  /\bself[\s-]?harm/i,
  /\bhurt(?:ing)?\s+myself\b/i,
  /\bend(?:ing)?\s+(?:it\s+all|my\s+life)\b/i,
  /\bwant(?:\s+to)?\s+(?:die|be\s+dead)\b/i,
  /\bbetter\s+off\s+(?:dead|without\s+me)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bcan'?t\s+go\s+on\b/i,
];

export function containsCrisisLanguage(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

/** UK-first compassionate signpost — same voice everywhere. */
export const CRISIS_SIGNPOST =
  "It sounds like you're carrying something really heavy right now. This bit of the app isn't the right place for it — not because it doesn't matter, but because you deserve real support. Please reach out to someone you trust, or call Samaritans free, any time, on 116 123. If you're in immediate danger, call 999.";

/**
 * Very small deterministic abuse screen. Deliberately conservative: it only
 * FLAGS for human review (never auto-deletes, never auto-punishes) — false
 * positives cost nothing to the writer.
 */
const ABUSE_PATTERNS: RegExp[] = [
  /\b(?:stupid|pathetic|worthless|useless)\s+(?:idiot|loser|freak)\b/i,
  /\bkill\s+yourself\b/i,
  /\bkys\b/i,
  /\byou(?:'re|\s+are)\s+(?:worthless|pathetic|disgusting)\b/i,
  /\bnobody\s+likes\s+you\b/i,
  /\bhate\s+you\b/i,
];

export function looksAbusive(text: string): boolean {
  return ABUSE_PATTERNS.some((re) => re.test(text));
}

/**
 * Child-safety + safeguarding screen for Parents Mode (Phase W). Runs on every
 * parent AND kid-facing free-text field. Deliberately broad: a child at risk,
 * abuse, or a safeguarding worry routes to help instead of any AI output.
 * Free, never gated.
 */
const CHILD_SAFETY_PATTERNS: RegExp[] = [
  ...CRISIS_PATTERNS,
  /\b(?:hit|hitting|hurt|hurting|smack\w*|beat\w*)\s+(?:my|the|our|their)?\s*(?:child|kid|son|daughter|baby)\b/i,
  /\b(?:my|the|our)\s*(?:child|kid|son|daughter)\b[^.]*\b(?:self[\s-]?harm|cutting|suicidal|wants?\s+to\s+die|kill\w*)\b/i,
  /\b(?:abuse|abused|abusing|molest\w*|groom\w*|touching\s+(?:me|them|him|her))\b/i,
  /\b(?:unsafe|in\s+danger|being\s+hurt|scared\s+of\s+(?:dad|mum|mom|him|her|them))\b/i,
  /\bafraid\s+i(?:'ll|\s+will)?\s+hurt\b/i,
];

export function childSafetyConcern(text: string): boolean {
  return CHILD_SAFETY_PATTERNS.some((re) => re.test(text));
}

/** UK-first safeguarding signpost for Parents Mode. Region-aware later. */
export const CHILD_SAFETY_SIGNPOST =
  "This sounds really important — and bigger than anything an app should handle. Please reach out to people who can help right now. For a child: Childline, free any time, on 0800 1111. For you as an adult worried about a child: the NSPCC Helpline on 0808 800 5000. If you need to talk, Samaritans are free on 116 123. If anyone is in immediate danger, call 999 or go to A&E.";
