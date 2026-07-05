"use client";

import { useState } from "react";
import type { BreakdownStep } from "@/lib/types";
import type { PickCandidate } from "@/lib/pick";
import { FocusRoom } from "./FocusRoom";
import { capture, EVENTS } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

const TIME_CHIPS = [5, 15, 30, 60] as const;
const MAX_REROLLS = 2;

interface PickForMeProps {
  signedIn: boolean;
  currentTaskId: string | null;
  /** Unchecked steps currently on screen (the anon/local candidate pool). */
  localSteps: { index: number; step: BreakdownStep }[];
  /** Mark a step of the on-screen task done (parent owns that state). */
  onLocalDone: (index: number) => void;
  onLimitFocus: () => void;
}

type Stage = "idle" | "picking" | "shown" | "focus";

export function PickForMe({
  signedIn,
  currentTaskId,
  localSteps,
  onLocalDone,
  onLimitFocus,
}: PickForMeProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [pick, setPick] = useState<PickCandidate | null>(null);
  const [fallback, setFallback] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [rerolls, setRerolls] = useState(0);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(30);

  useEscape(
    () => {
      setStage("idle");
      setPick(null);
    },
    stage === "picking" || stage === "shown",
  );

  // Nothing to pick from and no account to look in — stay out of the way.
  if (!signedIn && localSteps.length === 0) return null;

  async function runPick(available: number, exclude: string[]) {
    setStage("picking");
    setEmpty(false);
    capture(EVENTS.pickForMeUsed, { minutes: available });
    try {
      const res = await fetch("/api/pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          minutes: available,
          hour: new Date().getHours(),
          exclude,
          localSteps: localSteps.map(({ index, step }) => ({
            index,
            title: step.title,
            minutes: step.minutes,
            tip: step.tip,
          })),
        }),
      });
      if (!res.ok) throw new Error("pick failed");
      const body = (await res.json()) as {
        pick: PickCandidate | null;
        fallback: boolean;
      };
      if (!body.pick) {
        setEmpty(true);
        setStage("shown");
        setPick(null);
        return;
      }
      setPick(body.pick);
      setFallback(body.fallback);
      setStage("shown");
    } catch {
      setEmpty(true);
      setPick(null);
      setStage("shown");
    }
  }

  function start(available: number) {
    setMinutes(available);
    setRerolls(0);
    setExcluded([]);
    void runPick(available, []);
  }

  function reroll() {
    if (!pick || rerolls >= MAX_REROLLS) return;
    const nextExcluded = [...excluded, pick.key];
    setExcluded(nextExcluded);
    setRerolls(rerolls + 1);
    void runPick(minutes, nextExcluded);
  }

  function closeAll() {
    setStage("idle");
    setPick(null);
  }

  /** Mark the picked step done wherever it lives. */
  function handlePickedDone() {
    if (!pick) return;
    if (pick.taskId && pick.taskId !== currentTaskId) {
      const completed = (pick.completedSteps ?? []).slice();
      completed[pick.stepIndex] = true;
      void fetch(`/api/tasks/${pick.taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed_steps: completed }),
      }).catch(() => {});
    } else {
      onLocalDone(pick.stepIndex);
    }
  }

  return (
    <>
      {/* entry block */}
      <section className="mt-6 rounded-2xl border border-border bg-surface-2/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-text">Can&apos;t choose?</p>
            <p className="text-sm text-muted">I&apos;ve got…</p>
          </div>
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Minutes available"
          >
            {TIME_CHIPS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => start(m)}
                className="h-11 min-w-[3.25rem] rounded-full border border-border bg-surface px-2 text-sm font-semibold text-text transition-colors hover:border-accent/60 hover:text-accent"
              >
                {m}
                <span className="block text-[9px] font-normal text-muted">
                  min
                </span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => start(30)}
          className="mt-3 w-full rounded-2xl border-2 border-accent/70 bg-surface px-5 py-3 font-semibold text-accent transition-colors hover:bg-accent-soft"
        >
          Pick for me
        </button>
      </section>

      {/* pick overlay */}
      {stage !== "idle" && stage !== "focus" && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Your next step"
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5">
            <button
              type="button"
              onClick={closeAll}
              aria-label="Close"
              className="inline-flex h-10 w-10 items-center justify-center self-start rounded-full text-muted transition-colors hover:text-text"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-1 flex-col justify-center pb-16 text-center">
              {stage === "picking" && (
                <p className="text-muted animate-fade-in">
                  Picking your one thing…
                </p>
              )}

              {stage === "shown" && empty && (
                <div className="animate-fade-in">
                  <p className="text-lg text-text">
                    Nothing waiting to be picked yet.
                  </p>
                  <p className="mt-2 text-muted">
                    Break something down first, then I can choose for you.
                  </p>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="mt-6 rounded-2xl bg-accent px-6 py-3 font-semibold text-accent-ink"
                  >
                    Okay
                  </button>
                </div>
              )}

              {stage === "shown" && pick && (
                <div className="animate-fade-in">
                  <p className="text-sm font-medium uppercase tracking-widest text-muted">
                    {rerolls >= MAX_REROLLS
                      ? "Let's just do the tiny one — momentum beats perfection"
                      : fallback
                        ? "Nothing fits the window, so: the tiniest thing"
                        : "Your one thing"}
                  </p>
                  <h2 className="mt-4 text-2xl font-semibold leading-snug text-text">
                    {pick.title}
                  </h2>
                  <p className="mt-2 text-muted">
                    about {pick.calMinutes} min
                    {pick.taskInput ? (
                      <span className="block truncate text-sm">
                        from: {pick.taskInput}
                      </span>
                    ) : null}
                  </p>

                  <div className="mt-9 flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => setStage("focus")}
                      className="w-full rounded-2xl bg-accent px-5 py-4 text-lg font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99]"
                    >
                      Start focus session
                    </button>
                    {rerolls < MAX_REROLLS && (
                      <button
                        type="button"
                        onClick={reroll}
                        className="w-full rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-muted transition-colors hover:border-accent/40 hover:text-text"
                      >
                        Not this one
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* focus session on the picked step */}
      {stage === "focus" && pick && (
        <FocusRoom
          step={{ title: pick.title, minutes: pick.minutes, tip: pick.tip }}
          stepIndex={pick.stepIndex}
          taskId={pick.taskId}
          otherSteps={[]}
          onDone={handlePickedDone}
          onSwap={() => {}}
          onLimit={() => {
            closeAll();
            onLimitFocus();
          }}
          onClose={closeAll}
        />
      )}
    </>
  );
}
