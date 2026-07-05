"use client";

import { useState } from "react";
import { capture, EVENTS } from "@/lib/analytics";

interface WinsShareProps {
  hasDetail: boolean;
}

/** Fetches the wins card image and shares/saves it. One tap where possible. */
export function WinsShare({ hasDetail }: WinsShareProps) {
  const [includeDetail, setIncludeDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function share() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/wins-card${includeDetail ? "?detail=1" : ""}`,
      );
      if (!res.ok) throw new Error("card failed");
      const blob = await res.blob();
      const file = new File([blob], "adhv-week.png", { type: "image/png" });

      capture(EVENTS.recapShared, { detail: includeDetail });

      if (
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "My week, unstuck" });
        return;
      }
      // Fallback: download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "adhv-week.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {hasDetail && (
        <label className="flex items-center gap-2.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={includeDetail}
            onChange={(e) => setIncludeDetail(e.target.checked)}
            className="h-4.5 w-4.5 accent-[rgb(var(--accent))]"
          />
          Include what my hardest thing was (off = counts only)
        </label>
      )}
      <button
        type="button"
        onClick={() => void share()}
        disabled={busy}
        className="mt-3 w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105 disabled:opacity-60"
      >
        {busy ? "Making your card…" : "Share / save my week"}
      </button>
      {error && (
        <p className="mt-2 text-center text-sm text-accent" role="alert">
          Couldn&apos;t make the card just now — try again in a moment.
        </p>
      )}
    </div>
  );
}
