"use client";

import { useState } from "react";
import { hourLabel, type GoldenHours } from "@/lib/focusProfile";
import {
  parseStringsArray,
  parseStringField,
  parseStreamingMessage,
} from "@/lib/parseBreakdown";
import { streamPost, ProRequiredError } from "@/lib/streamClient";
import { capture } from "@/lib/analytics";

interface Cached {
  runs_on: string[];
  summary: string;
}

export function FocusProfileScreen({
  golden,
  isPro,
  cached,
}: {
  golden: GoldenHours;
  isPro: boolean;
  cached: Cached | null;
}) {
  const [runsOn, setRunsOn] = useState<string[]>(cached?.runs_on ?? []);
  const [summary, setSummary] = useState(cached?.summary ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyse() {
    setBusy(true);
    setError(null);
    try {
      const buf = await streamPost("/api/profile/summarise", {}, (buffer) => {
        const m = parseStreamingMessage(buffer);
        if (m.crisis) return;
        setRunsOn(parseStringsArray(buffer, "runs_on"));
        setSummary(parseStringField(buffer, "summary") ?? "");
      });
      const ro = parseStringsArray(buf, "runs_on");
      const sm = parseStringField(buf, "summary") ?? "";
      setRunsOn(ro);
      setSummary(sm);
      capture("focus_profile_built");
      void fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ focus_profile: { runs_on: ro, summary: sm } }),
      }).catch(() => {});
    } catch (err) {
      if (err instanceof ProRequiredError) setError("This is a Pro thing.");
      else setError("Couldn't build it just now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const line = runsOn.length
      ? `My brain runs on: ${runsOn.join(", ")}. 🧠\n— via ADHV`
      : "";
    if (!line) return;
    capture("focus_profile_shared");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: line });
      } else {
        await navigator.clipboard.writeText(line);
      }
    } catch {
      /* cancelled */
    }
  }

  if (!golden.enough) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-6 text-center">
        <div className="mb-3 text-3xl">🧠</div>
        <p className="text-text">Still getting to know your brain.</p>
        <p className="mt-2 text-muted">
          After a focus session I&apos;ll sometimes ask one question — did that
          pull you in, or did you have to drag yourself? A handful of answers
          and your profile appears. {golden.samples} so far.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* The shareable card */}
      <div className="overflow-hidden rounded-3xl border border-[rgb(var(--gold)/0.4)] bg-[rgb(var(--accent))] p-6 text-[rgb(var(--accent-ink))] shadow-float">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-90">
          My brain runs on
        </p>
        {runsOn.length > 0 ? (
          <p className="mt-3 font-display text-3xl font-bold leading-tight">
            {runsOn.join(", ")}.
          </p>
        ) : (
          <p className="mt-3 font-display text-2xl font-semibold opacity-90">
            {isPro ? "Tap below to find out." : "Pro reveals this."}
          </p>
        )}
        {summary && <p className="mt-3 text-white/90">{summary}</p>}
      </div>

      {/* Golden hours */}
      {golden.peakHours.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            Your golden hours
          </p>
          <p className="mt-2 text-text">
            You lock in best around{" "}
            <strong>{golden.peakHours.map(hourLabel).join(", ")}</strong>. Slot
            the hard thing there when you can.
          </p>
          {golden.lowHours.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Kryptonite window: around{" "}
              {golden.lowHours.map(hourLabel).join(", ")}. Save the gentle stuff
              for then — no shame in it.
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {isPro ? (
          <button
            type="button"
            onClick={() => void analyse()}
            disabled={busy}
            className="grad-primary rounded-2xl px-5 py-3 font-semibold shadow-soft disabled:opacity-60"
          >
            {busy
              ? "Reading your brain…"
              : runsOn.length
                ? "Refresh my profile"
                : "Reveal what my brain runs on"}
          </button>
        ) : (
          <a
            href="/pricing"
            className="grad-primary rounded-2xl px-5 py-3 font-semibold shadow-soft"
          >
            Unlock with Pro
          </a>
        )}
        {runsOn.length > 0 && (
          <button
            type="button"
            onClick={() => void share()}
            className="rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-text"
          >
            Share it
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
