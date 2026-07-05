export type ImpulseCategory = "buy" | "say" | "commit" | "quit";

export interface Impulse {
  id: string;
  what: string;
  category: ImpulseCategory;
  amount: number | null;
  wait_until: string;
  outcome: "acted" | "passed" | null;
  created_at: string;
  resolved_at: string | null;
}

export const CATEGORY_META: Record<
  ImpulseCategory,
  { label: string; emoji: string; big: boolean }
> = {
  buy: { label: "Buy something", emoji: "🛒", big: true },
  say: { label: "Say / send something", emoji: "💬", big: false },
  commit: { label: "Commit to something", emoji: "🤝", big: true },
  quit: { label: "Quit something", emoji: "🚪", big: true },
};

/** Wait window: 4 hours normally, 24 for big-ticket categories/amounts. */
export function waitMs(
  category: ImpulseCategory,
  amount: number | null,
): number {
  const big = CATEGORY_META[category].big || (amount ?? 0) >= 100;
  return (big ? 24 : 4) * 60 * 60 * 1000;
}

export interface ImpulseInsight {
  total: number;
  passed: number;
  acted: number;
  poundsPaused: number;
  poundsSpent: number;
  topCategory: ImpulseCategory | null;
  /** 0-100 share of impulses logged in the 20:00–04:00 window. */
  nightPct: number;
  peakHourLabel: string | null;
}

/** Fascinating self-knowledge, never a scold. Pure — computed from the log. */
export function computeInsight(impulses: Impulse[]): ImpulseInsight {
  const total = impulses.length;
  let passed = 0;
  let acted = 0;
  let poundsPaused = 0;
  let poundsSpent = 0;
  const catCount: Record<string, number> = {};
  const hourCount: number[] = new Array(24).fill(0);
  let night = 0;

  for (const im of impulses) {
    catCount[im.category] = (catCount[im.category] ?? 0) + 1;
    const h = new Date(im.created_at).getHours();
    hourCount[h] = (hourCount[h] ?? 0) + 1;
    if (h >= 20 || h < 4) night++;
    if (im.outcome === "passed") {
      passed++;
      if (im.category === "buy" && im.amount) poundsPaused += im.amount;
    } else if (im.outcome === "acted") {
      acted++;
      if (im.category === "buy" && im.amount) poundsSpent += im.amount;
    }
  }

  let topCategory: ImpulseCategory | null = null;
  let topN = 0;
  for (const [k, v] of Object.entries(catCount)) {
    if (v > topN) {
      topN = v;
      topCategory = k as ImpulseCategory;
    }
  }

  let peakHour = -1;
  let peakN = 0;
  hourCount.forEach((n, h) => {
    if (n > peakN) {
      peakN = n;
      peakHour = h;
    }
  });

  return {
    total,
    passed,
    acted,
    poundsPaused: Math.round(poundsPaused),
    poundsSpent: Math.round(poundsSpent),
    topCategory,
    nightPct: total > 0 ? Math.round((night / total) * 100) : 0,
    peakHourLabel:
      peakHour >= 0 ? `${peakHour.toString().padStart(2, "0")}:00` : null,
  };
}
