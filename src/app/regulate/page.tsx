import { SiteHeader } from "@/components/SiteHeader";
import { RegulateHub } from "@/components/regulate/RegulateHub";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RegulatePageProps {
  searchParams: Promise<{ tool?: string }>;
}

/** The Regulate hub — structured, bounded emotional tools. Cool-down is free. */
export default async function RegulatePage({
  searchParams,
}: RegulatePageProps) {
  const { tool } = await searchParams;

  let user: SessionUser | null = null;
  let isPro = false;
  let heavyUse = false;

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

      // Heavy use of the emotional tools → gently suggest a human.
      const since = new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { count } = await supabase
        .from("regulate_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);
      heavyUse = (count ?? 0) >= 8;
    }
  }

  const initial =
    tool === "cooldown" || tool === "decompress" || tool === "spiral"
      ? tool
      : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={user} />

      <main className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Regulate
        </h1>
        <p className="mt-2 text-muted">
          Three small, structured tools for the hard moments. Each one ends with
          a single next step — none of them are a chat.
        </p>

        {heavyUse && (
          <div className="mt-5 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
            <p className="text-sm text-text">
              You&apos;ve leaned on these a lot lately — which is completely
              okay. Some of what you&apos;re carrying might be worth taking to a
              human who can really help: someone you trust, or a professional.
              You don&apos;t have to hold it alone.
            </p>
          </div>
        )}

        <div className="mt-6">
          <RegulateHub isPro={isPro} initial={initial} />
        </div>
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice. In a
          crisis (UK), call Samaritans free any time on 116 123.
        </p>
      </footer>
    </div>
  );
}
