import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ParentsScreen } from "@/components/parents/ParentsScreen";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PARENTS_DISCLAIMER } from "@/lib/parents";

export const dynamic = "force-dynamic";

/**
 * Parents Mode — opt-in support for a parent of a child with ADHD.
 *
 * Privacy by design: the server only ever knows whether the PARENT turned
 * Parents Mode on. It never reads or stores anything about the child — the
 * child list, reward charts, and wins all live on the parent's device
 * (see src/lib/parentsLocal.ts).
 */
export default async function ParentsPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/parents");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, parents_mode")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";
  const enabled = Boolean(profile?.parents_mode);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <ParentsScreen isPro={isPro} initialEnabled={enabled} />
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          {PARENTS_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}
