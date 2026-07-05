"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The cross-platform app shell navigation.
 * - Mobile (<md): bottom tab bar. Desktop (md+): a persistent left nav rail.
 * Destinations: Home / Toolkit / Activity / [Parents] / Account. The Parents
 * tab appears only when Parents Mode is enabled (fetched once; refreshed on
 * the adhv-parents-changed event the ParentsScreen dispatches).
 *
 * Hidden on marketing/auth/focus surfaces — the app shell is for the app.
 */

const PARENTS = {
  href: "/parents",
  label: "Parents",
  match: (p: string) => p === "/parents" || p.startsWith("/parents/"),
  icon: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.2" />
      <path d="M3.5 20c0-3.2 2.6-5 5.5-5s5.5 1.8 5.5 5" />
      <path d="M15 20c0-2 .8-3.4 2.2-4" />
    </>
  ),
} as const;

const DESTINATIONS = [
  {
    href: "/app",
    label: "Home",
    match: (p: string) => p === "/app",
    icon: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  },
  {
    href: "/toolkit",
    label: "Toolkit",
    match: (p: string) =>
      [
        "/toolkit",
        "/today",
        "/plan",
        "/routines",
        "/regulate",
        "/dopamenu",
        "/ideas",
        "/impulse",
        "/profile",
        "/wins",
        "/tasks",
        "/connect",
        "/winddown",
      ].some((x) => p === x || p.startsWith(`${x}/`)),
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    href: "/activity",
    label: "Activity",
    match: (p: string) => p === "/activity" || p.startsWith("/activity/"),
    icon: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    ),
  },
  {
    href: "/account",
    label: "Account",
    match: (p: string) => p === "/account" || p.startsWith("/account/"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </>
    ),
  },
] as const;

/** Surfaces where the shell must NOT appear (marketing, auth, legal). */
const HIDDEN_PREFIXES = ["/privacy", "/terms", "/login", "/auth", "/welcome"];

export function AppNav() {
  const pathname = usePathname() ?? "/";
  const [parentsEnabled, setParentsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/parents");
        if (!res.ok) return;
        const body = (await res.json()) as { enabled?: boolean };
        if (!cancelled) setParentsEnabled(Boolean(body.enabled));
      } catch {
        /* not signed in / offline — no tab */
      }
    }
    void check();
    window.addEventListener("adhv-parents-changed", check);
    return () => {
      cancelled = true;
      window.removeEventListener("adhv-parents-changed", check);
    };
  }, []);

  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  // Parents slots in just before Account when enabled.
  const destinations = parentsEnabled
    ? [...DESTINATIONS.slice(0, 3), PARENTS, DESTINATIONS[3]!]
    : [...DESTINATIONS];
  const cols = destinations.length; // 4 or 5

  const items = destinations.map((d) => {
    const active = d.match(pathname);
    return (
      <Link
        key={d.href}
        href={d.href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
          active ? "text-accent" : "text-muted hover:text-text"
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {d.icon}
        </svg>
        <span className="text-[10px] font-medium">{d.label}</span>
      </Link>
    );
  });

  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav
        data-tabbar
        aria-label="Main"
        className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/70 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div
          className={`grid h-16 ${cols === 5 ? "grid-cols-5" : "grid-cols-4"}`}
        >
          {items}
        </div>
      </nav>

      {/* Desktop: left nav rail */}
      <nav
        data-rail
        aria-label="Main"
        className="glass fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-stretch justify-center gap-4 border-r border-border/70 py-6 md:flex"
      >
        {items}
      </nav>
    </>
  );
}
