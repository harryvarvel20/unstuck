/**
 * "Pick for me" — pure decision logic, no AI, no I/O. One next step chosen
 * by: smallest-first (momentum), fits-available-time (calibrated minutes),
 * and a simple time-of-day energy heuristic (late evening → prefer tiny).
 */

export interface PickCandidate {
  /** Stable identity for reroll exclusion, e.g. "task:<id>:3" or "local:2". */
  key: string;
  taskId: string | null;
  taskInput: string | null;
  stepIndex: number;
  title: string;
  minutes: number;
  /** Calibrated (Time-Truth-adjusted) minutes; equals minutes when unknown. */
  calMinutes: number;
  tip?: string;
  /** The owning task's completed_steps, so a remote pick can be marked done. */
  completedSteps?: boolean[];
}

export interface PickResult {
  pick: PickCandidate | null;
  /** True when nothing fit the available window and we fell back to tiniest. */
  fallback: boolean;
}

export function choosePick(
  candidates: PickCandidate[],
  availableMinutes: number,
  hourOfDay: number,
  exclude: string[],
): PickResult {
  const pool = candidates.filter((c) => !exclude.includes(c.key));
  if (pool.length === 0) return { pick: null, fallback: false };

  // Late evening: energy is usually lower — prefer genuinely tiny steps.
  const isLateEvening = hourOfDay >= 20 || hourOfDay < 5;

  let fits = pool.filter((c) => c.calMinutes <= availableMinutes);
  if (isLateEvening) {
    const tiny = fits.filter((c) => c.calMinutes <= 15);
    if (tiny.length > 0) fits = tiny;
  }

  const smallestFirst = (a: PickCandidate, b: PickCandidate) =>
    a.calMinutes - b.calMinutes;

  if (fits.length > 0) {
    const sorted = [...fits].sort(smallestFirst);
    return { pick: sorted[0] ?? null, fallback: false };
  }

  // Nothing fits the window — offer the tiniest thing anyway. Momentum
  // beats perfection.
  const sorted = [...pool].sort(smallestFirst);
  return { pick: sorted[0] ?? null, fallback: true };
}
