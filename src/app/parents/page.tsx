import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ParentsScreen } from "@/components/parents/ParentsScreen";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Child } from "@/lib/parents";
import { PARENTS_DISCLAIMER } from "@/lib/parents";

export const dynamic = "force-dynamic";

interface ChildRow {
  id: string;
  name: string | null;
  age_band: Child["ageBand"];
  hardest: string | null;
  created_at: string;
}

/** Parents Mode — opt-in support for a parent of a child with ADHD (W1). */
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

  const { data: rows } = await supabase
    .from("children")
    .select("id, name, age_band, hardest, created_at")
    .order("created_at", { ascending: true });
  const children: Child[] = ((rows as ChildRow[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ageBand: r.age_band,
    hardest: r.hardest,
    createdAt: r.created_at,
  }));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <ParentsScreen
          isPro={isPro}
          initialEnabled={enabled}
          initialChildren={children}
        />
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          {PARENTS_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}
