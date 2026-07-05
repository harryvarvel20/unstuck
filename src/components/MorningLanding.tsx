"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BreakdownStep } from "@/lib/types";
import type { PickCandidate } from "@/lib/pick";
import { FocusRoom } from "./FocusRoom";
import { prefersReducedMotion } from "@/lib/design";
import { capture } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

/**
 * The anti-dread ramp. When the app opens in the morning, the task list is
 * NOT the first thing you see — one slow breath, then exactly one tiny
 * starting point. "Show me the rest" reveals the app.
 */

const KEY_PREFIX = "adhv-morning-";

function todayKey(): string {
  return `${KEY_PREFIX}${new Date().toISOString().slice(0, 10)}`;
}

export function shouldShowMorningLanding(eligible: boolean): boolean {
  if (typeof window === "undefined") return false;
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 12) return false;
  if (!eligible) return false;
  try {
    return !window.localStorage.getItem(todayKey());
  } catch {
    return false;
  }
}

interface MorningLandingProps {
  /** Tomorrow-you's chosen first action from last night's wind-down. */
  plannedFirst: BreakdownStep | null;
  signedIn: boolean;
  localSteps: { index: number; step: BreakdownStep }[];
  currentTaskId: string | null;
  onLocalDone: (index: number) => void;
  onLimitFocus: () => void;
  onDismiss: () => void;
}

type Stage = "breath" | "line" | "step" | "focus" | "empty";

export function MorningLanding({
  plannedFirst,
  localSteps,
  currentTaskId,
  onLocalDone,
  onLimitFocus,
  onDismiss,
}: MorningLandingProps) {
  const [stage, setStage] = useState<Stage>(() =>
    prefersReducedMotion() ? "line" : "breath",
  );
  const [pick, setPick] = useState<PickCandidate | null>(null);
  const [first, setFirst] = useState<BreakdownStep | null>(plannedFirst);
  const fetchedRef = useRef(false);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(todayKey(), "1");
    } catch {
      /* noop */
    }
    onDismiss();
  }, [onDismiss]);

  useEscape(dismiss, stage !== "focus");

  // Resolve the one tiny first action (wind-down plan wins; else pick logic).
  useEffect(() => {
    if (first || fetchedRef.current) return;
    fetchedRef.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            minutes: 30,
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
            setFirst({
              title: body.pick.title,
              minutes: body.pick.calMinutes,
              tip: body.pick.tip,
            });
            return;
          }
        }
        setFirst(null);
      } catch {
        setFirst(null);
      }
    })();
  }, [first, localSteps]);

  // Sequence timing: breath ~7s, line ~2.6s, then the step.
  useEffect(() => {
    capture("morning_landing_shown");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (stage === "breath") {
      const t = window.setTimeout(() => setStage("line"), 7000);
      return () => window.clearTimeout(t);
    }
    if (stage === "line") {
      const t = window.setTimeout(
        () =>
          setStage(
            first === null && fetchedRef.current && !plannedFirst
              ? "empty"
              : "step",
          ),
        2600,
      );
      return () => window.clearTimeout(t);
    }
    return;
  }, [stage, first, plannedFirst]);

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

  if (stage === "focus" && first) {
    return (
      <FocusRoom
        step={first}
        stepIndex={pick?.stepIndex ?? 0}
        taskId={pick?.taskId ?? null}
        otherSteps={[]}
        onDone={markPickedDone}
        onSwap={() => {}}
        onLimit={() => {
          dismiss();
          onLimitFocus();
        }}
        onClose={dismiss}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Good morning"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-6">
        <button
          type="button"
          onClick={dismiss}
          className="self-end text-sm text-muted transition-colors hover:text-text"
        >
          show me the rest
        </button>

        <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
          {stage === "breath" && (
            <div className="animate-fade-in">
              <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-accent/15 animate-breath" />
                <span className="absolute inset-6 rounded-full bg-accent/20 animate-breath [animation-delay:150ms]" />
                <span className="text-sm text-muted">breathe</span>
              </div>
              <p className="mt-8 text-muted">One slow one. No rush at all.</p>
            </div>
          )}

          {stage === "line" && (
            <p className="animate-fade-in font-display text-2xl font-semibold leading-snug text-text">
              Today has exactly one starting point —{" "}
              <span className="grad-text">and it&apos;s tiny.</span>
            </p>
          )}

          {stage === "step" && (
            <div className="animate-fade-in">
              <p className="text-sm font-medium uppercase tracking-widest text-muted">
                Your one starting point
              </p>
              {first ? (
                <>
                  <h1 className="mt-4 font-display text-2xl font-semibold leading-snug text-text">
                    {first.title}
                  </h1>
                  <p className="mt-2 text-muted">about {first.minutes} min</p>
                </>
              ) : (
                <p className="mt-4 text-muted">Finding it…</p>
              )}
              <p className="mt-6 text-[0.95rem] text-muted">
                That&apos;s all today needs from you right now.
              </p>

              <div className="mt-8 flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={!first}
                  onClick={() => setStage("focus")}
                  className="grad-primary w-full rounded-2xl px-5 py-3.5 text-lg font-semibold shadow-soft transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  Start with just this
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="w-full rounded-xl px-5 py-2 text-sm text-muted transition-colors hover:text-text"
                >
                  show me the rest
                </button>
              </div>
            </div>
          )}

          {stage === "empty" && (
            <div className="animate-fade-in">
              <p className="font-display text-2xl font-semibold text-text">
                Nothing&apos;s waiting. Genuinely.
              </p>
              <p className="mt-3 text-muted">
                If something&apos;s circling your head, we can shrink it — but
                the morning doesn&apos;t owe anyone a to-do list.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="grad-primary mt-8 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
              >
                Okay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
