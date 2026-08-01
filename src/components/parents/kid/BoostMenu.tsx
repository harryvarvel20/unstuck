"use client";

import { useState } from "react";
import { useEscape } from "@/lib/hooks";
import { haptic } from "@/lib/design";
import { BOOST_DEFAULTS } from "@/lib/parentsContent";

/** Boost menu (W4) — a dopamenu for kids: quick sensory/movement lifts for the
 *  flat, bored or understimulated child. Tap one, do it big, come back. */
export function BoostMenu({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState<{ emoji: string; label: string } | null>(
    null,
  );
  useEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Boost menu"
    >
      <button
        type="button"
        onClick={onClose}
        className="m-4 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted"
      >
        ✕ close
      </button>

      {!active ? (
        <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
          <h1 className="font-display text-2xl font-semibold text-text">
            Need a boost?
          </h1>
          <p className="mt-2 text-muted">
            Feeling flat or fidgety? Pick one and go for it.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {BOOST_DEFAULTS.map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setActive(b);
                  haptic(10);
                }}
                className="glass rounded-3xl p-6 text-center shadow-soft transition-transform active:scale-[0.97]"
              >
                <div className="text-4xl">{b.emoji}</div>
                <p className="mt-2 text-sm font-medium text-text">{b.label}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-16 text-center animate-fade-in">
          <div className="text-[6rem]">{active.emoji}</div>
          <h1 className="mt-6 font-display text-3xl font-semibold text-text">
            {active.label}
          </h1>
          <p className="mt-3 text-muted">
            Go! Come back when you&apos;re done.
          </p>
          <button
            type="button"
            onClick={() => setActive(null)}
            className="grad-primary mt-10 w-full rounded-2xl px-6 py-4 text-lg font-semibold shadow-soft"
          >
            Done — that helped
          </button>
        </div>
      )}
    </div>
  );
}
