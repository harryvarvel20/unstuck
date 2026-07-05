"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compressToFit, type Routine, type RoutineStep } from "@/lib/routines";
import { burstConfetti } from "@/lib/confetti";
import { haptic } from "@/lib/design";
import { capture } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

type Stage = "setup" | "run" | "done";

const TIME_OPTIONS = [
  { label: "All of it", value: 0 },
  { label: "15 min", value: 15 },
  { label: "10 min", value: 10 },
  { label: "5 min", value: 5 },
];

export function RoutineRunner({
  routine,
  onClose,
}: {
  routine: Routine;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("setup");
  const [steps, setSteps] = useState<RoutineStep[]>(routine.steps);
  const [trimmed, setTrimmed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const fullMinutes = useMemo(
    () => routine.steps.reduce((a, s) => a + s.minutes, 0),
    [routine.steps],
  );

  useEscape(onClose);

  const advanceRef = useRef<() => void>(() => {});

  function begin(minutesAvailable: number) {
    const fit =
      minutesAvailable === 0
        ? { steps: routine.steps, trimmed: false }
        : compressToFit(routine.steps, minutesAvailable);
    setSteps(fit.steps);
    setTrimmed(fit.trimmed);
    setIdx(0);
    setRemaining((fit.steps[0]?.minutes ?? 1) * 60);
    setStage("run");
    capture("routine_run_started", {
      trimmed: fit.trimmed,
      steps: fit.steps.length,
    });
  }

  function next() {
    if (idx + 1 >= steps.length) {
      burstConfetti(window.innerWidth / 2, window.innerHeight / 2, 20);
      haptic([10, 40, 10]);
      capture("routine_run_completed");
      setStage("done");
      return;
    }
    const n = idx + 1;
    setIdx(n);
    setRemaining((steps[n]?.minutes ?? 1) * 60);
  }
  advanceRef.current = next;

  // Per-step auto-advancing timer.
  useEffect(() => {
    if (stage !== "run") return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.setTimeout(() => advanceRef.current(), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage, idx]);

  const step = steps[idx];
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label={`Routine: ${routine.name}`}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Leave routine"
          className="self-start text-sm text-muted transition-colors hover:text-text"
        >
          ✕ leave
        </button>

        {stage === "setup" && (
          <div className="flex flex-1 flex-col justify-center pb-16 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-muted">
              Routine
            </p>
            <h1 className="mt-3 font-display text-2xl font-semibold text-text">
              {routine.name}
            </h1>
            <p className="mt-2 text-muted">
              {routine.steps.length} steps · about {fullMinutes} min in full
            </p>

            <p className="mt-8 text-muted">How long have you got?</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {TIME_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => begin(o.value)}
                  className="rounded-2xl border border-border bg-surface px-4 py-4 font-semibold text-text transition-colors hover:border-accent/50"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted">
              Short on time? The must-dos survive; the rest quietly steps aside.
              Late never breaks the chain.
            </p>
          </div>
        )}

        {stage === "run" && step && (
          <div className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
            {trimmed && idx === 0 && (
              <p className="mb-6 rounded-full bg-accent-soft px-4 py-1.5 text-xs font-medium text-accent">
                Minimum viable version — the essentials only
              </p>
            )}
            <p className="text-sm text-muted">
              step {idx + 1} of {steps.length}
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-text">
              {step.title}
            </h1>
            <p className="mt-6 text-5xl font-bold tabular-nums text-accent">
              {mm}:{ss.toString().padStart(2, "0")}
            </p>

            <div className="mt-10 w-full">
              <button
                type="button"
                onClick={next}
                className="grad-primary w-full rounded-2xl px-5 py-4 text-lg font-semibold shadow-soft transition-all active:scale-[0.99]"
              >
                {idx + 1 >= steps.length ? "Finish" : "Done — next"}
              </button>
              {step.skippable && (
                <button
                  type="button"
                  onClick={next}
                  className="mt-2.5 w-full rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-muted transition-colors hover:text-text"
                >
                  Skip this one
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center animate-fade-in">
            <div className="grad-primary inline-flex h-20 w-20 items-center justify-center rounded-full text-3xl">
              ✓
            </div>
            <h1 className="mt-6 font-display text-2xl font-semibold text-text">
              {routine.name} — done.
            </h1>
            <p className="mt-3 text-muted">
              However much of it you did, you ran the sequence. That&apos;s the
              whole win.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 w-full rounded-2xl border border-border bg-surface px-5 py-3.5 font-medium text-text"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
