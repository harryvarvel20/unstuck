import { describe, it, expect } from "vitest";
import { computePatterns } from "../patterns";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Patterns must never claim something it cannot evidence. These tests pin the
 * thresholds, because the failure mode is not a crash — it is confidently
 * telling someone a false thing about their own life, which they have no way
 * to check and every reason to believe.
 */

interface Row {
  created_at: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  completed?: boolean;
  struggled?: boolean;
}

/** Minimal Supabase stub: two tables, one query shape. */
function db(completions: Row[], sessions: Row[] = []): SupabaseClient {
  const build = (rows: Row[]) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: async () => ({ data: rows, error: null }),
      then: undefined,
    };
    return chain;
  };
  return {
    from: (t: string) =>
      build(t === "step_completions" ? completions : sessions),
  } as unknown as SupabaseClient;
}

/** `n` completions, all at the same local hour on the same weekday. */
function atHour(n: number, hour: number, dayOffset = 0): Row[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7, 3 + dayOffset, hour, 0, 0));
    d.setUTCDate(d.getUTCDate() - i * 7); // same weekday, weeks apart
    return {
      created_at: d.toISOString(),
      estimated_minutes: 10,
      actual_minutes: 10,
    };
  });
}

describe("patterns — evidence thresholds", () => {
  it("says nothing at all from an empty history", async () => {
    const r = await computePatterns(db([]), "u", 0);
    expect(r.patterns).toEqual([]);
    expect(r.samples).toBe(0);
  });

  it("will not claim a best hour from too few completions", async () => {
    const r = await computePatterns(db(atHour(5, 9)), "u", 0);
    expect(r.patterns.find((p) => p.id === "best-hour")).toBeUndefined();
  });

  it("claims a best hour once there is enough, and names it in local time", async () => {
    const r = await computePatterns(db(atHour(12, 9)), "u", 0);
    const p = r.patterns.find((x) => x.id === "best-hour");
    expect(p).toBeDefined();
    expect(p!.headline).toContain("9am");
  });

  it("respects the caller's timezone", async () => {
    // 09:00 UTC with offset -60 (UTC+1) is 10am locally.
    const r = await computePatterns(db(atHour(12, 9)), "u", -60);
    const p = r.patterns.find((x) => x.id === "best-hour");
    expect(p!.headline).toContain("10am");
  });

  it("will not call a weekday 'strongest' without a real gap", async () => {
    // Evenly spread across the week — every day has a max by definition,
    // and reporting it would be reporting noise.
    const even: Row[] = [];
    for (let d = 0; d < 7; d++) even.push(...atHour(3, 11, d));
    const r = await computePatterns(db(even), "u", 0);
    expect(r.patterns.find((p) => p.id === "best-day")).toBeUndefined();
  });

  it("counts persistence only when the user both struggled AND finished", async () => {
    const sessions: Row[] = [
      ...Array.from({ length: 5 }, () => ({
        created_at: new Date().toISOString(),
        struggled: true,
        completed: true,
      })),
      // Struggled and gave up — real, but not this observation.
      {
        created_at: new Date().toISOString(),
        struggled: true,
        completed: false,
      },
    ];
    const r = await computePatterns(db([], sessions), "u", 0);
    const p = r.patterns.find((x) => x.id === "persistence");
    expect(p).toBeDefined();
    expect(p!.headline).toContain("5 times");
  });

  it("never phrases an observation as a failing", async () => {
    const many: Row[] = [];
    for (let d = 0; d < 7; d++) many.push(...atHour(d === 1 ? 14 : 2, 9, d));
    const r = await computePatterns(db(many), "u", 0);

    // This audience has heard enough about what's wrong with them.
    const banned =
      /\b(should|must|need to|fail|failed|lazy|bad|worst|poor|only managed)\b/i;
    for (const p of r.patterns) {
      expect(banned.test(p.headline), `headline: ${p.headline}`).toBe(false);
      expect(banned.test(p.detail), `detail: ${p.detail}`).toBe(false);
    }
  });
});
