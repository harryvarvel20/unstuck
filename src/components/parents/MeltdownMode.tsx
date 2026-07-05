"use client";

import { useEffect, useState } from "react";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";
import { MELTDOWN_STEPS, MELTDOWN_REPAIR } from "@/lib/parentsContent";

/**
 * Meltdown Mode (W5) — in-the-moment, parent-facing, ONE instruction at a
 * time. Coaches the parent to co-regulate first; ends on repair-not-lecture.
 * Never logs the child's behaviour. Reachable fast from the hub. (Not AI —
 * it must work instantly and offline.)
 */
export function MeltdownMode({
  onClose,
  onProblemSolve,
}: {
  onClose: () => void;
  onProblemSolve: () => void;
}) {
  const [i, setI] = useState(0);
  const [repair, setRepair] = useState(false);
  useEscape(onClose);

  useEffect(() => {
    capture("meltdown_mode_used");
  }, []);

  const last = i >= MELTDOWN_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Meltdown mode"
    >
      <button
        type="button"
        onClick={onClose}
        className="m-4 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted"
      >
        ✕ close
      </button>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        {!repair ? (
          <>
            <p className="text-sm font-medium uppercase tracking-widest text-muted">
              One thing at a time
            </p>
            <p className="mt-8 text-2xl font-medium leading-relaxed text-text">
              {MELTDOWN_STEPS[i]}
            </p>
            <div className="mt-10 flex w-full flex-col gap-2.5">
              {!last ? (
                <button
                  type="button"
                  onClick={() => setI(i + 1)}
                  className="grad-primary w-full rounded-2xl px-6 py-4 text-lg font-semibold shadow-soft"
                >
                  Okay — next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setRepair(true)}
                  className="grad-primary w-full rounded-2xl px-6 py-4 text-lg font-semibold shadow-soft"
                >
                  They&apos;re calming down
                </button>
              )}
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setI(i - 1)}
                  className="text-sm text-muted"
                >
                  back
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="animate-fade-in">
            <div className="text-3xl">💛</div>
            <h1 className="mt-4 font-display text-2xl font-semibold text-text">
              Repair, don&apos;t lecture
            </h1>
            <p className="mt-3 leading-relaxed text-muted">{MELTDOWN_REPAIR}</p>
            <button
              type="button"
              onClick={onProblemSolve}
              className="grad-primary mt-8 w-full rounded-2xl px-6 py-4 font-semibold shadow-soft"
            >
              Plan a calm talk (Problem-Solving Together)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-2xl border border-border bg-surface px-6 py-3.5 font-medium text-text"
            >
              We&apos;re okay now
            </button>
          </div>
        )}
      </div>

      <p className="pb-4 text-center text-xs text-muted/70">
        Not therapy or medical advice. If anyone is in danger, call 999.
      </p>
    </div>
  );
}
