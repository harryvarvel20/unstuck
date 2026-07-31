import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildCheckinPrompt,
  buildPhotoPrompt,
  buildSidewaysPrompt,
  buildBrainDumpPrompt,
  buildConnectMessagePrompt,
  buildStretchPrompt,
  buildProfilePrompt,
  buildIdeaPrompt,
  buildDopamenuPrompt,
  buildDecompressPrompt,
  buildDecompressActionPrompt,
  buildSpiralPrompt,
  buildRoutinePrompt,
  buildReentryPrompt,
  buildNavigatorPrompt,
  buildParentPlanPrompt,
  buildParentReframePrompt,
  buildParentHomeworkPrompt,
  buildCpsPrompt,
  buildSchoolDraftPrompt,
  type BreakdownMode,
  type CheckinPhase,
} from "../gemini";

/**
 * Z1 invariant proof: EVERY AI prompt builder carries the crisis/safeguarding
 * rule and the strict-JSON output contract. If someone adds or edits a prompt
 * and drops the rule, this suite fails in CI.
 *
 * (Two builders are deliberately absent: buildToneGuardPrompt and
 * buildPlaybookDraftPrompt. Their route — /api/social/assist — runs the
 * deterministic containsCrisisLanguage gate BEFORE any AI call (added in Z1
 * as fix Z1-D4), so crisis text never reaches those prompts at all.)
 */

const SAMARITANS = "116 123";
const CHILDLINE = "0800 1111";
const NSPCC = "0808 800 5000";

/** Every adult-surface prompt, exercised across its full input space. */
const ADULT_PROMPTS: [string, string][] = [
  ...(["normal", "smaller", "subtask", "rescue"] as BreakdownMode[]).map(
    (mode): [string, string] => [
      `buildSystemPrompt(${mode})`,
      buildSystemPrompt({ mode, input: "x" }),
    ],
  ),
  ...(["start", "midpoint", "complete", "timeup"] as CheckinPhase[]).map(
    (phase): [string, string] => [
      `buildCheckinPrompt(${phase})`,
      buildCheckinPrompt(phase),
    ],
  ),
  ["buildPhotoPrompt", buildPhotoPrompt()],
  ["buildSidewaysPrompt", buildSidewaysPrompt(4, 1.5)],
  ["buildBrainDumpPrompt", buildBrainDumpPrompt(6, 1)],
  ["buildConnectMessagePrompt", buildConnectMessagePrompt()],
  ["buildStretchPrompt", buildStretchPrompt(["novelty"])],
  ["buildProfilePrompt", buildProfilePrompt()],
  ["buildIdeaPrompt", buildIdeaPrompt()],
  ["buildDopamenuPrompt(fresh)", buildDopamenuPrompt(true)],
  ["buildDopamenuPrompt(starter)", buildDopamenuPrompt(false)],
  ["buildDecompressPrompt", buildDecompressPrompt()],
  [
    "buildDecompressActionPrompt(reframe)",
    buildDecompressActionPrompt("reframe"),
  ],
  [
    "buildDecompressActionPrompt(repair)",
    buildDecompressActionPrompt("repair"),
  ],
  ["buildSpiralPrompt", buildSpiralPrompt()],
  ["buildRoutinePrompt", buildRoutinePrompt(1.2)],
  ["buildReentryPrompt", buildReentryPrompt()],
  ["buildNavigatorPrompt", buildNavigatorPrompt()],
];

/** Every parent-surface prompt (child-safeguarding rule required). */
const PARENT_PROMPTS: [string, string][] = [
  ["buildParentPlanPrompt", buildParentPlanPrompt("warm tone")],
  ["buildParentReframePrompt", buildParentReframePrompt("warm tone")],
  ["buildParentHomeworkPrompt", buildParentHomeworkPrompt("warm tone")],
  ["buildCpsPrompt", buildCpsPrompt("warm tone")],
  ["buildSchoolDraftPrompt", buildSchoolDraftPrompt()],
];

describe("crisis rule on every adult AI surface", () => {
  for (const [name, prompt] of ADULT_PROMPTS) {
    it(`${name} carries the Samaritans crisis rule`, () => {
      expect(prompt).toContain(SAMARITANS);
      expect(prompt.toLowerCase()).toContain("crisis");
    });
  }
});

describe("safeguarding rule on every parents AI surface", () => {
  for (const [name, prompt] of PARENT_PROMPTS) {
    it(`${name} carries Childline / NSPCC / 999 safeguarding`, () => {
      expect(prompt).toContain(CHILDLINE);
      expect(prompt).toContain(NSPCC);
      expect(prompt).toContain("999");
    });
    it(`${name} never frames the child as defiant/manipulative`, () => {
      expect(prompt).toContain("kids do well if they can");
    });
  }
});

describe("strict-JSON output contract on every prompt", () => {
  for (const [name, prompt] of [...ADULT_PROMPTS, ...PARENT_PROMPTS]) {
    it(`${name} demands JSON-only output`, () => {
      expect(prompt.toUpperCase()).toContain("JSON");
    });
  }
});

describe("zero-shame voice", () => {
  for (const [name, prompt] of ADULT_PROMPTS) {
    it(`${name} forbids shame/moralising`, () => {
      const p = prompt.toLowerCase();
      expect(
        p.includes("never shame") || p.includes("no shame"),
        `${name} should carry the zero-shame rule`,
      ).toBe(true);
    });
  }
});
