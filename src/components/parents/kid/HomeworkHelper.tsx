"use client";

import { useState } from "react";
import { useEscape } from "@/lib/hooks";
import { burstConfetti } from "@/lib/confetti";
import { haptic } from "@/lib/design";
import { capture } from "@/lib/analytics";
import type { AgeBand } from "@/lib/parents";

/**
 * Homework helper (W4) — type the dreaded task → tiny steps (first one
 * laughably small) with a movement break built in, a checkable list and a
 * celebration. Zero-shame. Uses the parent coach endpoint (homework kind).
 */
interface Step {
  title: string;
  minutes: number;
}

export function HomeworkHelper({
  ageBand,
  onClose,
}: {
  ageBand: AgeBand;
  onClose: () => void;
}) {
  const [task, setTask] = useState("");
  const [stage, setStage] = useState<"input" | "loading" | "steps" | "safety">(
    "input",
  );
  const [message, setMessage] = useState("");
  const [celebrate, setCelebrate] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [done, setDone] = useState<boolean[]>([]);
  const [safety, setSafety] = useState("");
  const [error, setError] = useState(false);
  useEscape(onClose);

  async function go() {
    if (!task.trim()) return;
    setStage("loading");
    setError(false);
    try {
      const res = await fetch("/api/parents/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "homework", ageBand, text: task }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.childSafety) {
        capture("child_safety_routed", { surface: "homework" });
        setSafety(body.message as string);
        setStage("safety");
        return;
      }
      const r = body.result as {
        message?: string;
        steps?: Step[];
        celebrate?: string;
      };
      if (res.ok && r?.steps?.length) {
        setMessage(r.message ?? "");
        setSteps(r.steps);
        setCelebrate(r.celebrate ?? "Done! That was hard and you did it.");
        setDone(new Array(r.steps.length).fill(false));
        setStage("steps");
      } else {
        setError(true);
        setStage("input");
      }
    } catch {
      setError(true);
      setStage("input");
    }
  }

  function toggle(i: number, e: React.MouseEvent) {
    haptic(8);
    setDone((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      if (next.every(Boolean)) {
        const r = (e.target as HTMLElement).getBoundingClientRect();
        burstConfetti(r.left + r.width / 2, r.top, 18);
      }
      return next;
    });
  }

  const allDone = done.length > 0 && done.every(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Homework helper"
    >
      <button
        type="button"
        onClick={onClose}
        className="m-4 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted"
      >
        ✕ close
      </button>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
        {stage === "safety" && (
          <div className="animate-fade-in">
            <div className="text-2xl">💛</div>
            <p className="mt-3 text-[1.05rem] leading-relaxed text-text">
              {safety}
            </p>
          </div>
        )}

        {stage === "input" && (
          <>
            <h1 className="font-display text-2xl font-semibold text-text">
              What&apos;s the homework?
            </h1>
            <p className="mt-2 text-muted">
              Type it in. We&apos;ll shrink it to steps so small the first one
              barely counts.
            </p>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value.slice(0, 500))}
              rows={3}
              autoFocus
              placeholder="e.g. write a book review, 10 maths questions"
              className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            {error && (
              <p className="mt-3 text-sm text-accent">
                Couldn&apos;t do that just now — try again.
              </p>
            )}
            <button
              type="button"
              onClick={() => void go()}
              disabled={!task.trim()}
              className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
            >
              Break it down
            </button>
          </>
        )}

        {stage === "loading" && (
          <p className="mt-16 text-center text-muted">Making it tiny…</p>
        )}

        {stage === "steps" && (
          <div className="animate-fade-in">
            {message && <p className="text-muted">{message}</p>}
            <ul className="mt-4 flex flex-col gap-2.5">
              {steps.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={(e) => toggle(i, e)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                      done[i]
                        ? "border-accent/50 bg-accent-soft/60"
                        : "border-border bg-surface"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                        done[i]
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-border"
                      }`}
                    >
                      {done[i] ? "✓" : ""}
                    </span>
                    <span
                      className={`flex-1 ${done[i] ? "text-muted line-through" : "text-text"}`}
                    >
                      {s.title}
                    </span>
                    <span className="text-xs text-muted">{s.minutes}m</span>
                  </button>
                </li>
              ))}
            </ul>
            {allDone && (
              <div className="mt-6 rounded-2xl bg-accent-soft/60 p-4 text-center animate-fade-in">
                <div className="text-3xl">🎉</div>
                <p className="mt-2 font-medium text-text">{celebrate}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
