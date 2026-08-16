import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for a real bug.
 *
 * `.glass` is applied to the fixed desktop nav rail and the fixed bottom tab
 * bar. A decorative rule added `position: relative` to it so a pseudo-element
 * could be anchored — and because `globals.css` loads AFTER
 * `@tailwind utilities`, and `.glass` and `.fixed` are both single-class
 * selectors, the later rule won. Both navigation bars silently stopped being
 * fixed, fell into the document flow, and only appeared once the user
 * scrolled far enough to reach them.
 *
 * Nothing failed. Nothing warned. The build was green.
 *
 * Two rules enforced here:
 *   1. Utilities applied to fixed elements must not set `position`.
 *   2. Utilities that DO set `position` must never land on a positioned
 *      element.
 */

const css = readFileSync(
  join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

/** Body of a top-level `.name { ... }` rule, or null. */
function ruleBody(selector: string): string | null {
  const re = new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`);
  return css.match(re)?.[1] ?? null;
}

/** Utilities that get combined with Tailwind layout classes. */
const MUST_NOT_POSITION = ["glass", "card-featured"];

/** Utilities that legitimately need a positioning context. */
const POSITIONING = ["engine-turned", "watermark"];

const TAILWIND_POSITION = ["fixed", "absolute", "sticky"];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("decorative utilities must not fight Tailwind's layout", () => {
  it("finds the stylesheet", () => {
    expect(css.length).toBeGreaterThan(0);
    expect(ruleBody("glass")).not.toBeNull();
  });

  for (const name of MUST_NOT_POSITION) {
    it(`.${name} does not set position`, () => {
      const body = ruleBody(name);
      expect(body, `.${name} rule not found`).not.toBeNull();
      expect(
        /(^|[;{\s])position\s*:/.test(body!),
        `.${name} sets \`position\`. globals.css loads after @tailwind ` +
          `utilities and both are single-class selectors, so this BEATS ` +
          `.fixed/.absolute/.sticky. .${name} is used on the fixed nav rail ` +
          `and tab bar — setting position here un-fixes them and they scroll ` +
          `away with the page. Draw edges with background-image instead.`,
      ).toBe(false);
    });
  }

  it("no element combines a positioning utility with fixed/absolute/sticky", () => {
    const files = tsxFiles(join(process.cwd(), "src"));
    const problems: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/className="([^"]*)"/g)) {
        const classes = m[1]!.split(/\s+/);
        const deco = POSITIONING.filter((d) => classes.includes(d));
        const pos = TAILWIND_POSITION.filter((p) => classes.includes(p));
        if (deco.length > 0 && pos.length > 0) {
          problems.push(
            `${file.slice(process.cwd().length + 1)}: "${deco.join(", ")}" ` +
              `with "${pos.join(", ")}"`,
          );
        }
      }
    }

    expect(
      problems,
      `These utilities set position: relative for their own marks, so putting ` +
        `them on an already-positioned element overrides its layout:\n` +
        problems.join("\n"),
    ).toEqual([]);
  });

  it("no element claims the same pseudo-element twice", () => {
    // ::before → watermark. ::after → engine-turned, frame-certificate,
    // rule-ornament. Two from one row and one silently disappears.
    const AFTER = ["engine-turned", "frame-certificate", "rule-ornament"];
    const files = tsxFiles(join(process.cwd(), "src"));
    const clashes: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/className="([^"]*)"/g)) {
        const classes = m[1]!.split(/\s+/);
        const hits = AFTER.filter((a) => classes.includes(a));
        if (hits.length > 1) {
          clashes.push(
            `${file.slice(process.cwd().length + 1)}: ${hits.join(" + ")}`,
          );
        }
      }
    }

    expect(clashes, `Both want ::after:\n${clashes.join("\n")}`).toEqual([]);
  });
});
