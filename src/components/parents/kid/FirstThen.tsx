"use client";

import { useState } from "react";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";

/** First–Then board (W4): "First [task], then [good thing]" — a big, calm
 *  visual that reframes a non-preferred task around what comes after. */
export function FirstThen({ onClose }: { onClose: () => void }) {
  const [first, setFirst] = useState("");
  const [then, setThen] = useState("");
  const [showing, setShowing] = useState(false);
  useEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="First then board"
    >
      <button
        type="button"
        onClick={onClose}
        className="m-4 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted"
      >
        ✕ close
      </button>

      {!showing ? (
        <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
          <h1 className="font-display text-2xl font-semibold text-text">
            First–Then
          </h1>
          <label className="mt-6 block text-sm font-medium text-muted">
            First, we…
          </label>
          <input
            value={first}
            onChange={(e) => setFirst(e.target.value.slice(0, 60))}
            placeholder="tidy the blocks"
            className="mt-1.5 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-lg text-text focus:border-accent focus:outline-none"
          />
          <label className="mt-4 block text-sm font-medium text-muted">
            Then, we…
          </label>
          <input
            value={then}
            onChange={(e) => setThen(e.target.value.slice(0, 60))}
            placeholder="read your favourite book"
            className="mt-1.5 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-lg text-text focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setShowing(true);
              capture("firstthen_used");
            }}
            disabled={!first.trim() || !then.trim()}
            className="grad-primary mt-6 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
          >
            Show the board
          </button>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 pb-16">
          <div className="w-full rounded-3xl border-2 border-border bg-surface p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-muted">
              First
            </p>
            <p className="mt-3 text-3xl font-semibold text-text">{first}</p>
          </div>
          <div className="text-3xl text-muted">↓</div>
          <div className="grad-primary w-full rounded-3xl p-8 text-center shadow-soft">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">
              Then
            </p>
            <p className="mt-3 text-3xl font-semibold">{then}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowing(false)}
            className="mt-4 text-sm text-muted underline-offset-4 hover:underline"
          >
            change it
          </button>
        </div>
      )}
    </div>
  );
}
