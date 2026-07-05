import { describe, it, expect } from "vitest";
import { chooseDopamine, isStale, type DopaItem } from "../dopamenu";

function item(
  id: string,
  course: DopaItem["course"],
  minutes: number,
): DopaItem {
  return { id, course, text: id, minutes, shows: 0, picks: 0 };
}

describe("chooseDopamine", () => {
  const items: DopaItem[] = [
    item("a1", "appetiser", 3),
    item("a2", "appetiser", 5),
    item("s1", "side", 15),
    item("e1", "entree", 30),
    item("sp1", "special", 45),
  ];

  it("returns at most 3", () => {
    expect(chooseDopamine(items, 60).length).toBeLessThanOrEqual(3);
  });

  it("only offers quick appetisers for a tiny window (<=5m)", () => {
    const out = chooseDopamine(items, 5);
    expect(out.length).toBeGreaterThan(0);
    for (const o of out) expect(o.course).toBe("appetiser");
  });

  it("never offers something far longer than the window", () => {
    const out = chooseDopamine(items, 20);
    for (const o of out) expect(o.minutes).toBeLessThanOrEqual(20 + 5);
  });

  it("falls back to all items rather than returning empty", () => {
    const onlyLong = [item("e1", "entree", 30)];
    expect(chooseDopamine(onlyLong, 5).length).toBeGreaterThan(0);
  });
});

describe("isStale (shown a lot, never picked)", () => {
  it("is stale after 6+ shows with 0 picks", () => {
    expect(isStale({ ...item("x", "side", 10), shows: 6, picks: 0 })).toBe(
      true,
    );
  });
  it("is not stale if it's ever been picked", () => {
    expect(isStale({ ...item("x", "side", 10), shows: 9, picks: 1 })).toBe(
      false,
    );
  });
  it("is not stale before 6 shows", () => {
    expect(isStale({ ...item("x", "side", 10), shows: 3, picks: 0 })).toBe(
      false,
    );
  });
});
