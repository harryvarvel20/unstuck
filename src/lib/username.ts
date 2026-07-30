/**
 * Username rules for the Activity Center (Phase Y1).
 *
 * Pure and deterministic so it can be unit-tested and shared by the availability
 * check, the set/change endpoint, and the client mirror. The SERVER is always
 * authoritative — the client uses this only to give fast feedback.
 *
 * Rules:
 *  - 3-20 characters after normalisation
 *  - allowed: a-z, 0-9, underscore, period (lowercase only)
 *  - no leading/trailing separator, no consecutive separators
 *  - trim + NFKC-normalise + strip zero-width; anything outside the ASCII set
 *    above is rejected, which also blocks homoglyph/confusable characters
 *  - reserved words + a profanity/slur blocklist (also checked with separators
 *    stripped, to defeat "a.d.m.i.n" style evasion)
 *
 * The normalised value is BOTH the stored handle and the uniqueness key, so
 * uniqueness is inherently case-insensitive.
 */

import { containsCrisisLanguage, looksAbusive } from "./safety";

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/** Reserved words nobody may take (checked case-insensitively, separators stripped). */
const RESERVED = new Set([
  "admin",
  "adhv",
  "support",
  "moderator",
  "mod",
  "official",
  "help",
  "system",
  "root",
  "staff",
  "team",
  "everyone",
  "here",
  "null",
  "undefined",
  "me",
  "you",
  "anon",
  "anonymous",
]);

/**
 * Profanity/slur blocklist. Deliberately a tight starter set of unambiguous
 * terms (substring-matched on the separator-stripped handle). Expand with a
 * maintained list before scale - kept small here to avoid false positives.
 */
const PROFANITY: string[] = [
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "rapist",
  "kike",
  "spic",
  "chink",
  "tranny",
  "paedo",
  "pedo",
  "cunt",
  "fuck",
  "shit",
  "bitch",
  "slut",
  "whore",
];

// Zero-width space/joiners, word-joiner, BOM, and soft-hyphen: invisible
// characters that could hide inside an otherwise "clean" string. Built from
// code points so the source file stays pure ASCII.
const ZERO_WIDTH_CODES = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad];
const ZERO_WIDTH = new RegExp(
  `[${ZERO_WIDTH_CODES.map((c) => String.fromCharCode(c)).join("")}]`,
  "g",
);

export type HandleError =
  | "empty"
  | "too_short"
  | "too_long"
  | "charset"
  | "separator"
  | "reserved"
  | "profanity"
  | "unsafe";

export const HANDLE_ERROR_MESSAGE: Record<HandleError, string> = {
  empty: "Pick a name to continue.",
  too_short: `Names are at least ${HANDLE_MIN} characters.`,
  too_long: `Names are at most ${HANDLE_MAX} characters.`,
  charset: "Use only letters, numbers, dots and underscores.",
  separator: "Can't start or end with . or _, or repeat them.",
  reserved: "That name is reserved - please pick another.",
  profanity: "Let's keep names kind - please pick another.",
  unsafe: "That name isn't available - please pick another.",
};

/** Trim, NFKC-normalise, strip zero-width, lowercase. Not validation - just shaping. */
export function normalizeHandle(raw: string): string {
  return raw.normalize("NFKC").replace(ZERO_WIDTH, "").trim().toLowerCase();
}

export type HandleResult =
  { ok: true; handle: string; key: string } | { ok: false; error: HandleError };

/**
 * Validate a candidate. On success returns the canonical handle and its
 * uniqueness key (identical - handles are stored lowercase). On failure returns
 * a specific error code.
 */
export function validateHandle(raw: string): HandleResult {
  const h = normalizeHandle(raw ?? "");
  if (h.length === 0) return { ok: false, error: "empty" };
  if (h.length < HANDLE_MIN) return { ok: false, error: "too_short" };
  if (h.length > HANDLE_MAX) return { ok: false, error: "too_long" };
  if (!/^[a-z0-9._]+$/.test(h)) return { ok: false, error: "charset" };
  if (/^[._]/.test(h) || /[._]$/.test(h) || /[._]{2,}/.test(h)) {
    return { ok: false, error: "separator" };
  }

  const collapsed = h.replace(/[._]/g, "");
  if (RESERVED.has(h) || RESERVED.has(collapsed)) {
    return { ok: false, error: "reserved" };
  }
  if (PROFANITY.some((w) => collapsed.includes(w))) {
    return { ok: false, error: "profanity" };
  }
  // Crisis / abuse moderation on the raw string (defence in depth).
  if (containsCrisisLanguage(raw) || looksAbusive(raw)) {
    return { ok: false, error: "unsafe" };
  }

  return { ok: true, handle: h, key: h };
}

const SUGGEST_ADJ = [
  "bright",
  "calm",
  "steady",
  "gentle",
  "sunny",
  "quiet",
  "bold",
  "mellow",
  "brave",
  "swift",
  "warm",
  "lucid",
  "merry",
  "keen",
];
const SUGGEST_NOUN = [
  "otter",
  "fox",
  "wren",
  "lark",
  "maple",
  "comet",
  "pebble",
  "willow",
  "ember",
  "meadow",
  "summit",
  "clover",
  "tide",
  "birch",
];

/**
 * A fresh, valid, NON-PII suggestion (never derived from a real name or email).
 * Guaranteed to pass validateHandle and to be <= HANDLE_MAX.
 */
export function suggestHandle(): string {
  const a = SUGGEST_ADJ[Math.floor(Math.random() * SUGGEST_ADJ.length)];
  const n = SUGGEST_NOUN[Math.floor(Math.random() * SUGGEST_NOUN.length)];
  const num = Math.floor(10 + Math.random() * 90); // two digits keeps it short
  return `${a}_${n}_${num}`;
}
