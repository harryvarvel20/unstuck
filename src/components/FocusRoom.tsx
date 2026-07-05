"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BreakdownStep } from "@/lib/types";
import { parseStreamingMessage } from "@/lib/parseBreakdown";
import {
  streamPost,
  streamBreakdown,
  LimitReachedError,
} from "@/lib/streamClient";
import {
  startAmbient,
  stopAmbient,
  isAmbientPlaying,
} from "@/lib/ambientSound";
import { capture, EVENTS } from "@/lib/analytics";
import { burstConfetti } from "@/lib/confetti";
import { haptic } from "@/lib/design";

type Stage = "setup" | "running" | "struggle" | "timeup" | "done";

const DURATIONS = [10, 25, 50] as const;
type Duration = (typeof DURATIONS)[number];

const CANNED: Record<string, string[]> = {
  start: [
    "What's the very first move? I'll be right here.",
    "Just the first small motion. I'm not going anywhere.",
  ],
  midpoint: [
    "Still here with you. One small move at a time.",
    "Halfway. Whatever you've done so far counts.",
  ],
  complete: [
    "You did the thing. Starting was the hard part — and you started.",
    "That's done. Notice how that feels for a second.",
  ],
  timeup: [
    "Time's up — and you showed up, which is the hard part.",
    "The timer's done. You sat with it, and that counts.",
  ],
};

function canned(phase: string): string {
  const lines = CANNED[phase] ?? ["I'm here with you."];
  return (
    lines[Math.floor(Math.random() * lines.length)] ?? "I'm here with you."
  );
}

interface FocusRoomProps {
  step: BreakdownStep;
  stepIndex: number;
  taskId: string | null;
  /** Other unchecked steps, for "swap to an easier step". */
  otherSteps: { index: number; step: BreakdownStep }[];
  onDone: (stepIndex: number) => void;
  onSwap: (newIndex: number) => void;
  onLimit: () => void;
  onClose: () => void;
}

