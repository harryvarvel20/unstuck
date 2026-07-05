import type { BreakdownStep } from "./types";

/**
 * Remembers the task the user was mid-flow on, so "Where was I?" can restore
 * it — including for anonymous users whose breakdowns only live in memory.
 */

const KEY = "adhv-lastflow";
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48h — beyond that, fresh start

export interface LastFlow {
  taskId: string | null;
  input: string;
  steps: BreakdownStep[];
  checked: boolean[];
  ts: number;
}

export function saveLastFlow(flow: Omit<LastFlow, "ts">): void {
  if (typeof window === "undefined") return;
  try {
    if (flow.steps.length === 0) return;
    const allDone =
      flow.steps.length > 0 && flow.steps.every((_, i) => flow.checked[i]);
    if (allDone) {
      window.localStorage.removeItem(KEY);
      return;
    }
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...flow, ts: Date.now() } satisfies LastFlow),
    );
  } catch {
    /* storage unavailable */
  }
}

export function loadLastFlow(): LastFlow | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastFlow;
    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return null;
    }
    if (Date.now() - (parsed.ts ?? 0) > MAX_AGE_MS) return null;
    const hasUnchecked = parsed.steps.some((_, i) => !parsed.checked?.[i]);
    if (!hasUnchecked) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastFlow(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
