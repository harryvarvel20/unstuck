"use client";

import { useEffect, useState } from "react";
import { PRAISE_PHRASES } from "@/lib/parentsContent";
import { capture } from "@/lib/analytics";
import type { Child } from "@/lib/parents";

/**
 * Positivity engine (W6) — a counter to the ~20,000 extra corrections an ADHD
 * child hears by 12. Labeled-praise coach + Special Time nudge, and a private,
 * warm "wins about my kid" log (never a log of failures).
 */
interface Win {
  id: string;
  text: string;
  created_at: string;
}

export function PositivityView({ child }: { child: Child }) {
  const [wins, setWins] = useState<Win[]>([]);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [phrase, setPhrase] = useState(0);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/parents/wins");
      if (res.ok) {
        const b = await res.json();
        setWins((b.wins ?? []) as Win[]);
      }
    })();
  }, []);

  async function logWin() {
    if (!text.trim()) return;
    setNotice(null);
    const res = await fetch("/api/parents/wins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId: child.id, text: text.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (body.childSafety) {
      capture("child_safety_routed", { surface: "wins" });
      setNotice(body.message as string);
      return;
    }
    if (res.ok && body.win) {
      setWins((prev) => [body.win as Win, ...prev]);
      setText("");
      capture("praise_logged");
    }
  }

  async function removeWin(id: string) {
    setWins((prev) => prev.filter((w) => w.id !== id));
    await fetch("/api/parents/wins", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  return (
    <div className="animate-page-in">
      <h2 className="font-display text-xl font-semibold text-text">
        Catch them being good
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        The most powerful thing you can do is notice what&apos;s going right —
        out loud, and specifically.
      </p>

      {/* Labeled-praise coach */}
      <div className="mt-4 glass rounded-3xl p-5 shadow-soft">
        <p className="text-sm font-semibold text-text">Labeled praise to try</p>
        <p className="mt-2 text-[1.05rem] leading-relaxed text-text">
          “{PRAISE_PHRASES[phrase]}”
        </p>
        <button
          type="button"
          onClick={() => setPhrase((p) => (p + 1) % PRAISE_PHRASES.length)}
          className="mt-3 text-sm font-medium text-accent"
        >
          Another example →
        </button>
        <p className="mt-4 rounded-2xl bg-accent-soft/50 p-3 text-sm text-muted">
          💡 Special Time: ~10 minutes of child-led play a day, no correcting —
          it refills everything else.{" "}
          <button
            type="button"
            onClick={() => capture("special_time_reminded")}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            remind me
          </button>
        </p>
      </div>

      {/* Wins about my kid */}
      <div className="mt-6">
        <h3 className="font-display text-lg font-semibold text-text">
          Wins about {child.name || "my kid"}
        </h3>
        <p className="mt-1 text-sm text-muted">
          One good thing from today. On the hard days, this is the truer story.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            onKeyDown={(e) => e.key === "Enter" && void logWin()}
            placeholder="e.g. laughed so hard at dinner"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void logWin()}
            disabled={!text.trim()}
            className="rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
          >
            Log
          </button>
        </div>
        {notice && (
          <p className="mt-2 rounded-2xl bg-accent-soft/60 p-3 text-sm text-text">
            {notice}
          </p>
        )}
        <ul className="mt-4 flex flex-col gap-2">
          {wins.map((w) => (
            <li
              key={w.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-3.5"
            >
              <span className="text-text">💛 {w.text}</span>
              <button
                type="button"
                onClick={() => void removeWin(w.id)}
                className="flex-shrink-0 text-xs text-muted/70 hover:text-accent"
              >
                remove
              </button>
            </li>
          ))}
          {wins.length === 0 && (
            <li className="text-sm text-muted">
              Nothing logged yet — the first one can be tiny.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
