"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_INPUT_CHARS } from "@/lib/constants";
import { localRemaining, incrementLocalUsage } from "@/lib/localUsage";
import {
  streamBreakdown,
  streamPost,
  LimitReachedError,
  type BreakdownMode,
} from "@/lib/streamClient";
import type {
  BreakdownStep,
  PartialBreakdown,
  SessionUser,
  TaskRecord,
} from "@/lib/types";
import { StepCard, type SubState } from "./StepCard";
import { PaywallModal, type PaywallVariant } from "./PaywallModal";
import { SiteHeader } from "./SiteHeader";
import { FocusRoom } from "./FocusRoom";
import { PickForMe } from "./PickForMe";
import { SidewaysFlow } from "./SidewaysFlow";
import { AddToHomeHint } from "./AddToHomeHint";
import { SosButton } from "./SosButton";
import { TodayGlance } from "./TodayGlance";
import { Doorway } from "./Doorway";
import { MorningLanding, shouldShowMorningLanding } from "./MorningLanding";
import { capture, EVENTS } from "@/lib/analytics";
import { saveLastFlow, loadLastFlow, type LastFlow } from "@/lib/lastFlow";
import {
  parseStreamingMessage,
  parseStreamingBreakdown,
} from "@/lib/parseBreakdown";
import { compressImage } from "@/lib/image";
import {
  calibrateMinutes,
  ratioIsNotable,
  type TimeTruth,
} from "@/lib/timeTruth";

type Status = "idle" | "loading" | "streaming" | "done" | "crisis" | "error";

const LOADING_LINES = [
  "Reading it through…",
  "Finding the first tiny step…",
  "Shrinking it down for you…",
];

// Contextual surfacing: an emotionally loaded input → offer Regulate first.
const EMOTION_RE =
  /\b(overwhelm\w*|anxious|anxiety|panic\w*|can't cope|cant cope|hate myself|so stressed|stressed|breaking down|falling apart|crying|burnt? ?out|exhausted|hopeless|worthless|angry|furious|rejected|ashamed|spiral\w*)\b/i;
function looksEmotional(text: string): boolean {
  return text.trim().length > 6 && EMOTION_RE.test(text);
}

interface BreakdownScreenProps {
  user: SessionUser | null;
  initialTask?: TaskRecord | null;
  isPro?: boolean;
  timeTruth?: TimeTruth | null;
  /** Last night's wind-down first action, if one was set for today. */
  plannedFirst?: BreakdownStep | null;
  /** Text handed off from the Navigator to pre-fill the composer. */
  initialInput?: string;
}

function sumMinutes(steps: BreakdownStep[]): number {
  return steps.reduce((acc, s) => acc + (s.minutes || 0), 0);
}

/** Pull the micro-step title out of a partially-streamed reentry response. */
function extractMicroTitle(buffer: string): string | null {
  const m = buffer.match(
    /"micro"\s*:\s*\{[^}]*?"title"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  if (!m || m[1] === undefined) return null;
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1];
  }
}

function normalizeChecked(task: TaskRecord): boolean[] {
  return task.steps.map((_, i) => task.completed_steps[i] ?? false);
}

