import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PlanScreen } from "@/components/PlanScreen";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Morning brain dump → a realistic today plan. One screen, one prompt. */
export default async function PlanPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/plan");

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
        <h1 className="text-2xl font-semibold leading-tight text-text sm:text-3xl">
          What&apos;s in your head?
        </h1>
        <p className="mt-2 text-muted">
          Dump it all. I&apos;ll sort it into a day that actually fits — and
          hold the rest so you can stop carrying it.
        </p>

        <div className="mt-6">
          {isPro ? (
            <PlanScreen />
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6">
              <p className="text-text">
                The morning plan is a Pro thing — dump the chaos, get back a
                realistic day built on how you actually use time.
              </p>
              <Link
                href="/pricing"
                className="mt-5 inline-block rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink transition-colors hover:brightness-105"
              >
                See Pro — 4-day free trial
              </Link>
              <p className="mt-4 text-sm text-muted">
                Meanwhile, the{" "}
                <Link href="/app" className="text-accent hover:underline">
                  breakdown screen
                </Link>{" "}
                is always free for the thing you&apos;re avoiding most.
              </p>
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