export function FocusRoom({
  step,
  stepIndex,
  taskId,
  otherSteps,
  onDone,
  onSwap,
  onLimit,
  onClose,
}: FocusRoomProps) {
  const [stage, setStage] = useState<Stage>("setup");
  const [duration, setDuration] = useState<Duration>(25);
  const [remaining, setRemaining] = useState(0); // seconds
  const [message, setMessage] = useState<string>("");
  const [microStep, setMicroStep] = useState<BreakdownStep | null>(null);
  const [rescue, setRescue] = useState<{
    loading: boolean;
    tiny: BreakdownStep | null;
  }>({ loading: false, tiny: null });
  const [soundOn, setSoundOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [signalAnswered, setSignalAnswered] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const endAtRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const totalSecondsRef = useRef<number>(0);
  const midpointFiredRef = useRef(false);
  const struggledRef = useRef(false);
  const stageRef = useRef<Stage>("setup");
  stageRef.current = stage;

  const displayStep = microStep ?? step;

  // ---- streamed check-in messages (canned fallback) -----------------------
  const runCheckin = useCallback(
    async (phase: "start" | "midpoint" | "complete" | "timeup") => {
      setMessage("");
      let got = false;
      try {
        await streamPost(
          "/api/focus/checkin",
          {
            phase,
            stepTitle: step.title,
            minutes: duration,
          },
          (buffer) => {
            const parsed = parseStreamingMessage(buffer);
            if (parsed.message) {
              got = true;
              setMessage(parsed.message);
            }
          },
        );
      } catch {
        /* fall through to canned */
      }
      if (!got) setMessage(canned(phase));
    },
    [step.title, duration],
  );

  // ---- timer ---------------------------------------------------------------
  useEffect(() => {
    if (stage !== "running" && stage !== "struggle") return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.round((endAtRef.current - Date.now()) / 1000),
      );
      setRemaining(left);
      if (
        !midpointFiredRef.current &&
        totalSecondsRef.current > 0 &&
        left <= totalSecondsRef.current / 2 &&
        left > 0 &&
        stageRef.current === "running"
      ) {
        midpointFiredRef.current = true;
        void runCheckin("midpoint");
      }
      if (left <= 0 && stageRef.current !== "timeup") {
        setStage("timeup");
        void runCheckin("timeup");
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [stage, runCheckin]);

  // Escape closes; clean up sound on unmount.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      stopAmbient();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsedMinutes = useCallback((): number => {
    if (!startedAtRef.current) return 0;
    return Math.round(((Date.now() - startedAtRef.current) / 60000) * 10) / 10;
  }, []);

  const patchSession = useCallback((body: Record<string, unknown>) => {
    const id = sessionIdRef.current;
    if (!id) return;
    void fetch(`/api/focus/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, []);

  // ---- stage transitions ----------------------------------------------------
  async function begin() {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/focus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId,
          stepIndex,
          stepTitle: step.title,
          plannedMinutes: duration,
          estimatedMinutes: step.minutes,
        }),
      });
      if (res.status === 429) {
        capture(EVENTS.limitHit, { feature: "focus" });
        onLimit();
        return;
      }
      if (res.ok) {
        const body = (await res.json()) as { id: string | null };
        sessionIdRef.current = body.id;
      }
    } catch {
      /* run the session anyway — presence matters more than telemetry */
    } finally {
      setStarting(false);
    }

    capture(EVENTS.focusStarted, { minutes: duration });
    totalSecondsRef.current = duration * 60;
    endAtRef.current = Date.now() + duration * 60 * 1000;
    startedAtRef.current = Date.now();
    midpointFiredRef.current = false;
    setRemaining(duration * 60);
    setStage("running");
    void runCheckin("start");
  }

  function handleDone() {
    burstConfetti(window.innerWidth / 2, window.innerHeight / 2, 20);
    haptic([10, 40, 10]);
    capture(EVENTS.focusCompleted, {
      minutes: duration,
      struggled: struggledRef.current,
    });
    patchSession({
      completed: true,
      struggled: struggledRef.current,
      actualMinutes: elapsedMinutes(),
    });
    onDone(stepIndex);
    setStage("done");
    void runCheckin("complete");
  }

  function handleStruggling() {
    struggledRef.current = true;
    capture(EVENTS.struggledPressed);
    patchSession({ struggled: true });
    setStage("struggle");
    setRescue({ loading: true, tiny: null });
    void (async () => {
      try {
        const final = await streamBreakdown({
          input: displayStep.title,
          mode: "rescue",
          endpoint: "/api/focus/rescue",
          onUpdate: (partial) => {
            const first = partial.steps[0];
            if (first) setRescue({ loading: true, tiny: first });
          },
        });
        const first = final.steps[0];
        setRescue({ loading: false, tiny: first ?? null });
      } catch (err) {
        if (err instanceof LimitReachedError) {
          setRescue({
            loading: false,
            tiny: { title: "Just do the first 60 seconds of it.", minutes: 1 },
          });
        } else {
          setRescue({
            loading: false,
            tiny: { title: "Just do the first 60 seconds of it.", minutes: 1 },
          });
        }
      }
    })();
  }

  function handleSwapEasier() {
    if (otherSteps.length === 0) return;
    const easiest = [...otherSteps].sort(
      (a, b) => a.step.minutes - b.step.minutes,
    )[0];
    if (!easiest) return;
    setMicroStep(null);
    onSwap(easiest.index);
    setStage("running");
    setMessage(`Different door, same building. This one's smaller.`);
  }

  function extendTen() {
    endAtRef.current = Date.now() + 10 * 60 * 1000;
    totalSecondsRef.current = 10 * 60;
    midpointFiredRef.current = true; // no second midpoint nudge
    setStage("running");
    setMessage("Ten more. Same seat, same company.");
  }

  function endIncomplete(kind: "break" | "park") {
    patchSession({
      completed: false,
      struggled: struggledRef.current,
      actualMinutes: elapsedMinutes(),
    });
    stopAmbient();
    onClose();
    void kind;
  }

  function handleClose() {
    if (stageRef.current === "running" || stageRef.current === "struggle") {
      patchSession({
        completed: false,
        struggled: struggledRef.current,
        actualMinutes: elapsedMinutes(),
      });
    }
    stopAmbient();
    onClose();
  }

  function sendSignal(pulledIn: boolean) {
    setSignalAnswered(true);
    capture("focus_signal", { pulled_in: pulledIn });
    void fetch("/api/signals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "focus",
        pulled_in: pulledIn,
        title: step.title,
        hour: new Date().getHours(),
      }),
    }).catch(() => {});
  }

  function toggleSound() {
    if (isAmbientPlaying()) {
      stopAmbient();
      setSoundOn(false);
    } else {
      startAmbient();
      setSoundOn(true);
    }
  }

  // ---- countdown maths ------------------------------------------------------
  const fraction = useMemo(() => {
    if (totalSecondsRef.current === 0) return 1;
    return Math.max(0, Math.min(1, remaining / totalSecondsRef.current));
  }, [remaining]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  const R = 110;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Focus session"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-5">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Leave focus session"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:text-text"
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
          {(stage === "running" ||
            stage === "struggle" ||
            stage === "timeup") && (
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={
                soundOn ? "Turn ambient sound off" : "Turn ambient sound on"
              }
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                soundOn
                  ? "border-accent/60 text-accent"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                {soundOn && <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
              </svg>
            </button>
          )}
        </div>

        {/* ================= SETUP ================= */}
        {stage === "setup" && (
          <div className="flex flex-1 flex-col justify-center pb-16">
            <p className="text-center text-sm font-medium uppercase tracking-widest text-muted">
              One step, together
            </p>
            <h1 className="mt-3 text-center text-2xl font-semibold leading-snug text-text">
              {displayStep.title}
            </h1>
            <p className="mt-2 text-center text-muted">
              about {displayStep.minutes} min
            </p>

            <fieldset className="mt-10">
              <legend className="sr-only">Session length</legend>
              <div className="flex justify-center gap-3">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    aria-pressed={duration === d}
                    className={`h-14 w-20 rounded-2xl border text-lg font-semibold transition-colors ${
                      duration === d
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-muted hover:border-accent/40"
                    }`}
                  >
                    {d}
                    <span className="block text-[10px] font-normal">min</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => void begin()}
              disabled={starting}
              className="grad-primary mt-10 w-full rounded-2xl px-5 py-4 text-lg font-semibold shadow-soft transition-all active:scale-[0.99] disabled:opacity-60"
            >
              {starting ? "Settling in…" : "Begin — I'll sit with you"}
            </button>
          </div>
        )}

        {/* ================= RUNNING / STRUGGLE / TIMEUP ================= */}
        {(stage === "running" ||
          stage === "struggle" ||
          stage === "timeup") && (
          <div className="flex flex-1 flex-col items-center justify-center pb-10">
            {/* the visual countdown disc */}
            <div className="relative" aria-hidden="true">
              <svg width="260" height="260" viewBox="0 0 260 260">
                <circle
                  cx="130"
                  cy="130"
                  r={R}
                  fill="none"
                  stroke="rgb(var(--surface-2))"
                  strokeWidth="14"
                />
                <circle
                  cx="130"
                  cy="130"
                  r={R}
                  fill="none"
                  stroke="rgb(var(--accent))"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - fraction)}
                  transform="rotate(-90 130 130)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-5xl font-bold tabular-nums text-text"
                  aria-hidden="true"
                >
                  {mm}:{ss.toString().padStart(2, "0")}
                </span>
              </div>
            </div>
            <p className="sr-only" aria-live="off">
              {mm} minutes {ss} seconds remaining
            </p>

            <h1 className="mt-7 max-w-sm text-center text-xl font-semibold leading-snug text-text">
              {displayStep.title}
            </h1>

            {/* presence */}
            <div className="mt-4 flex items-center gap-2 text-sm text-muted">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              I&apos;m here with you
            </div>

            {message && (
              <p
                className="mt-4 min-h-[3rem] max-w-sm text-center text-[0.95rem] leading-relaxed text-muted"
                aria-live="polite"
              >
                “{message}”
              </p>
            )}

            {/* ---- struggle panel ---- */}
            {stage === "struggle" && (
              <div className="mt-6 w-full rounded-3xl border border-accent/40 bg-surface p-5 animate-fade-in">
                <p className="text-sm font-medium text-accent">
                  Okay. Let&apos;s make it smaller.
                </p>
                {rescue.tiny ? (
                  <p className="mt-2 text-lg font-semibold text-text">
                    Try just this: {rescue.tiny.title}
                    <span className="ml-2 text-sm font-normal text-muted">
                      {rescue.tiny.minutes} min
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-muted">Shrinking it…</p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={!rescue.tiny}
                    onClick={() => {
                      if (rescue.tiny) setMicroStep(rescue.tiny);
                      setStage("running");
                      setMessage("Just that one tiny thing. I'm right here.");
                    }}
                    className="w-full rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink transition-all hover:brightness-105 disabled:opacity-50"
                  >
                    Do just this
                  </button>
                  {otherSteps.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSwapEasier}
                      className="w-full rounded-2xl border border-border bg-surface-2 px-5 py-3 font-medium text-text transition-colors hover:border-accent/40"
                    >
                      Swap to an easier step
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStage("running")}
                    className="w-full rounded-xl px-5 py-2 text-sm text-muted transition-colors hover:text-text"
                  >
                    Keep going as I was
                  </button>
                </div>
              </div>
            )}

            {/* ---- time-up panel ---- */}
            {stage === "timeup" && (
              <div className="mt-6 w-full rounded-3xl border border-border bg-surface p-5 animate-fade-in">
                <p className="text-text">
                  Keep going, take a break, or park it?
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={extendTen}
                    className="w-full rounded-2xl bg-accent px-5 py-3 font-semibold text-accent-ink transition-all hover:brightness-105"
                  >
                    Keep going — 10 more minutes
                  </button>
                  <button
                    type="button"
                    onClick={() => endIncomplete("break")}
                    className="w-full rounded-2xl border border-border bg-surface-2 px-5 py-3 font-medium text-text transition-colors hover:border-accent/40"
                  >
                    Take a break
                  </button>
                  <button
                    type="button"
                    onClick={() => endIncomplete("park")}
                    className="w-full rounded-xl px-5 py-2 text-sm text-muted transition-colors hover:text-text"
                  >
                    Park it for now
                  </button>
                </div>
              </div>
            )}

            {/* ---- primary actions while running ---- */}
            {stage === "running" && (
              <div className="mt-8 w-full">
                <button
                  type="button"
                  onClick={handleDone}
                  className="grad-primary w-full rounded-2xl px-5 py-4 text-lg font-semibold shadow-soft transition-all active:scale-[0.99]"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleStruggling}
                  className="mt-2.5 w-full rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-muted transition-colors hover:border-accent/40 hover:text-text"
                >
                  Struggling
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= DONE ================= */}
        {stage === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center animate-fade-in">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-ink">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="animate-tick-pop"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mt-6 text-2xl font-semibold text-text">Done.</h1>
            {message && (
              <p
                className="mt-3 max-w-sm text-[1.05rem] leading-relaxed text-muted"
                aria-live="polite"
              >
                “{message}”
              </p>
            )}

            {/* One-tap Focus Profile signal (feeds Phase Q). */}
            {!signalAnswered && (
              <div className="mt-7 w-full rounded-2xl border border-border bg-surface p-4 text-center">
                <p className="text-sm text-muted">Did that pull you in?</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => sendSignal(true)}
                    className="rounded-full border border-accent/50 bg-surface px-4 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
                  >
                    Pulled me in
                  </button>
                  <button
                    type="button"
                    onClick={() => sendSignal(false)}
                    className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-text"
                  >
                    Had to drag
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="mt-6 w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105"
            >
              Back to your steps
            </button>

            {/* Contextual, skippable, never a modal (Phase U). */}
            <a
              href={`/activity?share=${encodeURIComponent(step.title.slice(0, 200))}`}
              className="mt-4 text-sm text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
            >
              Proud of this one? Share the win →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
