import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Drift guard for the Parents → Activity Center share.
 *
 * A shared parenting win is tagged with the tool that produced it, so the
 * parents space becomes a record of what actually worked rather than a
 * generic feed. That tag comes from `TOOL_TAGS` in ShareParentWin, keyed by
 * the tile title in WithChildView.
 *
 * Those two lists live in different files, so renaming a tile — "Feelings
 * check" → "How are you feeling?" — would silently drop the tag to the
 * "parents" fallback. Nothing would break, no test would fail, and the feed
 * would quietly stop attributing wins to that feature. This catches it.
 */

const root = process.cwd();
const withChild = readFileSync(
  join(root, "src", "components", "parents", "WithChildView.tsx"),
  "utf8",
);
const share = readFileSync(
  join(root, "src", "components", "parents", "ShareParentWin.tsx"),
  "utf8",
);

/** Tile titles from the `tiles` array in WithChildView. */
function tileTitles(): string[] {
  const block = withChild.slice(
    withChild.indexOf("const tiles"),
    withChild.indexOf("return ("),
  );
  return [...block.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]!);
}

/** Keys of the TOOL_TAGS map in ShareParentWin. */
function taggedTools(): string[] {
  const block = share.slice(
    share.indexOf("const TOOL_TAGS"),
    share.indexOf("interface Props"),
  );
  return [...block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => m[1]!);
}

describe("Parents share — tool tagging", () => {
  it("finds both lists", () => {
    expect(tileTitles().length).toBeGreaterThan(0);
    expect(taggedTools().length).toBeGreaterThan(0);
  });

  it("every shared-screen tool has a tag", () => {
    const tagged = new Set(taggedTools());
    for (const title of tileTitles()) {
      expect(
        tagged.has(title),
        `"${title}" is a tile in WithChildView but has no entry in TOOL_TAGS ` +
          `(ShareParentWin). Wins from it would be tagged with the generic ` +
          `"parents" fallback, so the feed would stop attributing them to the ` +
          `feature. Add it to TOOL_TAGS.`,
      ).toBe(true);
    }
  });

  it("has no orphaned tags for tools that no longer exist", () => {
    const titles = new Set(tileTitles());
    for (const tool of taggedTools()) {
      expect(
        titles.has(tool),
        `TOOL_TAGS has "${tool}" but no such tile exists in WithChildView.`,
      ).toBe(true);
    }
  });

  it("tags are slugs — lowercase, no spaces, within the 24-char API limit", () => {
    const block = share.slice(
      share.indexOf("const TOOL_TAGS"),
      share.indexOf("interface Props"),
    );
    for (const m of block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
      const tag = m[2]!;
      expect(tag, `tag for "${m[1]}"`).toMatch(/^[a-z0-9-]+$/);
      // createSchema caps tags at 24 chars; a longer one is rejected as
      // `invalid` and the share fails with no useful message.
      expect(
        tag.length,
        `tag "${tag}" exceeds the API's 24-char limit`,
      ).toBeLessThanOrEqual(24);
    }
  });

  it("shares into the parents space, never the main feed", () => {
    // The parents space is gated on Parents Mode and carries a higher
    // child-safety bar. A win about a child must not land in the main feed.
    expect(share).toContain('space: "parents"');
    expect(share).not.toContain('space: "main"');
  });

  it("surfaces the safeguarding signpost verbatim and stops", () => {
    // POST /api/social/posts runs childSafetyConcern() before storing
    // anything. Its wording must reach the parent unaltered.
    expect(share).toContain("body.crisis");
    expect(share).toContain("body.message");
  });
});
