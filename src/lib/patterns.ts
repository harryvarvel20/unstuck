import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Patterns — what the app has noticed about you.
 *
 * **There is no AI in this file, and there must not be.** Every other
 * reflective feature asks a model to say something about the user; this reads
 * what they actually did and reports it. That difference is the point. An
 * observation is trustworthy precisely because nothing generated it — "you
 * finished 14 things this week" is either true or it isn't.
 *
 * Two rules govern everything here:
 *
 * 1. **Never claim a pattern from noise.** Each insight declares its own
 *    minimum sample size and stays hidden below it. Telling someone "mornings
 *    are your best time" on the strength of three data points is a guess
 *    wearing the costume of an insight, and being wrong about someone's own
 *    life is worse than saying nothing.
 *
 * 2. **Never judge.** This audience has spent a lifetime being told what is
 *    wrong with them. Nothing here is phrased as a correction, a target, or a
 *    streak to protect. "Tuesdays are harder for you" is information;
 *    "you're worst on Tuesdays" is a verdict. Same number, different app.
 */

export interface Pattern {
  id: string;
  emoji: string;
  /** The observation itself. Short, concrete, past tense where possible. */
  headline: string;
  /** What it means, or what to do with it. Never an instruction. */
  detail: string;
}

export interface PatternsResult {
  patterns: Pattern[];
  /** Completions considered. Drives the "keep going" empty state. */
  samples: number;
}

/** How much evidence each insight needs before it earns a place. */
const MIN_FOR_HOUR = 8;
const MIN_FOR_WEEKDAY = 12;
const MIN_FOR_MOMENTUM = 3;
const MIN_FOR_PERSISTENCE = 4;

/** Rows scanned. ~3 months of steady use; keeps the picture current. */
const WINDOW_ROWS = 400;

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Local hour for a UTC timestamp, given the client's offset in minutes. */
function localParts(iso: string, tzOffsetMinutes: number) {
  const shifted = new Date(new Date(iso).getTime() - tzOffsetMinutes * 60_000);
  return { hour: shifted.getUTCHours(), day: shifted.getUTCDay() };
}

/** "just after 9am", "around 2pm" — how a person says a time, not "14:00". */
function describeHour(hour: number): string {
  if (hour === 0) return "around midnight";
  if (hour < 12) return `around ${hour}am`;
  if (hour === 12) return "around midday";
  return `around ${hour - 12}pm`;
}

function partOfDay(hour: number): string {
  if (hour < 12) return "mornings";
  if (hour < 17) return "afternoons";
  if (hour < 21) return "evenings";
  return "late nights";
}

/**
 * Compute what we can honestly say about this user.
 *
 * `tzOffsetMinutes` is the client's `Date.getTimezoneOffset()`. Timestamps are
 * stored in UTC, and "you finish best at 9am" is meaningless in the wrong
 * timezone — a user in Sydney would be told their productive hour is the
 * middle of the night.
 */
export async function computePatterns(
  supabase: SupabaseClient,
  userId: string,
  tzOffsetMinutes: number,
): Promise<PatternsResult> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [completionsRes, sessionsRes] = await Promise.all([
    supabase
      .from("step_completions")
      .select("estimated_minutes, actual_minutes, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(WINDOW_ROWS),
    supabase
      .from("focus_sessions")
      .select("completed, struggled, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(WINDOW_ROWS),
  ]);

  const completions = completionsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const patterns: Pattern[] = [];

  // --- When you actually get things done -----------------------------------
  if (completions.length >= MIN_FOR_HOUR) {
    const byHour = new Array<number>(24).fill(0);
    for (const c of completions) {
      byHour[localParts(String(c.created_at), tzOffsetMinutes).hour]! += 1;
    }
    const best = byHour.indexOf(Math.max(...byHour));
    const share = byHour[best]! / completions.length;

    // Only worth saying if that hour genuinely stands out. Otherwise the
    // "peak" is just where the noise happened to land.
    if (share >= 0.18) {
      patterns.push({
        id: "best-hour",
        emoji: "🌅",
        headline: `You get going ${describeHour(best)}.`,
        detail: `More of your steps land ${partOfDay(best)} than any other time. Worth putting the hard thing there when you get the choice.`,
      });
    }
  }

  // --- The day that's heavier ----------------------------------------------
  if (completions.length >= MIN_FOR_WEEKDAY) {
    const byDay = new Array<number>(7).fill(0);
    for (const c of completions) {
      byDay[localParts(String(c.created_at), tzOffsetMinutes).day]! += 1;
    }
    const max = Math.max(...byDay);
    const min = Math.min(...byDay);
    // Needs a real gap — every week has a lowest day by definition.
    if (max >= min * 2.5 && max >= 4) {
      patterns.push({
        id: "best-day",
        emoji: "📅",
        headline: `${DAYS[byDay.indexOf(max)]}s are your strongest day.`,
        detail: `And ${DAYS[byDay.indexOf(min)]}s are the quietest. Not a problem to fix — just useful to know before you plan something big.`,
      });
    }
  }

  // --- Momentum, counted honestly ------------------------------------------
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = completions.filter(
    (c) => new Date(String(c.created_at)).getTime() >= weekAgo,
  ).length;

  if (thisWeek >= MIN_FOR_MOMENTUM) {
    patterns.push({
      id: "this-week",
      emoji: "✅",
      headline: `${thisWeek} things finished this week.`,
      detail:
        "Each one was a thing you didn't think you'd start. That's the whole game.",
    });
  }

  // --- Pushing through the hard ones ---------------------------------------
  const struggledAndFinished = sessions.filter(
    (s) => s.struggled === true && s.completed === true,
  ).length;

  if (struggledAndFinished >= MIN_FOR_PERSISTENCE) {
    patterns.push({
      id: "persistence",
      emoji: "💪",
      headline: `${struggledAndFinished} times you carried on when it was hard.`,
      detail:
        "You marked those sessions as a struggle and finished them anyway. Worth remembering on a day you think you never follow through.",
    });
  }

  return { patterns, samples: completions.length };
}
