import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BillingButton } from "@/components/BillingButton";
import { DeleteAccount } from "@/components/DeleteAccount";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getTimeTruth, MIN_SAMPLES } from "@/lib/timeTruth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, created_at, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const isPro = profile?.plan === "pro";
  const plan = isPro ? "Pro" : "Free";
  const timeTruth = await getTimeTruth(supabase, user.id);
  const since = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <h1 className="mb-6 text-2xl font-semibold text-text sm:text-3xl">
          Account
        </h1>

        <div className="rounded-3xl border border-border bg-surface p-6">
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd className="text-text">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Plan</dt>
              <dd className="flex items-center gap-2 text-text">
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-accent">
                  {plan}
                </span>
              </dd>
            </div>
            {since && (
              <div>
                <dt className="text-sm text-muted">Member since</dt>
                <dd className="text-text">{since}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Time Truth */}
        {isPro && timeTruth.enough ? (
          <div className="mt-4 rounded-2xl border border-accent/40 bg-accent-soft/50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">
              Time Truth
            </h2>
            <p className="mt-2 text-text">
              {timeTruth.ratio >= 1.15 ? (
                <>
                  Your &quot;quick jobs&quot; average{" "}
                  <strong>{timeTruth.ratio}×</strong> your guess. That&apos;s
                  not failure — that&apos;s data. Plans now auto-adjust.
                </>
              ) : timeTruth.ratio <= 0.85 ? (
                <>
                  You&apos;re actually <strong>faster</strong> than your brain
                  predicts — about {timeTruth.ratio}× your guesses. Plans now
                  auto-adjust.
                </>
              ) : (
                <>
                  Your time guesses are almost spot on lately. That&apos;s rare
                  — genuinely.
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-muted">
              Based on your last {timeTruth.samples} completed steps.
            </p>
          </div>
        ) : isPro && timeTruth.samples > 0 ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Time Truth
            </h2>
            <p className="mt-2 text-sm text-muted">
              Still learning how time works for you — {timeTruth.samples} of{" "}
              {MIN_SAMPLES} moments gathered. Finish steps or focus sessions and
              this fills in by itself.
            </p>
          </div>
        ) : !isPro && timeTruth.enough ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Time Truth
            </h2>
            <p className="mt-2 text-sm text-muted">
              ADHV has quietly learned how time really works for you.{" "}
              <Link href="/pricing" className="text-accent hover:underline">
                Pro shows you
              </Link>{" "}
              — and adjusts every plan to match.
            </p>
          </div>
        ) : null}

        {/* Billing */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          {isPro ? (
            <div>
              <p className="text-sm text-muted">
                Change your plan, update your card, or cancel — cancelling is
                one tap, effective at the end of your period. No hoops.
              </p>
              <div className="mt-4">
                <BillingButton />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted">
                Pro is an AI body double, a plan that knows how you really use
                time, and a reset button for bad days. 7-day free trial.
              </p>
              <Link
                href="/pricing"
                className="mt-4 inline-block rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink transition-colors hover:brightness-105"
              >
                See Pro
              </Link>
            </div>
          )}
        </div>

        {/* Danger zone — honest and immediate */}
        <div className="mt-4 rounded-2xl border border-border bg-surface-2/50 p-5">
          <DeleteAccount />
          <p className="mt-2 text-xs text-muted">
            See our{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              privacy policy
            </Link>{" "}
            for exactly what we store.
          </p>
        </div>

        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-text transition-colors hover:border-accent/40"
          >
            Sign out
          </button>
        </form>
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a productivity tool, not medical advice or treatment.
        </p>
      </footer>
    </div>
  );
}
