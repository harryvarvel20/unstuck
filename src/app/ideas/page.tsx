import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { IdeasScreen } from "@/components/IdeasScreen";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** The Idea Vault — capture in two taps; develop on demand. */
export default async function IdeasPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ideas");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Idea vault
        </h1>
        <p className="mt-2 text-muted">
          Catch the sparks so they stop occupying your head. Parked ideas are
          seeds, never a guilt list.
        </p>

        <div className="mt-6">
          <IdeasScreen isPro={isPro} />
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
