"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FeedView } from "./FeedView";
import { LibraryView } from "./LibraryView";
import { MessagesView } from "./MessagesView";
import { PeopleView } from "./PeopleView";
import { HandlePicker } from "./HandlePicker";
import { capture } from "@/lib/analytics";

export interface SocialProfileDto {
  handle: string;
  handleSet: boolean;
  handleChangedAt: string | null;
  displayName: string | null;
  defaultVisibility: "private" | "friends" | "public";
  anonPublic: boolean;
  readReceipts: boolean;
  allowDms: boolean;
  quiet: boolean;
  adultConfirmed: boolean;
  onboarded: boolean;
}

type Tab = "feed" | "library" | "messages" | "people";

const TABS: { key: Tab; label: string }[] = [
  { key: "feed", label: "Wins" },
  { key: "library", label: "Library" },
  { key: "messages", label: "Messages" },
  { key: "people", label: "People" },
];

/**
 * The Activity Center (Phase U) — your people, when you want them.
 * Product law lives server-side; this shell adds the last layer: quiet mode,
 * a consent-first first run, and free users see the library (methods are
 * never paywalled to READ — participating is Pro).
 */
export function ActivityCenter({
  isPro,
  initialTab,
  sharePrefill,
}: {
  isPro: boolean;
  initialTab?: string;
  sharePrefill?: string;
}) {
  const [tab, setTab] = useState<Tab>(
    (TABS.some((t) => t.key === initialTab) ? initialTab : "feed") as Tab,
  );
  const [profile, setProfile] = useState<SocialProfileDto | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unseenBoosts, setUnseenBoosts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/social/profile");
      if (!res.ok) return;
      const body = (await res.json()) as {
        profile: SocialProfileDto;
        pendingRequests: number;
        unseenBoosts: number;
      };
      setProfile(body.profile);
      setPendingRequests(body.pendingRequests);
      setUnseenBoosts(body.unseenBoosts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
    capture("activity_opened");
  }, [refreshProfile]);

  async function patchProfile(patch: Record<string, unknown>) {
    await fetch("/api/social/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    await refreshProfile();
  }

  // ---- Free plan: library is open; joining in is Pro -----------------
  if (!isPro) {
    return (
      <div>
        <div className="glass rounded-3xl p-6 shadow-soft">
          <div className="text-2xl">💞</div>
          <h2 className="mt-3 font-display text-xl font-semibold text-text">
            The Activity Center is a Pro space.
          </h2>
          <p className="mt-2 text-muted">
            Friends who actually get it, cheering your wins — and the playbooks
            of how they got unstuck. No follower counts, no leaderboards, no
            comparison. Ever.
          </p>
          <Link
            href="/pricing"
            className="grad-primary mt-4 inline-block rounded-2xl px-5 py-3 font-semibold shadow-soft"
          >
            See what Pro unlocks
          </Link>
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            The public library — free to browse
          </h3>
          <div className="mt-3">
            <LibraryView isPro={false} />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="skeleton h-10 w-2/3 rounded-2xl" />
        <div className="skeleton h-28 rounded-3xl" />
        <div className="skeleton h-28 rounded-3xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="text-muted">
        Couldn&apos;t open the Activity Center just now — try again in a moment.
      </p>
    );
  }

  // ---- First run: consent-first, one screen, no dark patterns --------
  if (!profile.onboarded) {
    return (
      <div className="glass rounded-3xl p-6 shadow-soft">
        <div className="text-2xl">💞</div>
        <h2 className="mt-3 font-display text-xl font-semibold text-text">
          Before you step in — how this place works.
        </h2>
        <ul className="mt-4 flex flex-col gap-3 text-[0.95rem] text-text">
          <li className="flex gap-2.5">
            <span aria-hidden>🔒</span>
            <span>
              <strong>Nothing is shared unless you share it.</strong> Every win
              starts private-by-choice; you pick who sees each one.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden>🧮</span>
            <span>
              <strong>No numbers to chase.</strong> No follower counts, no like
              tallies, no streak-shaming, no leaderboards — reactions are faces,
              not scores.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden>🚪</span>
            <span>
              <strong>Leaving anything is silent.</strong> Unfriend, mute,
              unpair — nobody is notified, ever. And you can quiet this whole
              tab any time in settings.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Next, you&apos;ll pick a name for this space — it&apos;s all anyone
          here sees, never your real name.
        </p>
        <button
          type="button"
          onClick={() => void patchProfile({ onboarded: true })}
          className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
        >
          Sounds right — let me in
        </button>
        <Link
          href="/toolkit"
          className="mt-3 block text-center text-sm text-muted underline-offset-4 hover:underline"
        >
          not now
        </Link>
      </div>
    );
  }

  // ---- First entry: choose a name before posting/commenting (Y1) -----
  if (!profile.handleSet) {
    return <HandlePicker mode="first" onDone={() => void refreshProfile()} />;
  }

  // ---- Quiet mode: the whole layer sleeps until re-enabled -----------
  if (profile.quiet) {
    return (
      <div className="glass rounded-3xl p-6 text-center shadow-soft">
        <div className="text-2xl">🌙</div>
        <h2 className="mt-3 font-display text-xl font-semibold text-text">
          The social layer is quiet.
        </h2>
        <p className="mt-2 text-muted">
          No feed, no messages, no nudges — exactly as you asked. Your
          friendships are all still here whenever you want them.
        </p>
        <button
          type="button"
          onClick={() => void patchProfile({ quiet: false })}
          className="mt-5 rounded-2xl border border-accent/50 bg-surface px-5 py-3 font-semibold text-accent transition-colors hover:bg-accent-soft"
        >
          Wake it back up
        </button>
      </div>
    );
  }

  return (
    <div>
      <nav
        aria-label="Activity sections"
        className="flex gap-1.5 overflow-x-auto rounded-2xl bg-surface/60 p-1.5"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-surface-2 text-text shadow-soft"
                : "text-muted hover:text-text"
            }`}
          >
            {t.label}
            {t.key === "people" && pendingRequests > 0 && (
              <span className="ml-1.5 text-xs font-medium text-accent">
                new
              </span>
            )}
            {t.key === "people" &&
              pendingRequests === 0 &&
              unseenBoosts > 0 && (
                <span className="ml-1.5 text-xs font-medium text-accent">
                  ✨
                </span>
              )}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "feed" && <FeedView sharePrefill={sharePrefill} />}
        {tab === "library" && <LibraryView isPro />}
        {tab === "messages" && <MessagesView initialThreadId={openThread} />}
        {tab === "people" && (
          <PeopleView
            profile={profile}
            onProfileChange={patchProfile}
            onRefresh={refreshProfile}
            onMessage={async (friendId) => {
              const res = await fetch("/api/social/dms", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ friendId }),
              });
              if (res.ok) {
                const body = (await res.json()) as { threadId: string };
                setOpenThread(body.threadId);
                setTab("messages");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
