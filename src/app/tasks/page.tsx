import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { BreakdownStep } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  input_text: string;
  steps: BreakdownStep[];
  completed_steps: boolean[];
  created_at: string;
}

export default async function TasksPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/tasks");

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  // Amnestied (archived) tasks stay out of sight — recoverable, never nagging.
  const tasks = ((data ?? []) as (TaskRow & { archived_at?: string | null })[])
    .filter((t) => !t.archived_at)
    .slice(0, 50);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text sm:text-3xl">
            My tasks
          </h1>
          <Link
            href="/app"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:brightness-105"
          >
            New
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-3xl border border-border bg-surface p-8 text-center">
            <div className="mb-3 text-3xl">🌤️</div>
            <p className="text-text">Nothing saved yet.</p>
            <p className="mt-2 text-muted">
              Whatever you break down will show up here, ready to pick back up.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-block rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink transition-colors hover:brightness-105"
            >
              Break something down
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {tasks.map((task) => {
              const total = task.steps.length;
              const done = task.completed_steps.filter(Boolean).length;
              const allDone = total > 0 && done >= total;
              return (
                <li key={task.id}>
                  <Link
                    href={`/app?task=${task.id}`}
                    className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/50 sm:p-5"
                  >
                    <p className="font-medium text-text line-clamp-2">
                      {task.input_text}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                      <span>
                        {done} of {total} done
                      </span>
                      {allDone && (
                        <span className="text-accent">· complete</span>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${total > 0 ? (done / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a productivity tool, not medical advice or treatment.
        </p>
      </footer>
    </div>
  );
}
