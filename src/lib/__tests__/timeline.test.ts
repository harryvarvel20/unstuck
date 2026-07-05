import { describe, it, expect } from "vitest";
import {
  calibrateMinutes,
  hhmmToMinutes,
  minutesToHhmm,
  buildTimeline,
  reflowFromNow,
  type TimelineItem,
} from "../timeline";

describe("calibrateMinutes", () => {
  it("scales by the ratio", () => {
    expect(calibrateMinutes(10, 1)).toBe(10);
    expect(calibrateMinutes(10, 1.5)).toBe(15);
  });
  it("rounds small values to the nearest minute (>=1)", () => {
    expect(calibrateMinutes(2, 1)).toBe(2);
    expect(calibrateMinutes(1, 0.1)).toBe(1); // never rounds below 1
  });
  it("rounds larger values to the nearest 5", () => {
    expect(calibrateMinutes(22, 1)).toBe(20);
    expect(calibrateMinutes(23, 1)).toBe(25);
  });
  it("handles a ratio that pushes a small est over the 10-minute boundary", () => {
    expect(calibrateMinutes(8, 2)).toBe(15); // 16 -> nearest 5
  });
});

describe("hhmm <-> minutes round-trip", () => {
  it("converts both directions consistently", () => {
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(minutesToHhmm(570)).toBe("09:30");
    expect(minutesToHhmm(0)).toBe("00:00");
    expect(minutesToHhmm(23 * 60 + 59)).toBe("23:59");
  });
  it("pads single digits", () => {
    expect(minutesToHhmm(65)).toBe("01:05");
  });
});

describe("buildTimeline", () => {
  const items: TimelineItem[] = [
    { id: "a", title: "A", minutes: 30 },
    { id: "b", title: "B", minutes: 45 },
  ];
  it("lays tasks end-to-end from the start time", () => {
    const { entries } = buildTimeline(items, { startAt: 540, ratio: 1 });
    const tasks = entries.filter((e) => e.kind === "task");
    expect(tasks[0]?.start).toBe(540);
    // second task starts at or after the first task's end (breaks may sit between)
    expect(tasks[1]?.start ?? 0).toBeGreaterThanOrEqual(540 + 30);
  });
  it("applies the calibration ratio to durations", () => {
    const end = (r: { entries: { start: number; minutes: number }[] }) =>
      Math.max(...r.entries.map((e) => e.start + e.minutes));
    const slow = buildTimeline(items, { startAt: 540, ratio: 1.5 });
    const fast = buildTimeline(items, { startAt: 540, ratio: 1 });
    expect(end(slow)).toBeGreaterThan(end(fast));
  });
  it("never produces overlapping task blocks", () => {
    const { entries } = buildTimeline(items, { startAt: 540, ratio: 1 });
    const sorted = [...entries].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1]!.start + sorted[i - 1]!.minutes;
      expect(sorted[i]!.start).toBeGreaterThanOrEqual(prevEnd);
    }
  });
});

describe("reflowFromNow", () => {
  it("does not schedule anything into the past", () => {
    const items: TimelineItem[] = [
      { id: "a", title: "A", minutes: 30 },
      { id: "b", title: "B", minutes: 30 },
    ];
    const reflowed = reflowFromNow(items, 600, { ratio: 1 });
    for (const e of reflowed.entries) {
      expect(e.start).toBeGreaterThanOrEqual(600);
    }
  });
});
