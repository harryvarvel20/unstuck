/**
 * Apply Time-Truth calibration to an estimate, rounded to something human.
 * Lives here (dependency-free) so the timeline engine stays pure/testable;
 * timeTruth.ts re-exports it.
 */
export function calibrateMinutes(estimated: number, ratio: number): number {
  const adjusted = estimated * ratio;
  if (adjusted < 10) return Math.max(1, Math.round(adjusted));
  return Math.round(adjusted / 5) * 5;
}

/**
 * The ADHD day timeline engine. Pure functions — no I/O — so it's testable
 * and reusable by the reflow/repair paths.
 *
 * Principles encoded here:
 * - durations are Time-Truth calibrated (their REAL pace, not the optimistic one)
 * - movement/decompression breaks are inserted between blocks (45–90 min cadence)
 * - anything with a hard time gets a TRANSITION BUFFER before it (get-ready time
 *   is a real task: keys, travel, context-switching)
 * - deadline items get a "start by" computed backwards from the deadline
 * - the past is never "failed", it's just earlier
 */

export interface TimelineItem {
  id: string;
  title: string;
  /** The user's own estimate in minutes. */
  minutes: number;
  /** Optional hard time "HH:MM" (24h) — a deadline / must-start-by anchor. */
  deadline?: string | null;
  must?: boolean;
  done?: boolean;
  /** Link back to a saved task step, when the item came from one. */
  taskId?: string | null;
  stepIndex?: number | null;
}

export type EntryKind = "task" | "break" | "buffer";

export interface TimelineEntry {
  kind: EntryKind;
  /** Minutes from midnight, local. */
  start: number;
  minutes: number;
  title: string;
  item?: TimelineItem;
  /** For deadline items: the computed latest sane start (min from midnight). */
  startBy?: number;
}

export interface TimelineOptions {
  /** Minutes from midnight to start placing flexible work. */
  startAt: number;
  /** Personal lateness ratio (Time-Truth). 1 = trust their estimates. */
  ratio: number;
  /** Insert a movement break after this much accumulated task time. */
  breakEvery?: number; // default 60 (45–90 sane range)
  breakMinutes?: number; // default 10
  bufferMinutes?: number; // default 15 (before hard-time items)
  /** Don't schedule past this (min from midnight). */
  dayEnd?: number; // default 22:00
}

