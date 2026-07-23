import { SiteHeader } from "@/components/SiteHeader";
import { PricingCards } from "@/components/PricingCards";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  let user: SessionUser | null = null;
  let isPro = false;

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
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={user} />

      <main className="flex-1">
        <h1 className="text-2xl font-semibold leading-tight text-text sm:text-3xl">
          An AI body double, a plan that knows how you really use time, and a
          reset button for bad days.
        </h1>
        <p className="mt-3 text-muted">
          Free gets you started every day. Pro sits with you until it&apos;s
          done.
        </p>

        <div className="mt-8">
          <PricingCards signedIn={Boolean(user)} isPro={isPro} />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface-2/50 p-5">
          <h2 className="font-medium text-text">The honest bits</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
            <li>
              · Cancelling is one tap in Account → Manage billing. Always.
            </li>
            <li>· No streaks, no guilt, no &quot;we miss you&quot; emails.</li>
            <li>
              · ADHV is a self-management tool, not therapy or medical advice.
            </li>
          </ul>
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
