import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { FocusProfileScreen } from "@/components/FocusProfileScreen";
import { PatternsPanel } from "@/components/PatternsPanel";
import { createSupabaseServer } from "@/lib/supabase/server";
import { computeGoldenHours, type FocusSignal } from "@/lib/focusProfile";

export const dynamic = "force-dynamic";

/** Focus Profile — what reliably gets this brain into focus. */
export default async function ProfilePage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, focus_profile")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";

  const { data: signalData } = await supabase
    .from("focus_signals")
    .select("pulled_in, title, hour, created_at")
    .order("created_at", { ascending: false })
    .limit(120);
  const golden = computeGoldenHours((signalData ?? []) as FocusSignal[]);

  const cached =
    profile?.focus_profile &&
    typeof profile.focus_profile === "object" &&
    Array.isArray((profile.focus_profile as { runs_on?: unknown }).runs_on)
      ? (profile.focus_profile as { runs_on: string[]; summary: string })
      : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Focus profile
        </h1>
        <p className="mt-2 text-muted">
          Not what&apos;s wrong with your attention — what your attention is
          actually made of.
        </p>

        {/*
          Observations before interpretation. What the app measured comes
          first; what a model makes of it comes after.
        */}
        <div className="mt-6">
          <PatternsPanel />
        </div>

        <div className="mt-4">
          <FocusProfileScreen golden={golden} isPro={isPro} cached={cached} />
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
