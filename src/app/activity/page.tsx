import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ActivityCenter } from "@/components/activity/ActivityCenter";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ActivityPageProps {
  searchParams: Promise<{ tab?: string; share?: string }>;
}

/** The Activity Center — your people, when you want them. */
export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  const { tab, share } = await searchParams;

  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/activity");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, parents_mode")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";
  const parentsMode = Boolean(profile?.parents_mode);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Activity
        </h1>
        <p className="mt-2 text-muted">
          Your people, when you want them. No follower counts, no leaderboards,
          no comparison — ever.
        </p>

        <div className="mt-6">
          <ActivityCenter
            isPro={isPro}
            parentsMode={parentsMode}
            initialTab={tab}
            sharePrefill={share ? share.slice(0, 300) : undefined}
          />
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
