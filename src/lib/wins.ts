import type { SupabaseClient } from "@supabase/supabase-js";

/** The week's wins — only ever what they DID. Nothing missed, ever. */
export interface WeekWins {
  stepsDone: number;
  focusMinutes: number;
  /** Things begun: breakdowns made + focus sessions started. */
  startedCount: number;
  /** The biggest-estimate step they took on (their "hardest thing"). */
  hardestTitle: string | null;
  hasAnything: boolean;
}

export async function getWeekWins(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeekWins> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [completions, sessions, tasks] = await Promise.all([
    supabase
      .from("step_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since),
    supabase
      .from("focus_sessions")
      .select("actual_minutes, estimated_minutes, step_title, completed")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(200),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  const stepsDone = completions.count ?? 0;

  const sessionRows = sessions.data ?? [];
  const focusMinutes = Math.round(
    sessionRows.reduce((acc, s) => acc + (Number(s.actual_minutes) || 0), 0),
  );

  const startedCount = (tasks.count ?? 0) + sessionRows.length;

  let hardestTitle: string | null = null;
  let hardestEst = 0;
  for (const s of sessionRows) {
    const est = Number(s.estimated_minutes) || 0;
    if (est > hardestEst && typeof s.step_title === "string" && s.step_title) {
      hardestEst = est;
      hardestTitle = s.step_title;
    }
  }

  return {
    stepsDone,
    focusMinutes,
    startedCount,
    hardestTitle,
    hasAnything: stepsDone > 0 || focusMinutes > 0 || startedCount > 0,
  };
}
