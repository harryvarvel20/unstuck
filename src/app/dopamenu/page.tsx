import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Dopamenu } from "@/components/Dopamenu";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** The dopamine menu — for "I feel flat/broken" moments. */
export default async function DopamenuPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dopamenu");

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
          Dopamenu
        </h1>
        <p className="mt-2 text-muted">
          A menu of things that reliably lift you. When you feel flat, order
          three, pick one, press play.
        </p>

        <div className="mt-6">
          {isPro ? (
            <Dopamenu />
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6">
              <p className="text-text">
                The dopamine menu is a Pro thing — a personal, living list of
                dopamine hits for the flat moments.
              </p>
              <Link
                href="/pricing"
                className="grad-primary mt-5 inline-block rounded-2xl px-5 py-3 font-semibold shadow-soft"
              >
                See Pro — 5-day free trial
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