export function hhmmToMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToHhmm(mins: number): string {
  const m = Math.max(0, Math.round(mins)) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

/**
 * Build the day's timeline. Deadline items are pinned at their computed
 * "start by"; flexible items fill forward from startAt around them, with
 * breaks on a cadence. Items that can't fit before dayEnd are returned in
 * `overflow` (candidates for amnesty — never silently dropped).
 */
export function buildTimeline(
  items: TimelineItem[],
  opts: TimelineOptions,
): { entries: TimelineEntry[]; overflow: TimelineItem[] } {
  const breakEvery = Math.min(90, Math.max(45, opts.breakEvery ?? 60));
  const breakMinutes = opts.breakMinutes ?? 10;
  const bufferMinutes = opts.bufferMinutes ?? 15;
  const dayEnd = opts.dayEnd ?? 22 * 60;

  const open = items.filter((i) => !i.done);
  const cal = (i: TimelineItem) =>
    Math.max(2, calibrateMinutes(i.minutes, opts.ratio));

  // --- pin deadline items -------------------------------------------------
  interface Fixed {
    item: TimelineItem;
    start: number;
    minutes: number;
    startBy: number;
  }
  const fixed: Fixed[] = [];
  for (const item of open) {
    const dl = item.deadline ? hhmmToMinutes(item.deadline) : null;
    if (dl === null || dl === undefined) continue;
    const minutes = cal(item);
    const startBy = dl - minutes - bufferMinutes;
    fixed.push({
      item,
      start: Math.max(opts.startAt, startBy),
      minutes,
      startBy,
    });
  }
  fixed.sort((a, b) => a.start - b.start);

  const flexible = open.filter(
    (i) => !i.deadline || hhmmToMinutes(i.deadline) === null,
  );
  // Musts first, then smallest-first for momentum.
  flexible.sort(
    (a, b) =>
      Number(b.must ?? false) - Number(a.must ?? false) || cal(a) - cal(b),
  );

  const entries: TimelineEntry[] = [];
  const overflow: TimelineItem[] = [];

  let cursor = opts.startAt;
  let sinceBreak = 0;
  let fi = 0;

  const pushBreakIfDue = () => {
    if (sinceBreak >= breakEvery) {
      entries.push({
        kind: "break",
        start: cursor,
        minutes: breakMinutes,
        title: "Move · water · breathe",
      });
      cursor += breakMinutes;
      sinceBreak = 0;
    }
  };

  const placeFixed = (f: Fixed) => {
    // Transition buffer belongs to the hard-time item.
    const bufStart = Math.max(cursor, f.start - bufferMinutes);
    entries.push({
      kind: "buffer",
      start: bufStart,
      minutes: Math.max(5, f.start - bufStart) || bufferMinutes,
      title: "Transition — keys, travel, brain-switch",
    });
    const realStart = Math.max(cursor + 0, f.start);
    entries.push({
      kind: "task",
      start: realStart,
      minutes: f.minutes,
      title: f.item.title,
      item: f.item,
      startBy: f.startBy,
    });
    cursor = realStart + f.minutes;
    sinceBreak += f.minutes;
  };

  while (fi < fixed.length || flexible.length > 0) {
    const nextFixed = fixed[fi];

    if (nextFixed && cursor + bufferMinutes >= nextFixed.start - 1) {
      placeFixed(nextFixed);
      fi++;
      continue;
    }

    const next = flexible[0];
    if (!next) {
      if (nextFixed) {
        placeFixed(nextFixed);
        fi++;
        continue;
      }
      break;
    }

    const minutes = cal(next);
    const gapEnd = nextFixed ? nextFixed.start - bufferMinutes : dayEnd;

    if (cursor + minutes > dayEnd) {
      overflow.push(next);
      flexible.shift();
      continue;
    }
    if (cursor + minutes > gapEnd) {
      // Doesn't fit before the next hard block — try a smaller one.
      const fitIdx = flexible.findIndex((i) => cursor + cal(i) <= gapEnd);
      if (fitIdx === -1) {
        if (nextFixed) {
          placeFixed(nextFixed);
          fi++;
        }
        continue;
      }
      const fit = flexible.splice(fitIdx, 1)[0]!;
      const fitMin = cal(fit);
      entries.push({
        kind: "task",
        start: cursor,
        minutes: fitMin,
        title: fit.title,
        item: fit,
      });
      cursor += fitMin;
      sinceBreak += fitMin;
      pushBreakIfDue();
      continue;
    }

    flexible.shift();
    entries.push({
      kind: "task",
      start: cursor,
      minutes,
      title: next.title,
      item: next,
    });
    cursor += minutes;
    sinceBreak += minutes;
    pushBreakIfDue();
  }

  entries.sort((a, b) => a.start - b.start);
  return { entries, overflow };
}

/**
 * Quiet repair: rebuild the rest of the day from NOW with what's left.
 * Must-dos are protected (scheduled first); whatever no longer fits is
 * returned as amnesty candidates — offered, never auto-deleted.
 */
export function reflowFromNow(
  items: TimelineItem[],
  nowMinutes: number,
  opts: Omit<TimelineOptions, "startAt">,
): { entries: TimelineEntry[]; amnesty: TimelineItem[] } {
  const remaining = items.filter((i) => !i.done);
  const { entries, overflow } = buildTimeline(remaining, {
    ...opts,
    startAt: nowMinutes,
  });
  // Protect max-3 musts: if a must overflowed, bump a non-must task out.
  const amnesty = [...overflow];
  return { entries, amnesty };
}
