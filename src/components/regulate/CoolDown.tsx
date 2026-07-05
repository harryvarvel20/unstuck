"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { prefersReducedMotion } from "@/lib/design";
import { useEscape } from "@/lib/hooks";

/**
 * 90-second guided reset. No AI — pure, offline-safe, and NEVER paywalled
 * (a safety tool). Box-breathing → 5-4-3-2-1 senses → name-it → one tiny exit.
 */

type Stage = "breath" | "senses" | "name" | "done";

const BREATH_PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"] as const;
const SENSES = [
  "5 things you can see",
  "4 things you can hear",
  "3 things you can feel",
  "2 things you can smell",
  "1 thing you can taste",
];
const FEELINGS = [
  "overwhelmed",
  "anxious",
  "angry",
  "ashamed",
  "rejected",
  "flat",
  "wired",
  "sad",
  "frustrated",
  "scared",
];

export function CoolDown({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("breath");
  const [phase, setPhase] = useState(0);
  const [, setCycle] = useState(0);
  const [senseIdx, setSenseIdx] = useState(0);
  const [named, setNamed] = useState<string | null>(null);
  const reduced = useRef(prefersReducedMotion());

  useEscape(onClose);

  // Box breathing: 4s per phase, ~3 cycles then move on.
  useEffect(() => {
    if (stage !== "breath") return;
    const dur = reduced.current ? 2000 : 4000;
    const id = window.setTimeout(() => {
      setPhase((p) => {
        const next = (p + 1) % 4;
        if (next === 0) {
          setCycle((c) => {
            if (c + 1 >= 3) {
              setStage("senses");
            }
            return c + 1;
          });
        }
        return next;
      });
    }, dur);
    return () => window.clearTimeout(id);
  }, [stage, phase]);

  const inhaling = phase === 0;
  const holding = phase === 1 || phase === 3;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Cool-down"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          className="self-start text-sm text-muted transition-colors hover:text-text"
        >
          ✕ done
        </button>

        <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          {stage === "breath" && (
            <div>
              <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
                <span
                  className="absolute rounded-full bg-gradient-to-br from-[rgb(var(--accent))] to-[rgb(var(--accent-2))] opacity-25 transition-transform ease-in-out"
                  style={{
                    inset: 0,
                    transform: inhaling
                      ? "scale(1)"
                      : holding
                        ? "scale(0.9)"
                        : "scale(0.55)",
                    transitionDuration: reduced.current ? "0ms" : "3800ms",
                  }}
                />
                <span className="relative font-display text-xl font-semibold text-text">
                  {BREATH_PHASES[phase]}
                </span>
              </div>
              <p className="mt-8 text-muted">
                Follow the circle. Nothing else to do right now.
              </p>
              <button
                type="button"
                onClick={() => setStage("senses")}
                className="mt-4 text-sm text-muted underline-offset-4 hover:text-accent hover:underline"
              >
                skip ahead
              </button>
            </div>
          )}

          {stage === "senses" && (
            <div className="animate-fade-in">
              <p className="text-sm font-medium uppercase tracking-widest text-muted">
                Grounding
              </p>
              <h1 className="mt-4 font-display text-2xl font-semibold text-text">
                {SENSES[senseIdx]}
              </h1>
              <p className="mt-3 text-muted">
                Take your time. Notice them, one by one.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (senseIdx + 1 >= SENSES.length) setStage("name");
                  else setSenseIdx(senseIdx + 1);
                }}
                className="grad-primary mt-8 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
              >
                {senseIdx + 1 >= SENSES.length ? "Done grounding" : "Next"}
              </button>
            </div>
          )}

          {stage === "name" && (
            <div className="animate-fade-in">
              <h1 className="font-display text-2xl font-semibold text-text">
                Name it to tame it
              </h1>
              <p className="mt-2 text-muted">
                What&apos;s the main feeling right now? Naming it turns the
                volume down.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {FEELINGS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setNamed(f);
                      setStage("done");
                    }}
                    className="rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-text transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className="animate-fade-in">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-2xl">
                🌬️
              </div>
              <h1 className="mt-5 font-display text-2xl font-semibold text-text">
                {named
                  ? `Okay — ${named}, and still here.`
                  : "Okay. Still here."}
              </h1>
              <p className="mt-3 text-muted">
                That&apos;s the reset done. What now?
              </p>
              <div className="mt-7 flex flex-col gap-2.5">
                <Link
                  href="/app"
                  className="grad-primary w-full rounded-2xl px-5 py-3.5 text-center font-semibold shadow-soft"
                >
                  Shrink whatever caused this
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-text"
                >
                  Just wanted to breathe
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="pb-2 text-center text-xs text-muted/70">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </div>
    </div>
  );
}
