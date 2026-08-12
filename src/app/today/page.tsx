import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TodayTimeline } from "@/components/TodayTimeline";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** The ADHD calendar: today as a timeline that bends instead of breaking. */
export default async function TodayPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/today");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Today
        </h1>
        <p className="mt-2 text-muted">
          Real durations, real breaks, real get-ready time. The past just fades
          — it doesn&apos;t fail.
        </p>

        <div className="mt-6">
          {isPro ? (
            <TodayTimeline />
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6">
              <p className="text-text">
                The timed day plan is a Pro thing — your tasks laid out at your
                real pace, with breaks and transition buffers built in, and
                deadline heads-ups that are kind instead of shouty.
              </p>
              <Link
                href="/pricing"
                className="grad-primary mt-5 inline-block rounded-2xl px-5 py-3 font-semibold shadow-soft"
              >
                See Pro — 4-day free trial
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </footer>
    </div>
  );
}
