"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BreakdownStep } from "@/lib/types";
import type { PickCandidate } from "@/lib/pick";
import { FocusRoom } from "./FocusRoom";
import { haptic, prefersReducedMotion } from "@/lib/design";
import { capture } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

/**
 * "Can't move" SOS — the paralysis breaker. Bypasses the planning brain and
 * starts with the BODY, then shrinks the cognitive step to near-zero, then
 * ramps into the shortest focus session. Never records a failure anywhere.
 */

const BODY_STEPS = [
  "Wiggle your fingers. Just that.",
  "Now stand up. Don't tidy anything. Just stand.",
  "Walk to the kitchen or a window. Touch the counter or the glass.",
];

const AUTO_MS = 15000;

interface SosButtonProps {
  signedIn: boolean;
  localSteps: { index: number; step: BreakdownStep }[];
  currentTaskId: string | null;
  onLocalDone: (index: number) => void;
  onLimitFocus: () => void;
}

type Stage = "intro" | "body" | "count" | "focus" | "bailed";

export function SosButton({
  localSteps,
  currentTaskId,
  onLocalDone,
  onLimitFocus,
}: SosButtonProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("intro");
  const [bodyIdx, setBodyIdx] = useState(0);
  const [count, setCount] = useState(5);
  const [pick, setPick] = useState<PickCandidate | null>(null);
  const [tinyStep, setTinyStep] = useState<BreakdownStep | null>(null);
  const advanceRef = useRef<() => void>(() => {});

  // Escape mirrors the ✕: harmless close on intro, blameless bail mid-flow.
  useEscape(
    () => {
      if (stage === "intro" || stage === "bailed") {
        setOpen(false);
        setStage("intro");
      } else {
        setStage("bailed");
      }
    },
    open && stage !== "focus",
  );

  const start = useCallback(() => {
    capture("sos_used");
    haptic([20, 60, 20]);
    setStage("intro");
    setBodyIdx(0);
    setCount(5);
    setOpen(true);
    void resolveTinyStep();
    // Mount-once trigger: start() must keep a stable identity; resolveTinyStep
    // is a stable useCallback so re-adding it would only churn the reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveTinyStep = useCallback(async () => {
    try {
      const res = await fetch("/api/pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          minutes: 10,
          hour: new Date().getHours(),
          exclude: [],
          localSteps: localSteps.map(({ index, step }) => ({
            index,
            title: step.title,
            minutes: step.minutes,
            tip: step.tip,
          })),
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { pick: PickCandidate | null };
        if (body.pick) {
          setPick(body.pick);
          setTinyStep({
            title: body.pick.title,
            minutes: Math.min(10, body.pick.calMinutes),
            tip: body.pick.tip,
          });
          return;
        }
      }
    } catch {
      /* fall through */
    }
    setTinyStep({
      title: "Open the thing. Don't do it — just open it.",
      minutes: 5,
    });
  }, [localSteps]);

  // Auto-advance the intro + body sequence.
  useEffect(() => {
    if (!open) return;
    if (stage === "intro") {
      const t = window.setTimeout(() => setStage("body"), 3500);
      return () => window.clearTimeout(t);
    }
    if (stage === "body") {
      const t = window.setTimeout(() => advanceRef.current(), AUTO_MS);
      return () => window.clearTimeout(t);
    }
    return;
  }, [open, stage, bodyIdx]);

  function nextBody() {
    haptic();
    if (bodyIdx + 1 >= BODY_STEPS.length) {
      setStage("count");
      runCountdown();
    } else {
      setBodyIdx(bodyIdx + 1);
    }
  }
  advanceRef.current = nextBody;

  function runCountdown() {
    setCount(5);
    const reduced = prefersReducedMotion();
    let n = 5;
    const id = window.setInterval(
      () => {
        n -= 1;
        setCount(n);
        if (n <= 0) {
          window.clearInterval(id);
          setStage("focus");
        }
      },
      reduced ? 400 : 1000,
    );
  }

  function markPickedDone() {
    if (pick) {
      if (pick.taskId && pick.taskId !== currentTaskId) {
        const completed = (pick.completedSteps ?? []).slice();
        completed[pick.stepIndex] = true;
        void fetch(`/api/tasks/${pick.taskId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ completed_steps: completed }),
        }).catch(() => {});
      } else if (pick.taskId === currentTaskId) {
        onLocalDone(pick.stepIndex);
      }
    }
  }

  function close() {
    setOpen(false);
    setStage("intro");
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="w-full rounded-2xl border-2 border-accent/60 bg-surface px-4 py-3 text-center font-semibold text-accent transition-colors hover:bg-accent-soft"
      >
        SOS · Can&apos;t move
      </button>

      {open && stage === "focus" && tinyStep && (
        <FocusRoom
          step={tinyStep}
          stepIndex={pick?.stepIndex ?? 0}
          taskId={pick?.taskId ?? null}
          otherSteps={[]}
          onDone={markPickedDone}
          onSwap={() => {}}
          onLimit={() => {
            close();
            onLimitFocus();
          }}
          onClose={close}
        />
      )}

      {open && stage !== "focus" && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
          role="dialog"
          aria-modal="true"
          aria-label="SOS"
        >
          <button
            type="button"
            onClick={stage === "intro" ? close : () => setStage("bailed")}
            className="m-5 self-start text-sm text-muted transition-colors hover:text-text"
          >
            ✕
          </button>

          <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 text-center">
            {stage === "intro" && (
              <div className="animate-fade-in">
                <div className="mx-auto mb-8 h-24 w-24 rounded-full bg-gradient-to-br from-[rgb(var(--accent))] to-[rgb(var(--accent-2))] opacity-30 animate-breath" />
                <h1 className="font-display text-2xl font-semibold leading-snug text-text">
                  You&apos;re frozen. That&apos;s a brain state, not a character
                  flaw.
                </h1>
                <p className="mt-3 text-muted">
                  We&apos;ll move in 20 seconds.
                </p>
              </div>
            )}

            {stage === "body" && (
              <div className="animate-fade-in">
                <p className="text-sm uppercase tracking-[0.2em] text-muted">
                  body first
                </p>
                <h1 className="mt-6 font-display text-3xl font-semibold leading-tight text-text">
                  {BODY_STEPS[bodyIdx]}
                </h1>
                <button
                  type="button"
                  onClick={nextBody}
                  className="grad-primary mt-10 w-full max-w-xs rounded-2xl px-5 py-4 text-lg font-semibold shadow-soft"
                >
                  Done — next
                </button>
                <p className="mt-3 text-xs text-muted">
                  (or wait — it moves on its own)
                </p>
              </div>
            )}

            {stage === "count" && (
              <div className="animate-fade-in">
                <p className="text-muted">Here it comes. On zero:</p>
                <p className="mt-4 font-display text-8xl font-bold text-accent">
                  {count > 0 ? count : "go"}
                </p>
                {tinyStep && (
                  <p className="mt-6 max-w-xs text-lg text-text">
                    {tinyStep.title}
                  </p>
                )}
              </div>
            )}

            {stage === "bailed" && (
              <div className="animate-fade-in">
                <h1 className="font-display text-2xl font-semibold text-text">
                  The freeze won this round.
                </h1>
                <p className="mt-3 text-muted">
                  It doesn&apos;t win them all. No record of this anywhere —
                  just a moment that passed.
                </p>
                <div className="mt-8 flex flex-col gap-2.5">
                  <a
                    href="/regulate?tool=cooldown"
                    className="grad-primary rounded-2xl px-5 py-3.5 text-center font-semibold shadow-soft"
                  >
                    Cool-down instead
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setTinyStep((s) =>
                        s ? { ...s, title: `Even smaller: ${s.title}` } : s,
                      );
                      setStage("body");
                      setBodyIdx(0);
                    }}
                    className="rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-text"
                  >
                    Try smaller
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-xl px-5 py-2 text-sm text-muted hover:text-text"
                  >
                    Close for now
                  </button>
                </div>
              </div>
            )}
          </div>

          {stage === "count" && (
            <p className="pb-6 text-center text-sm text-muted">
              You&apos;re allowed to stop after this one. Most brains don&apos;t
              want to once they&apos;re moving.
            </p>
          )}
        </div>
      )}
    </>
  );
}
