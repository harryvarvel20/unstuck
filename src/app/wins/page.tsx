import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { WinsShare } from "@/components/WinsShare";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getWeekWins } from "@/lib/wins";

export const dynamic = "force-dynamic";

/** Weekly wins — only ever what they DID. Zero mention of anything missed. */
export default async function WinsPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/wins");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";

  const wins = isPro ? await getWeekWins(supabase, user.id) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <h1 className="text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Your week
        </h1>
        <p className="mt-2 text-muted">
          Only what you did. Nothing else exists here.
        </p>

        {!isPro ? (
          <div className="mt-6 rounded-3xl border border-border bg-surface p-6">
            <p className="text-text">
              The weekly wins recap is a Pro thing — a beautiful card of what
              you actually did, with zero mention of anything else.
            </p>
            <Link
              href="/pricing"
              className="mt-5 inline-block rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink transition-colors hover:brightness-105"
            >
              See Pro — 4-day free trial
            </Link>
          </div>
        ) : wins && wins.hasAnything ? (
          <div className="mt-6">
            <div className="rounded-3xl border border-accent/40 bg-accent-soft/40 p-6">
              <p className="text-xl font-semibold leading-snug text-text">
                Started {wins.startedCount}{" "}
                {wins.startedCount === 1 ? "thing" : "things"} your brain said
                no to.
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface p-4">
                  <dd className="text-3xl font-bold text-accent">
                    {wins.stepsDone}
                  </dd>
                  <dt className="mt-1 text-sm text-muted">tiny steps done</dt>
                </div>
                <div className="rounded-2xl bg-surface p-4">
                  <dd className="text-3xl font-bold text-accent">
                    {wins.focusMinutes}
                  </dd>
                  <dt className="mt-1 text-sm text-muted">minutes showed up</dt>
                </div>
              </dl>

              {wins.hardestTitle && (
                <div className="mt-3 rounded-2xl bg-surface p-4">
                  <p className="text-sm text-muted">
                    hardest thing you started
                  </p>
                  <p className="mt-1 font-medium text-text">
                    {wins.hardestTitle}
                  </p>
                </div>
              )}
            </div>

            <WinsShare hasDetail={Boolean(wins.hardestTitle)} />

            <p className="mt-4 text-center text-sm text-muted">
              The shared card shows counts only unless you choose otherwise.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-border bg-surface p-6 text-center">
            <div className="mb-3 text-3xl">🌙</div>
            <p className="text-text">A quiet week. That&apos;s allowed.</p>
            <p className="mt-2 text-muted">
              Whenever you&apos;re ready, one tiny step restarts the count — and
              next Sunday this page will remember it for you.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-block rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink transition-colors hover:brightness-105"
            >
              Break something down
            </Link>
          </div>
        )}
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </footer>
    </div>
  );
}