export function BreakdownScreen({
  user,
  initialTask,
  isPro = false,
  timeTruth = null,
  plannedFirst = null,
  initialInput = "",
}: BreakdownScreenProps) {
  const [input, setInput] = useState(initialInput);
  const [status, setStatus] = useState<Status>(() =>
    initialTask ? "done" : "idle",
  );
  const [steps, setSteps] = useState<BreakdownStep[]>(
    () => initialTask?.steps ?? [],
  );
  const [totalMinutes, setTotalMinutes] = useState<number | null>(() =>
    initialTask ? sumMinutes(initialTask.steps) : null,
  );
  const [crisisMessage, setCrisisMessage] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() =>
    initialTask ? normalizeChecked(initialTask) : [],
  );
  const [subState, setSubState] = useState<Record<number, SubState>>({});
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallVariant, setPaywallVariant] =
    useState<PaywallVariant>("breakdowns");
  const [regenerating, setRegenerating] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [morning, setMorning] = useState(false);
  const [resumable, setResumable] = useState<LastFlow | null>(null);
  const [reentry, setReentry] = useState<{
    message: string;
    micro: string | null;
  } | null>(null);
  const [showWinsBanner, setShowWinsBanner] = useState(false);

  const activeInputRef = useRef<string>(initialTask?.input_text ?? "");
  const taskIdRef = useRef<string | null>(initialTask?.id ?? null);
  const abortRef = useRef<AbortController | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  // Anchor for check-off timing (Time Truth): last tick or breakdown finish.
  const tickAnchorRef = useRef<number | null>(null);

  const trimmed = input.trim();
  const canSubmit = trimmed.length > 0 && status !== "loading";
  const busy = status === "loading" || status === "streaming";

  const doneCount = useMemo(() => checked.filter(Boolean).length, [checked]);

  // --- "Where was I?" --------------------------------------------------------
  // Keep the current flow persisted locally so an abandoned tab isn't a lost
  // task; offer to restore it when the screen opens empty.
  useEffect(() => {
    if (steps.length > 0 && status !== "crisis") {
      saveLastFlow({
        taskId: taskIdRef.current,
        input: activeInputRef.current,
        steps,
        checked,
      });
    }
  }, [steps, checked, status]);

  useEffect(() => {
    if (initialTask || steps.length > 0) return;
    const stored = loadLastFlow();
    if (stored) setResumable(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Morning landing: the task list is never the first thing you see AM.
  useEffect(() => {
    const eligible = Boolean(user) || steps.length > 0 || plannedFirst !== null;
    if (shouldShowMorningLanding(eligible)) setMorning(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sunday wins banner (auto recap day) — dismissible per week.
  useEffect(() => {
    if (!user) return;
    if (new Date().getDay() !== 0) return;
    try {
      const weekKey = `adhv-wins-seen-${new Date().toISOString().slice(0, 10)}`;
      if (!localStorage.getItem(weekKey)) setShowWinsBanner(true);
    } catch {
      /* noop */
    }
  }, [user]);

  const dismissWinsBanner = useCallback(() => {
    setShowWinsBanner(false);
    try {
      localStorage.setItem(
        `adhv-wins-seen-${new Date().toISOString().slice(0, 10)}`,
        "1",
      );
    } catch {
      /* noop */
    }
  }, []);

  const resumeLastFlow = useCallback(() => {
    if (!resumable) return;
    activeInputRef.current = resumable.input;
    taskIdRef.current = resumable.taskId;
    setSteps(resumable.steps);
    setChecked(resumable.steps.map((_, i) => resumable.checked[i] ?? false));
    setTotalMinutes(sumMinutes(resumable.steps));
    setStatus("done");
    setResumable(null);
    tickAnchorRef.current = null; // don't count the away-gap as work time

    // A 30-second ramp back in, from the first unfinished step.
    const firstOpen = resumable.steps.find(
      (_, i) => !(resumable.checked[i] ?? false),
    );
    if (firstOpen) {
      setReentry({ message: "", micro: null });
      void streamPost(
        "/api/reentry",
        { stepTitle: firstOpen.title, taskInput: resumable.input || undefined },
        (buffer) => {
          const msg = parseStreamingMessage(buffer);
          setReentry({
            message: msg.message,
            micro: extractMicroTitle(buffer),
          });
        },
      ).catch(() => {
        setReentry({
          message: "Welcome back. No catching up needed.",
          micro: `Just reopen it. That's the whole first move.`,
        });
      });
    }
  }, [resumable]);

  // --- persistence (signed-in users only; fire-and-forget) ----------------
  const createTask = useCallback(
    async (inputText: string, finalSteps: BreakdownStep[]) => {
      if (!user || finalSteps.length === 0) return;
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input_text: inputText, steps: finalSteps }),
        });
        if (res.ok) {
          const body = (await res.json()) as { id: string };
          taskIdRef.current = body.id;
        }
      } catch {
        /* saving is best-effort */
      }
    },
    [user],
  );

  const patchTask = useCallback(
    async (body: Record<string, unknown>) => {
      if (!user || !taskIdRef.current) return;
      try {
        await fetch(`/api/tasks/${taskIdRef.current}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        /* best-effort */
      }
    },
    [user],
  );

  const applyPartial = useCallback((partial: PartialBreakdown) => {
    if (partial.crisis) {
      setCrisisMessage(partial.crisisMessage);
      setStatus("crisis");
      return;
    }
    setSteps(partial.steps);
    setTotalMinutes(partial.totalMinutes);
    setChecked((prev) => {
      if (prev.length === partial.steps.length) return prev;
      return partial.steps.map((_, i) => prev[i] ?? false);
    });
    setStatus((s) =>
      partial.steps.length > 0 && s === "loading" ? "streaming" : s,
    );
  }, []);

  const runMain = useCallback(
    async (theInput: string, mode: BreakdownMode) => {
      // Guests are gated client-side too; signed-in users rely on the server.
      if (!user && localRemaining() <= 0) {
        setPaywallOpen(true);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      activeInputRef.current = theInput;
      setStatus("loading");
      setCrisisMessage(null);
      setSubState({});
      if (mode === "normal") {
        taskIdRef.current = null; // a fresh task
        setSteps([]);
        setChecked([]);
        setTotalMinutes(null);
      }
      setRegenerating(mode === "smaller");

      try {
        const final = await streamBreakdown({
          input: theInput,
          mode,
          signal: controller.signal,
          onUpdate: applyPartial,
        });
        if (!user) incrementLocalUsage();
        setStatus(final.crisis ? "crisis" : "done");
        if (!final.crisis) {
          capture(EVENTS.breakdownCreated, { mode });
          tickAnchorRef.current = Date.now();
        }

        if (!final.crisis && final.steps.length > 0) {
          if (mode === "smaller" && taskIdRef.current) {
            void patchTask({
              steps: final.steps,
              completed_steps: final.steps.map(() => false),
            });
          } else {
            void createTask(theInput, final.steps);
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (err instanceof LimitReachedError) {
          capture(EVENTS.limitHit, { feature: "breakdowns" });
          setPaywallVariant("breakdowns");
          setPaywallOpen(true);
          setStatus(steps.length > 0 ? "done" : "idle");
        } else {
          setStatus("error");
        }
      } finally {
        setRegenerating(false);
      }
    },
    [applyPartial, createTask, patchTask, steps.length, user],
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!canSubmit) return;
      void runMain(trimmed, "normal");
    },
    [canSubmit, runMain, trimmed],
  );

  // --- photo-to-plan ---------------------------------------------------------
  const handlePhotoFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!user && localRemaining() <= 0) {
        setPaywallVariant("breakdowns");
        setPaywallOpen(true);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const note = input.trim();
      activeInputRef.current = note || "The thing in my photo";
      setPhotoBusy(true);
      setStatus("loading");
      setCrisisMessage(null);
      setSubState({});
      taskIdRef.current = null;
      setSteps([]);
      setChecked([]);
      setTotalMinutes(null);

      try {
        // Compress + re-encode client-side (also strips EXIF).
        const { base64 } = await compressImage(file);

        let last: PartialBreakdown = {
          crisis: false,
          crisisMessage: null,
          totalMinutes: null,
          steps: [],
        };
        await streamPost(
          "/api/breakdown/photo",
          { image: base64, note },
          (buffer) => {
            last = parseStreamingBreakdown(buffer);
            applyPartial(last);
          },
          controller.signal,
        );

        if (!user) incrementLocalUsage();
        setStatus(last.crisis ? "crisis" : "done");
        if (!last.crisis) {
          capture(EVENTS.breakdownCreated, { mode: "photo" });
          tickAnchorRef.current = Date.now();
          if (last.steps.length > 0) {
            void createTask(activeInputRef.current, last.steps);
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (err instanceof LimitReachedError) {
          capture(EVENTS.limitHit, { feature: "breakdowns" });
          setPaywallVariant("breakdowns");
          setPaywallOpen(true);
          setStatus("idle");
        } else {
          setStatus("error");
        }
      } finally {
        setPhotoBusy(false);
        if (photoInputRef.current) photoInputRef.current.value = "";
      }
    },
    [applyPartial, createTask, input, user],
  );

  const handleTooBig = useCallback(() => {
    if (busy) return;
    void runMain(activeInputRef.current || trimmed, "smaller");
  }, [busy, runMain, trimmed]);

  const handleBreakDownMore = useCallback(
    async (index: number) => {
      const step = steps[index];
      if (!step) return;
      if (subState[index]?.loading) return;
      if (!user && localRemaining() <= 0) {
        setPaywallOpen(true);
        return;
      }

      setSubState((prev) => ({
        ...prev,
        [index]: { loading: true, steps: [], error: false },
      }));

      try {
        await streamBreakdown({
          input: step.title,
          mode: "subtask",
          onUpdate: (partial) => {
            if (partial.crisis) return;
            setSubState((prev) => ({
              ...prev,
              [index]: { loading: true, steps: partial.steps, error: false },
            }));
          },
        });
        if (!user) incrementLocalUsage();
        setSubState((prev) => ({
          ...prev,
          [index]: {
            loading: false,
            steps: prev[index]?.steps ?? [],
            error: false,
          },
        }));
      } catch (err) {
        if (err instanceof LimitReachedError) {
          setPaywallVariant("breakdowns");
          setPaywallOpen(true);
          setSubState((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
          });
        } else {
          setSubState((prev) => ({
            ...prev,
            [index]: { loading: false, steps: [], error: true },
          }));
        }
      }
    },
    [steps, subState, user],
  );

  const toggleChecked = useCallback(
    (index: number) => {
      setChecked((prev) => {
        const next = [...prev];
        const nowChecked = !next[index];
        next[index] = nowChecked;
        if (nowChecked) {
          capture(EVENTS.stepCompleted);
          // Time Truth: a plausible gap between ticks ≈ how long the step took.
          const anchor = tickAnchorRef.current;
          const step = steps[index];
          if (user && anchor && step) {
            const gapMinutes = (Date.now() - anchor) / 60000;
            if (gapMinutes >= 0.5) {
              void fetch("/api/completions", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  taskId: taskIdRef.current,
                  stepIndex: index,
                  estimatedMinutes: step.minutes,
                  actualMinutes: Math.round(gapMinutes * 10) / 10,
                  source: "checkoff",
                }),
              }).catch(() => {});
            }
          }
          tickAnchorRef.current = Date.now();
        }
        void patchTask({ completed_steps: next });
        return next;
      });
    },
    [patchTask, steps, user],
  );

  // --- focus room (the AI body double) -------------------------------------
  const openFocus = useCallback((index: number) => {
    setFocusIndex(index);
  }, []);

  const focusOtherSteps = useMemo(() => {
    if (focusIndex === null) return [];
    return steps
      .map((step, index) => ({ index, step }))
      .filter(
        ({ index }) => index !== focusIndex && !(checked[index] ?? false),
      );
  }, [focusIndex, steps, checked]);

  const handleFocusDone = useCallback(
    (index: number) => {
      if (!(checked[index] ?? false)) toggleChecked(index);
    },
    [checked, toggleChecked],
  );

  const remaining = MAX_INPUT_CHARS - input.length;
  const showResults = steps.length > 0 || status === "crisis";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:max-w-5xl">
      {!initialTask && <Doorway />}
      <SiteHeader user={user} />

      {/* Desktop: a real workspace — main column + one context sidebar. */}
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col">
          <AddToHomeHint />

          {/* Sunday wins banner */}
          {showWinsBanner && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft/50 p-4 animate-fade-in">
              <a href="/wins" className="min-w-0">
                <span className="block text-sm font-semibold text-accent">
                  Your week&apos;s wins are ready ✨
                </span>
                <span className="block text-sm text-muted">
                  Only what you did. Take a look.
                </span>
              </a>
              <button
                type="button"
                onClick={dismissWinsBanner}
                aria-label="Dismiss"
                className="flex-shrink-0 rounded-full p-2 text-muted transition-colors hover:text-text"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Where was I? — restore an abandoned flow */}
          {resumable && steps.length === 0 && (
            <button
              type="button"
              onClick={resumeLastFlow}
              className="mb-5 w-full rounded-2xl border border-accent/50 bg-accent-soft/50 p-4 text-left transition-colors hover:bg-accent-soft animate-fade-in"
            >
              <span className="block text-sm font-semibold text-accent">
                Where was I? →
              </span>
              <span className="mt-1 block truncate text-sm text-muted">
                {resumable.input || "Your last task"} —{" "}
                {resumable.checked.filter(Boolean).length} of{" "}
                {resumable.steps.length} done
              </span>
            </button>
          )}

          {/* Prompt */}
          <section className="mb-6">
            <h1 className="text-2xl font-semibold leading-tight text-text sm:text-3xl">
              What are you avoiding?
            </h1>
            <p className="mt-2 text-muted">
              Type the thing. We&apos;ll turn it into a first step that takes
              two minutes.
            </p>

            <form onSubmit={handleSubmit} className="mt-5">
              {/* A considered composer, not a raw chat box. */}
              <div className="glass rounded-3xl p-2.5 shadow-soft transition-colors focus-within:border-accent/60">
                <label htmlFor="task-input" className="sr-only">
                  The thing you&apos;re avoiding
                </label>
                <textarea
                  id="task-input"
                  value={input}
                  onChange={(e) =>
                    setInput(e.target.value.slice(0, MAX_INPUT_CHARS))
                  }
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                      handleSubmit();
                  }}
                  placeholder="e.g. reply to that email I've been dreading"
                  rows={3}
                  maxLength={MAX_INPUT_CHARS}
                  className="w-full resize-none rounded-2xl bg-transparent px-3.5 py-3 text-[1.05rem] text-text placeholder:text-muted/60 focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2 border-t border-border/50 px-2 pt-2.5">
                  <span
                    className={`text-xs ${remaining < 40 ? "text-accent" : "text-muted"}`}
                    aria-live="polite"
                  >
                    {remaining} left
                  </span>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={busy || photoBusy}
                    aria-label="Snap a photo of the thing instead"
                    title="Too much to type? Snap it."
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    {photoBusy ? "Reading it…" : "Snap it instead"}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) =>
                      void handlePhotoFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="grad-primary mt-3 w-full rounded-2xl px-5 py-3.5 text-[1.05rem] font-semibold shadow-soft transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "loading" || status === "streaming"
                  ? "Working on it…"
                  : "Make it doable"}
              </button>

              {looksEmotional(input) && status === "idle" && (
                <a
                  href="/regulate?tool=cooldown"
                  className="mt-3 block rounded-2xl border border-accent/40 bg-accent-soft/40 p-3 text-center text-sm text-text transition-colors hover:bg-accent-soft animate-fade-in"
                >
                  Sounds like a lot right now. A 90-second cool-down first? →
                </a>
              )}
            </form>

            {/* The other two primary actions: Pick for me + SOS. */}
            {status !== "loading" && status !== "streaming" && (
              <>
                <PickForMe
                  signedIn={Boolean(user)}
                  currentTaskId={taskIdRef.current}
                  localSteps={steps
                    .map((step, index) => ({ index, step }))
                    .filter(({ index }) => !(checked[index] ?? false))}
                  onLocalDone={handleFocusDone}
                  onLimitFocus={() => {
                    setPaywallVariant("focus");
                    setPaywallOpen(true);
                  }}
                />
                <div className="mt-3">
                  <SosButton
                    signedIn={Boolean(user)}
                    currentTaskId={taskIdRef.current}
                    localSteps={steps
                      .map((step, index) => ({ index, step }))
                      .filter(({ index }) => !(checked[index] ?? false))}
                    onLocalDone={handleFocusDone}
                    onLimitFocus={() => {
                      setPaywallVariant("focus");
                      setPaywallOpen(true);
                    }}
                  />
                </div>
              </>
            )}
          </section>

          {status === "loading" && steps.length === 0 && <LoadingState />}

          {regenerating && steps.length > 0 && (
            <p className="mb-3 text-sm text-accent" aria-live="polite">
              That&apos;s a big one. Let&apos;s shrink it…
            </p>
          )}

          {/* Crisis response — never a task list */}
          {status === "crisis" && (
            <section
              className="animate-fade-in rounded-3xl border border-accent/40 bg-accent-soft/70 p-6"
              role="status"
            >
              <div className="mb-3 text-2xl">💛</div>
              <p className="text-[1.05rem] leading-relaxed text-text">
                {crisisMessage ??
                  "It sounds like you're carrying something really heavy right now. You don't have to hold it alone — please reach out to someone you trust, or in the UK you can call Samaritans free any time on 116 123."}
              </p>
            </section>
          )}

          {/* Error */}
          {status === "error" && (
            <section className="animate-fade-in rounded-2xl border border-border bg-surface p-5">
              <p className="text-text">
                Something went wrong on our side — not you. Give it another go?
              </p>
              <button
                type="button"
                onClick={() =>
                  runMain(activeInputRef.current || trimmed, "normal")
                }
                className="mt-3 rounded-xl bg-accent px-4 py-2 font-medium text-accent-ink transition-colors hover:brightness-105"
              >
                Try again
              </button>
            </section>
          )}

          {/* Results */}
          {showResults && status !== "crisis" && (
            <section aria-live="polite">
              {/* 30-second re-entry ramp after "Where was I?" */}
              {reentry && (reentry.message || reentry.micro) && (
                <div className="mb-4 rounded-2xl border border-accent/40 bg-accent-soft/50 p-4 animate-fade-in">
                  {reentry.message && (
                    <p className="text-sm text-muted">“{reentry.message}”</p>
                  )}
                  {reentry.micro && (
                    <p className="mt-1.5 font-medium text-text">
                      First, just: {reentry.micro}
                    </p>
                  )}
                </div>
              )}
              <ProgressLine done={doneCount} total={steps.length} />

              <ul className="flex flex-col gap-3">
                {steps.map((step, i) => (
                  <StepCard
                    key={i}
                    step={step}
                    index={i}
                    checked={checked[i] ?? false}
                    onToggle={toggleChecked}
                    onBreakDownMore={handleBreakDownMore}
                    onTooBig={handleTooBig}
                    onFocus={openFocus}
                    busy={busy}
                    sub={subState[i]}
                  />
                ))}
              </ul>

              {totalMinutes !== null && status === "done" && (
                <div className="mt-5 text-center">
                  {isPro &&
                  timeTruth?.enough &&
                  ratioIsNotable(timeTruth.ratio) ? (
                    <p className="text-sm font-medium text-accent">
                      Adjusted for how time really works for you: ~
                      {calibrateMinutes(totalMinutes, timeTruth.ratio)} min
                      <span className="font-normal text-muted">
                        {" "}
                        (your brain says {totalMinutes})
                      </span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted">
                    About {totalMinutes} minutes in total. You don&apos;t have
                    to do it all now — just the first one.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Bad-day reset — always within reach, never in the way */}
          <SidewaysFlow
            signedIn={Boolean(user)}
            currentTaskId={taskIdRef.current}
            localSteps={steps
              .map((step, index) => ({ index, step }))
              .filter(({ index }) => !(checked[index] ?? false))}
            onLimit={() => {
              setPaywallVariant("breakdowns");
              setPaywallOpen(true);
            }}
          />

          {/* Evening: close the day (thought-offloading, opt-in) */}
          {user &&
            (new Date().getHours() >= 20 || new Date().getHours() < 4) && (
              <a
                href="/winddown"
                className="mx-auto mt-2 block text-center text-sm text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
              >
                Close the day →
              </a>
            )}
        </div>

        {/* Context sidebar — desktop only, one calm column. */}
        <aside
          aria-label="Context"
          className="hidden lg:sticky lg:top-8 lg:flex lg:flex-col lg:gap-4"
        >
          <TodayGlance enabled={Boolean(user) && isPro} />
          <div className="glass rounded-3xl p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              While you&apos;re here
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <a
                  href="/today"
                  className="text-text transition-colors hover:text-accent"
                >
                  🗓️ Today&apos;s timeline
                </a>
              </li>
              <li>
                <a
                  href="/wins"
                  className="text-text transition-colors hover:text-accent"
                >
                  ✨ This week&apos;s wins
                </a>
              </li>
              <li>
                <a
                  href="/toolkit"
                  className="text-text transition-colors hover:text-accent"
                >
                  🧰 The full toolkit
                </a>
              </li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              One thing at a time. That&apos;s the whole trick.
            </p>
          </div>
        </aside>
      </div>

      {/* Footer disclaimer */}
      <footer className="mt-auto pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </footer>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        variant={paywallVariant}
      />

      {morning && (
        <MorningLanding
          plannedFirst={plannedFirst}
          signedIn={Boolean(user)}
          localSteps={steps
            .map((step, index) => ({ index, step }))
            .filter(({ index }) => !(checked[index] ?? false))}
          currentTaskId={taskIdRef.current}
          onLocalDone={handleFocusDone}
          onLimitFocus={() => {
            setPaywallVariant("focus");
            setPaywallOpen(true);
          }}
          onDismiss={() => setMorning(false)}
        />
      )}

      {focusIndex !== null && steps[focusIndex] && (
        <FocusRoom
          step={steps[focusIndex]}
          stepIndex={focusIndex}
          taskId={taskIdRef.current}
          otherSteps={focusOtherSteps}
          onDone={handleFocusDone}
          onSwap={(newIndex) => setFocusIndex(newIndex)}
          onLimit={() => {
            setFocusIndex(null);
            setPaywallVariant("focus");
            setPaywallOpen(true);
          }}
          onClose={() => setFocusIndex(null)}
        />
      )}
    </div>
  );
}

function ProgressLine({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;

  let message: string;
  if (done === 0) {
    message = "Just the first one. That's all.";
  } else if (done >= total) {
    message = `All ${total} done — however today went, you moved.`;
  } else {
    message = `${done} of ${total} done — you've started, that's the hard part.`;
  }

  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-accent">{message}</p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Steps completed"
      >
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="animate-fade-in" aria-hidden="true">
      <p className="mb-4 text-sm text-muted">
        {LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)]}
      </p>
      <ul className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
          >
            <div className="flex items-start gap-3.5">
              <div className="skeleton mt-0.5 h-7 w-7 flex-shrink-0 rounded-full animate-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded animate-shimmer" />
                <div className="skeleton h-3 w-1/2 rounded animate-shimmer" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
