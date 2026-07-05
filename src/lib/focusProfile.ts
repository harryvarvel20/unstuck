export interface FocusSignal {
  pulled_in: boolean;
  title: string | null;
  hour: number;
  created_at: string;
}

export const MIN_SIGNALS = 6;

export interface GoldenHours {
  enough: boolean;
  samples: number;
  /** The 1-3 hours with the best pull-in rate (min 2 samples each). */
  peakHours: number[];
  /** Hours with the worst pull-in rate — the "kryptonite" windows. */
  lowHours: number[];
}

export function computeGoldenHours(signals: FocusSignal[]): GoldenHours {
  const buckets = new Map<number, { pulled: number; total: number }>();
  for (const s of signals) {
    const b = buckets.get(s.hour) ?? { pulled: 0, total: 0 };
    b.total += 1;
    if (s.pulled_in) b.pulled += 1;
    buckets.set(s.hour, b);
  }

  const rated = [...buckets.entries()]
    .filter(([, b]) => b.total >= 2)
    .map(([hour, b]) => ({ hour, rate: b.pulled / b.total, total: b.total }));

  rated.sort((a, b) => b.rate - a.rate);
  const peakHours = rated
    .filter((r) => r.rate >= 0.6)
    .slice(0, 3)
    .map((r) => r.hour);
  const lowHours = rated
    .filter((r) => r.rate <= 0.34)
    .slice(-2)
    .map((r) => r.hour);

  return {
    enough: signals.length >= MIN_SIGNALS,
    samples: signals.length,
    peakHours,
    lowHours,
  };
}

export function hourLabel(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

/** The next golden hour from now, if any — for gentle "slot it there" nudges. */
export function nextGoldenHour(
  peakHours: number[],
  currentHour: number,
): number | null {
  if (peakHours.length === 0) return null;
  const sorted = [...peakHours].sort((a, b) => a - b);
  return sorted.find((h) => h > currentHour) ?? sorted[0] ?? null;
}
