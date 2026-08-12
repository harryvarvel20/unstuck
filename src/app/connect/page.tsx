import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ConnectionScreen } from "@/components/ConnectionScreen";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Person {
  id: string;
  name: string;
  relationship: string | null;
  cadence_days: number;
  last_contacted: string | null;
}

/** Connection — strictly opt-in, streak-free. The app never sends anything. */
export default async function ConnectPage() {
  const supabase = await createSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/connect");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, connection_goal")
    .eq("id", user.id)
    .maybeSingle();
  const isPro = profile?.plan === "pro";

  let people: Person[] = [];
  if (isPro) {
    const { data } = await supabase
      .from("people")
      .select("id, name, relationship, cadence_days, last_contacted")
      .order("created_at", { ascending: true })
      .limit(100);
    people = (data ?? []) as Person[];
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={{ id: user.id, email: user.email ?? null }} />

      <main className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Connection
        </h1>
        <p className="mt-2 text-muted">
          Only if you want it. Gentle nudges to reach the people who matter —
          you send everything yourself.
        </p>

        <div className="mt-6">
          {isPro ? (
            <ConnectionScreen
              initialPeople={people}
              initialGoal={profile?.connection_goal ?? null}
            />
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6">
              <p className="text-text">
                Connection is a Pro thing — gentle, streak-free reminders and
                AI-drafted hellos you copy and send yourself.
              </p>
              <Link
                href="/pricing"
                className="grad-primary mt-5 inline-block rounded-2xl px-5 py-3 font-semibold shadow-soft"
              >
                See Pro — 4-day free trial
              </Link>
            </div>
          )}
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
