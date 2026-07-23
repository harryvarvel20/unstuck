import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Navigator } from "@/components/Navigator";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Tile {
  href: string;
  emoji: string;
  title: string;
  sub: string;
}

const GROUPS: { label: string; tiles: Tile[] }[] = [
  {
    label: "Do",
    tiles: [
      {
        href: "/today",
        emoji: "🗓️",
        title: "Today",
        sub: "your timed day plan",
      },
      {
        href: "/plan",
        emoji: "🌅",
        title: "Morning plan",
        sub: "brain dump → a day",
      },
      {
        href: "/routines",
        emoji: "🔁",
        title: "Routines",
        sub: "that bend, not break",
      },
      {
        href: "/ideas",
        emoji: "💡",
        title: "Idea vault",
        sub: "catch the sparks",
      },
      {
        href: "/tasks",
        emoji: "✅",
        title: "My tasks",
        sub: "saved breakdowns",
      },
    ],
  },
  {
    label: "Feel",
    tiles: [
      {
        href: "/regulate",
        emoji: "🌬️",
        title: "Regulate",
        sub: "cool-down & more",
      },
      {
        href: "/dopamenu",
        emoji: "🍽️",
        title: "Dopamenu",
        sub: "for the flat moments",
      },
      {
        href: "/impulse",
        emoji: "⏳",
        title: "Impulse pause",
        sub: "spark → gap → choice",
      },
      {
        href: "/connect",
        emoji: "💞",
        title: "Connection",
        sub: "the people who matter",
      },
    ],
  },
  {
    label: "Know",
    tiles: [
      {
        href: "/profile",
        emoji: "🧠",
        title: "Focus profile",
        sub: "what your brain runs on",
      },
      {
        href: "/wins",
        emoji: "✨",
        title: "My wins",
        sub: "only what you did",
      },
    ],
  },
];

export default async function ToolkitPage() {
  let user: SessionUser | null = null;
  const supabase = await createSupabaseServer();
  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) user = { id: authUser.id, email: authUser.email ?? null };
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col lg:max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <SiteHeader user={user} />

      <main className="flex-1">
        <h1 className="font-display text-2xl font-semibold leading-tight text-text sm:text-3xl">
          Toolkit
        </h1>
        <p className="mt-2 text-muted">
          Everything, one tap away — but never all at once. The right tool for
          the moment you&apos;re in.
        </p>

        {/* Navigator — tell it what's going on, it takes you to the tool */}
        <div className="mt-6">
          <Navigator />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted/70">
            or browse
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-6 flex flex-col gap-7">
          {GROUPS.map((g) => (
            <section key={g.label}>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                {g.label}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                {g.tiles.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="glass rounded-2xl p-4 shadow-soft transition-transform active:scale-[0.98]"
                  >
                    <div className="text-2xl">{t.emoji}</div>
                    <p className="mt-2 font-semibold text-text">{t.title}</p>
                    <p className="text-xs text-muted">{t.sub}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
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
