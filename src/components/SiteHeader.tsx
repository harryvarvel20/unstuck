"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/types";
import { clearAllParentsLocal } from "@/lib/parentsLocal";
import { ThemeToggle } from "./ThemeToggle";

interface SiteHeaderProps {
  user: SessionUser | null;
}

export function SiteHeader({ user }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <header className="mb-6 flex items-center justify-between">
      {/* Discreet engraved wordmark: serif ADHV in navy with a hairline gold
          rule beneath the V — a monogram, not a logo. */}
      <Link
        href="/app"
        className="group inline-flex flex-col items-start"
        aria-label="ADHV home"
      >
        <span className="font-display text-[1.35rem] font-semibold tracking-[0.22em] text-text">
          ADHV
        </span>
        <span
          aria-hidden
          className="mt-0.5 h-px w-full origin-left bg-[rgb(var(--gold))] transition-transform duration-300 group-hover:scale-x-90"
        />
      </Link>

      <div className="flex items-center gap-2">
        {user && (
          <Link
            href="/toolkit"
            aria-label="Toolkit"
            title="Toolkit — everything, one tap away"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </Link>
        )}
        <Link
          href="/regulate?tool=cooldown"
          aria-label="Cool-down — a 90-second reset"
          title="Feeling a spike? A 90-second cool-down"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-accent/50 hover:text-accent"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22c4-3 6-6 6-10a6 6 0 0 0-12 0c0 4 2 7 6 10z" />
            <path d="M12 12a3 3 0 0 0 0-6" />
          </svg>
        </Link>
        <ThemeToggle />

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Account menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink transition-transform active:scale-95"
            >
              {initial}
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 z-40 mt-2 w-56 animate-fade-in overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
              >
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm text-muted">Signed in as</p>
                  <p className="truncate text-sm font-medium text-text">
                    {user.email}
                  </p>
                </div>
                <nav className="flex flex-col py-1">
                  <Link
                    href="/app"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2.5 text-sm text-text transition-colors hover:bg-surface-2"
                  >
                    Home
                  </Link>
                  <Link
                    href="/toolkit"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2.5 text-sm text-text transition-colors hover:bg-surface-2"
                  >
                    Toolkit
                  </Link>
                  <Link
                    href="/parents"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2.5 text-sm text-text transition-colors hover:bg-surface-2"
                  >
                    Parents Mode
                  </Link>
                  <Link
                    href="/account"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="px-4 py-2.5 text-sm text-text transition-colors hover:bg-surface-2"
                  >
                    Account
                  </Link>
                  <form
                    action="/auth/signout"
                    method="post"
                    // Device-only Parents data is tied to the signed-in person:
                    // leaving the account clears it from this browser.
                    onSubmit={() => clearAllParentsLocal()}
                  >
                    <button
                      type="submit"
                      role="menuitem"
                      className="w-full px-4 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
                    >
                      Sign out
                    </button>
                  </form>
                </nav>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/50"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
