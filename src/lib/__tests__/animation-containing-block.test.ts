import { describe, it, expect } from "vitest";
import config from "../../../tailwind.config";

/**
 * Regression guard for a real production bug (Z8-D1).
 *
 * `page-in` and `card-in` animated `transform` and used
 * `animation-fill-mode: both`, which RETAINS the final keyframe forever.
 * Per CSS spec, an element with any transform — including the identity
 * `translateY(0)` — becomes the **containing block for `position: fixed`
 * descendants**. Every modal rendered inside an animated wrapper was
 * therefore trapped inside that wrapper's box instead of filling the
 * viewport, rendering as a tiny scrollable sliver. It broke the Parents
 * add-child sheet and every kid-facing tool.
 *
 * Rule enforced here: an animation may not BOTH animate `transform` AND
 * retain its end state, unless it is an intentional exit animation on a
 * self-unmounting overlay (allowlisted below with a reason).
 */

const RETAINING_FILL_MODES = ["both", "forwards"];

/** name -> why it is safe to retain a transform */
const ALLOWLIST: Record<string, string> = {
  "door-out":
    "exit animation on the Doorway's own fixed full-screen overlay, which " +
    "unmounts immediately after; it wraps no modals and must stay hidden",
};

type Keyframes = Record<string, Record<string, string>>;

// Tailwind types these as "object | resolver function"; in this config they
// are plain objects, so narrow through `unknown`.
const animations = (config.theme?.extend?.animation ?? {}) as unknown as Record<
  string,
  string
>;
const keyframes = (config.theme?.extend?.keyframes ??
  {}) as unknown as Keyframes;

function animatesTransform(name: string): boolean {
  const steps = keyframes[name];
  if (!steps) return false;
  return Object.values(steps).some((decl) =>
    Object.keys(decl).some((prop) => prop.toLowerCase().includes("transform")),
  );
}

function retainsEndState(shorthand: string): boolean {
  return RETAINING_FILL_MODES.some((mode) =>
    new RegExp(`\\b${mode}\\b`).test(shorthand),
  );
}

describe("tailwind animations must not trap fixed-position modals", () => {
  it("has animations defined to check", () => {
    expect(Object.keys(animations).length).toBeGreaterThan(0);
  });

  for (const [name, shorthand] of Object.entries(animations)) {
    it(`"${name}" does not retain a transform`, () => {
      const offends = animatesTransform(name) && retainsEndState(shorthand);
      const allowed = name in ALLOWLIST;
      expect(
        offends && !allowed,
        offends && !allowed
          ? `"${name}" animates transform AND uses a retaining fill-mode ` +
              `("${shorthand}"). A retained transform makes the element a ` +
              `containing block for position:fixed children, which breaks ` +
              `every modal rendered inside it. Use "backwards" instead, or ` +
              `add "${name}" to ALLOWLIST with a reason.`
          : undefined,
      ).toBe(false);
    });
  }

  it("the two animations that caused the bug use `backwards`", () => {
    expect(animations["page-in"]).toContain("backwards");
    expect(animations["card-in"]).toContain("backwards");
    expect(animations["page-in"]).not.toMatch(/\bboth\b/);
    expect(animations["card-in"]).not.toMatch(/\bboth\b/);
  });

  it("opacity-only animations may still retain (they are harmless)", () => {
    // fade-in has no transform, so `both` cannot create a containing block.
    expect(animatesTransform("fade-in")).toBe(false);
  });
});
