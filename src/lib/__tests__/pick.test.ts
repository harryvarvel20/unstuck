import { describe, it, expect } from "vitest";
import { choosePick, type PickCandidate } from "../pick";

function cand(key: string, calMinutes: number): PickCandidate {
  return {
    key,
    taskId: null,
    taskInput: null,
    stepIndex: 0,
    title: key,
    minutes: calMinutes,
    calMinutes,
  };
}

describe("choosePick", () => {
  const pool = [cand("tiny", 5), cand("mid", 20), cand("big", 60)];

  it("returns nothing from an empty pool", () => {
    expect(choosePick([], 30, 12, []).pick).toBeNull();
  });

  it("picks the smallest step that fits the window", () => {
    const r = choosePick(pool, 30, 12, []);
    expect(r.pick?.key).toBe("tiny");
    expect(r.fallback).toBe(false);
  });

  it("respects the exclude list (reroll)", () => {
    const r = choosePick(pool, 30, 12, ["tiny"]);
    expect(r.pick?.key).toBe("mid");
  });

  it("falls back to the tiniest when nothing fits, flagged as fallback", () => {
    const r = choosePick([cand("big", 60)], 10, 12, []);
    expect(r.pick?.key).toBe("big");
    expect(r.fallback).toBe(true);
  });

  it("late evening prefers genuinely tiny steps (<=15m) when available", () => {
    const late = [cand("smallish", 15), cand("chunky", 45)];
    const r = choosePick(late, 60, 23, []); // 60m free, but it's 11pm
    expect(r.pick?.key).toBe("smallish");
  });
});
