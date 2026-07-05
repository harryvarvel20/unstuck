import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { WelcomeTrack } from "@/components/WelcomeTrack";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Post-checkout landing. A warm welcome, not a receipt. */
export default async function WelcomePage() {
  let user: SessionUser | null = null;
  const supabase = await createSupabaseServer();
  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) user = { id: authUser.id, email: authUser.email ?? null };
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={user} />
      <WelcomeTrack />

      <main className="flex flex-1 flex-col justify-center">
        <section className="animate-fade-in rounded-3xl border border-accent/40 bg-accent-soft/60 p-7 text-center sm:p-9">
          <div className="mb-4 text-4xl">💛</div>
          <h1 className="text-2xl font-semibold text-text sm:text-3xl">
            You just gave yourself backup.
          </h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-muted">
            Nothing to set up. Your limits are gone, the focus room is always
            open, and ADHV starts learning how time really works for you from
            today.
          </p>

          <Link
            href="/app"
            className="mt-7 inline-block w-full rounded-2xl bg-accent px-5 py-3.5 text-[1.05rem] font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99] sm:w-auto sm:px-10"
          >
            Break something down
          </Link>

          <p className="mt-5 text-sm text-muted">
            One promise: if you ever want to leave, it&apos;s one tap in Account
            → Manage billing. No hoops.
          </p>
        </section>
      </main>

      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a productivity tool, not medical advice or treatment.
        </p>
      </footer>
    </div>
  );
}
