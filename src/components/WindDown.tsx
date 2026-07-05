"use client";

import { useState } from "react";
import Link from "next/link";
import { capture } from "@/lib/analytics";

/**
 * Evening wind-down: get tomorrow out of your head so it isn't 1am fuel,
 * pick ONE tiny first action for tomorrow, note what happened today, put the
 * day down. Thought-offloading — not sleep tracking, no sleep claims.
 */

type Stage = "dump" | "first" | "wins" | "done";

export function WindDown() {
  const [stage, setStage] = useState<Stage>("dump");
  const [dump, setDump] = useState("");
  const [firstAction, setFirstAction] = useState("");
  const [winsNote, setWinsNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function finish() {
    setSaving(true);
    setError(false);
    const captured = dump
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 60);
    try {
      const res = await fetch("/api/winddown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          captured,
          first: firstAction.trim()
            ? { title: firstAction.trim().slice(0, 300), minutes: 5 }
            : null,
          winsNote: winsNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      capture("winddown_completed", { captured: captured.length });
      setStage("done");
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (stage === "done") {
    return (
      <div className="animate-fade-in text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-3xl">
          🌙
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold text-text">
          The day is handled.
        </h1>
        <p className="mt-3 text-muted">
          Tomorrow starts with one tiny thing, and everything else is written
          down where your brain doesn&apos;t have to hold it. You can put it
          down now.
        </p>
        <Link
          href="/app"
          className="mt-8 inline-block w-full rounded-2xl border border-border bg-surface px-5 py-3.5 font-medium text-text transition-colors hover:border-accent/40"
        >
          Good night
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* step dots */}
      <div className="mb-6 flex justify-center gap-2" aria-hidden="true">
        {(["dump", "first", "wins"] as const).map((s) => (
          <span
            key={s}
            className={`h-1.5 w-8 rounded-full ${
              s === stage ? "bg-accent" : "bg-surface-2"
            }`}
          />
        ))}
      </div>

      {stage === "dump" && (
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl font-semibold text-text">
            What&apos;s circling for tomorrow?
          </h1>
          <p className="mt-2 text-muted">
            Everything. One thing per line, as messy as you like. Once it&apos;s
            here, it doesn&apos;t need to live in your head tonight.
          </p>
          <textarea
            value={dump}
            onChange={(e) => setDump(e.target.value.slice(0, 4000))}
            rows={7}
            placeholder={"email the landlord\nmum's birthday??\nthat form"}
            className="mt-5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={() => setStage("first")}
            className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
          >
            It&apos;s out of my head
          </button>
        </div>
      )}

      {stage === "first" && (
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl font-semibold text-text">
            Tomorrow&apos;s ONE tiny first action
          </h1>
          <p className="mt-2 text-muted">
            Not the biggest thing — the smallest. The one you could do half
            asleep. It&apos;ll be waiting for you in the morning.
          </p>
          <input
            value={firstAction}
            onChange={(e) => setFirstAction(e.target.value.slice(0, 300))}
            placeholder="e.g. put the form on the kitchen table"
            className="mt-5 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={() => setStage("wins")}
            className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
          >
            {firstAction.trim() ? "That's the one" : "Skip — no first action"}
          </button>
        </div>
      )}

      {stage === "wins" && (
        <div className="animate-fade-in">
          <h1 className="font-display text-2xl font-semibold text-text">
            What happened today that you did?
          </h1>
          <p className="mt-2 text-muted">
            Two lines, tops. Not what&apos;s left — what happened. Showing up
            counts.
          </p>
          <textarea
            value={winsNote}
            onChange={(e) => setWinsNote(e.target.value.slice(0, 400))}
            rows={3}
            placeholder="e.g. started the email I'd been dreading. did a focus session."
            className="mt-5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={() => void finish()}
            disabled={saving}
            className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-60"
          >
            {saving ? "Putting the day down…" : "Close the day"}
          </button>
          {error && (
            <p className="mt-3 text-center text-sm text-accent" role="alert">
              Couldn&apos;t save just now — give it another go.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
