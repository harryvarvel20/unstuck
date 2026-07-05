import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { RoutinesScreen } from "@/components/RoutinesScreen";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Resilient routines — bend on rushed days instead of breaking. */
export default async function RoutinesPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/routines");

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
          Routines
        </h1>
        <p className="mt-2 text-muted">
          Start late and they compress to a minimum viable version — the
          must-dos survive. Late isn&apos;t failed.
        </p>

        <div className="mt-6">
          {isPro ? (
            <RoutinesScreen />
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6">
              <p className="text-text">
                Routine builder is a Pro thing — answer three questions, get a
                flexible routine you can run one step at a time.
              </p>
              <Link
                href="/pricing"
                className="grad-primary mt-5 inline-block rounded-2xl px-5 py-3 font-semibold shadow-soft"
              >
                See Pro — 7-day free trial
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
