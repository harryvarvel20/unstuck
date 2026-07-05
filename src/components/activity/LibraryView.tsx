"use client";

import { useEffect, useState } from "react";
import { TryButton, type Playbook } from "./FeedView";

interface Entry {
  id: string;
  winText: string;
  caption: string | null;
  tags: string[];
  photoUrl: string | null;
  playbook: Playbook;
  author: string;
  createdAt: string;
}

const SUGGESTED_TAGS = [
  "admin",
  "cleaning",
  "email",
  "money",
  "health",
  "work",
];

/**
 * The public method library — method-first, person-footnote. Free to browse
 * (methods are never paywalled to read). Finite, no trending, no rankings.
 */
export function LibraryView({ isPro }: { isPro: boolean }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (tag) params.set("tag", tag);
        const res = await fetch(`/api/social/library?${params}`);
        if (res.ok) {
          const body = (await res.json()) as { entries: Entry[] };
          setEntries(body.entries);
        } else {
          setEntries([]);
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [q, tag]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value.slice(0, 80))}
        placeholder="How did people manage… (e.g. tax return)"
        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SUGGESTED_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(tag === t ? "" : t)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              tag === t
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-muted hover:text-text"
            }`}
          >
            #{t}
          </button>
        ))}
      </div>

      {entries === null && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="skeleton h-24 rounded-3xl" />
          <div className="skeleton h-24 rounded-3xl" />
        </div>
      )}

      {entries !== null && entries.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          Nothing here yet{q || tag ? " for that search" : ""} — the library
          grows as people share how they got unstuck.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-4">
        {(entries ?? []).map((e) => (
          <li key={e.id} className="glass rounded-3xl p-5 shadow-soft">
            <p className="font-medium leading-snug text-text">{e.winText}</p>
            {e.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.photoUrl}
                alt="From this playbook"
                loading="lazy"
                className="mt-2.5 max-h-64 w-full rounded-2xl border border-border object-cover"
              />
            )}
            {e.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {e.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <ol className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3 text-sm text-text">
              {e.playbook.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted">{i + 1}.</span>
                  <span>
                    {s.title}
                    {s.minutes ? (
                      <span className="text-muted"> · {s.minutes}m</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
            {e.playbook.whatWorked && (
              <p className="mt-2 text-sm italic text-muted">
                “{e.playbook.whatWorked}”
              </p>
            )}
            <div className="mt-1 flex items-end justify-between gap-3">
              <TryButton winText={e.winText} playbook={e.playbook} />
              <span className="pb-1 text-xs text-muted">— {e.author}</span>
            </div>
          </li>
        ))}
      </ul>

      {entries !== null && entries.length > 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          That&apos;s everything{tag ? ` under #${tag}` : ""}. ✨
        </p>
      )}
      {!isPro && (
        <p className="mt-6 text-center text-sm text-muted">
          Sharing your own playbooks (and everything else in here) is part of{" "}
          <a
            href="/pricing"
            className="font-medium text-accent hover:underline"
          >
            Pro
          </a>
          .
        </p>
      )}
    </div>
  );
}
