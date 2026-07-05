import type { SupabaseClient } from "@supabase/supabase-js";

/** Data points needed before we surface anything. */
export const MIN_SAMPLES = 5;
/** Rolling window of most-recent completions used for calibration. */
const WINDOW = 20;
/** Clamp individual ratios so one outlier can't skew the story. */
const RATIO_MIN = 0.25;
const RATIO_MAX = 8;

export interface TimeTruth {
  /** Median of actual/estimated over the window. 1 = spot on. */
  ratio: number;
  samples: number;
  enough: boolean;
}

/**
 * Compute the user's personal time-blindness calibration: the rolling median
 * of (actual / estimated) across their recent completed steps. Median, not
 * mean — a couple of wild sessions shouldn't rewrite their story.
 */
export async function getTimeTruth(
  supabase: SupabaseClient,
  userId: string,
): Promise<TimeTruth> {
  const { data, error } = await supabase
    .from("step_completions")
    .select("estimated_minutes, actual_minutes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(WINDOW);

  if (error || !data) return { ratio: 1, samples: 0, enough: false };

  const ratios = data
    .filter(
      (r) =>
        typeof r.estimated_minutes === "number" &&
        r.estimated_minutes > 0 &&
        typeof r.actual_minutes === "number" &&
        Number(r.actual_minutes) > 0,
    )
    .map((r) =>
      Math.min(
        RATIO_MAX,
        Math.max(RATIO_MIN, Number(r.actual_minutes) / r.estimated_minutes),
      ),
    );

  if (ratios.length === 0) return { ratio: 1, samples: 0, enough: false };

  const sorted = [...ratios].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;

  return {
    ratio: Math.round(median * 100) / 100,
    samples: ratios.length,
    enough: ratios.length >= MIN_SAMPLES,
  };
}

// Single source of truth lives in ./timeline (dependency-free, pure).
export { calibrateMinutes } from "./timeline";

/** Whether the gap is big enough to be worth mentioning. */
export function ratioIsNotable(ratio: number): boolean {
  return ratio >= 1.15 || ratio <= 0.85;
}
