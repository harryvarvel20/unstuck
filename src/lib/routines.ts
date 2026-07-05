/** A single routine step. */
export interface RoutineStep {
  title: string;
  minutes: number;
  /** The AI marks which steps can be dropped when time is short. */
  skippable: boolean;
}

export interface Routine {
  id: string;
  name: string;
  kind: string;
  steps: RoutineStep[];
}

/**
 * Resilience, not rigidity — the #1 competitor complaint. If the time left is
 * less than the full routine needs, drop skippable steps (largest first) until
 * it fits, keeping every non-skippable step. Late compresses to a "minimum
 * viable version"; it never breaks the chain. Returns which steps survive and
 * whether it was trimmed.
 */
export function compressToFit(
  steps: RoutineStep[],
  minutesAvailable: number,
): { steps: RoutineStep[]; trimmed: boolean; fullMinutes: number } {
  const fullMinutes = steps.reduce((a, s) => a + (s.minutes || 0), 0);
  if (fullMinutes <= minutesAvailable) {
    return { steps, trimmed: false, fullMinutes };
  }

  const essential = steps.filter((s) => !s.skippable);
  const optional = steps
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.skippable)
    .sort((a, b) => b.s.minutes - a.s.minutes); // drop biggest first

  const dropped = new Set<number>();
  let total = fullMinutes;
  for (const { s, i } of optional) {
    if (total <= minutesAvailable) break;
    dropped.add(i);
    total -= s.minutes;
  }

  const kept = steps.filter((_, i) => !dropped.has(i));
  // If even the essentials overflow, we still keep them all — a routine with
  // no skippable slack is honoured in full (late ≠ failed).
  return {
    steps: kept.length > 0 ? kept : essential,
    trimmed: dropped.size > 0,
    fullMinutes,
  };
}
