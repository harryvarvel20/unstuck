import { BreakdownScreen } from "@/components/BreakdownScreen";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTimeTruth, type TimeTruth } from "@/lib/timeTruth";
import type { SessionUser, TaskRecord, BreakdownStep } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AppPageProps {
  searchParams: Promise<{ task?: string; intent?: string }>;
}

export default async function AppPage({ searchParams }: AppPageProps) {
  const { task: taskId, intent } = await searchParams;
  // The Navigator can hand off a task to pre-fill the composer.
  const initialInput = intent ? intent.slice(0, 500) : undefined;

  let user: SessionUser | null = null;
  let initialTask: TaskRecord | null = null;
  let isPro = false;
  let timeTruth: TimeTruth | null = null;
  let plannedFirst: BreakdownStep | null = null;

  const supabase = await createSupabaseServer();
  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
      user = { id: authUser.id, email: authUser.email ?? null };

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", authUser.id)
        .maybeSingle();
      isPro = profile?.plan === "pro";

      // Time Truth surfaces only for Pro; data gathers for everyone.
      if (isPro) {
        timeTruth = await getTimeTruth(supabase, authUser.id);
      }

      // Last night's wind-down: tomorrow-you chose one tiny first action.
      const today = new Date().toISOString().slice(0, 10);
      const { data: plan } = await supabase
        .from("plans")
        .select("today")
        .eq("kind", "winddown")
        .eq("plan_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const firstItem = Array.isArray(plan?.today)
        ? (plan.today[0] as { title?: string; minutes?: number } | undefined)
        : undefined;
      if (firstItem?.title) {
        plannedFirst = {
          title: firstItem.title,
          minutes:
            typeof firstItem.minutes === "number" ? firstItem.minutes : 5,
        };
      }

      if (taskId) {
        const { data } = await supabase
          .from("tasks")
          .select("id, input_text, steps, completed_steps, created_at")
          .eq("id", taskId)
          .maybeSingle();

        if (data) {
          initialTask = {
            id: data.id,
            input_text: data.input_text,
            steps: (data.steps ?? []) as BreakdownStep[],
            completed_steps: (data.completed_steps ?? []) as boolean[],
            created_at: data.created_at,
          };
        }
      }
    }
  }

  return (
    <BreakdownScreen
      user={user}
      initialTask={initialTask}
      isPro={isPro}
      timeTruth={timeTruth}
      plannedFirst={plannedFirst}
      initialInput={initialInput}
    />
  );
}
