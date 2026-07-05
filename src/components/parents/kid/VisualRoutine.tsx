"use client";

import { useState } from "react";
import { burstConfetti } from "@/lib/confetti";
import { haptic } from "@/lib/design";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";
import type { AgeBand } from "@/lib/parents";

/**
 * Visual routine (W4) — a shared-screen, one-step-at-a-time day the child runs
 * with the parent. Picture-led for little ones, checklist for middle, and
 * teen-owned/editable for 13–17. Transition warnings + a celebration at the
 * end. Reuses the confetti engine. No data captured.
 */

type Step = { emoji: string; label: string };

const PRESETS: Record<string, { title: string; steps: Step[] }> = {
  morning: {
    title: "Morning",
    steps: [
      { emoji: "☀️", label: "Wake up & stretch" },
      { emoji: "👕", label: "Get dressed" },
      { emoji: "🥣", label: "Breakfast" },
      { emoji: "🪥", label: "Brush teeth" },
      { emoji: "🎒", label: "Pack the bag" },
      { emoji: "👟", label: "Shoes on" },
    ],
  },
  bedtime: {
    title: "Bedtime",
    steps: [
      { emoji: "🛁", label: "Bath or wash" },
      { emoji: "👚", label: "Pyjamas on" },
      { emoji: "🚽", label: "Wee & wash hands" },
      { emoji: "🪥", label: "Brush teeth" },
      { emoji: "📖", label: "Story" },
      { emoji: "🌙", label: "Lights low, snuggle down" },
    ],
  },
  homework: {
    title: "Homework",
    steps: [
      { emoji: "🧺", label: "Get everything you need" },
      { emoji: "👀", label: "Just read the title" },
      { emoji: "✏️", label: "Do the first tiny bit" },
      { emoji: "🤸", label: "Movement break" },
      { emoji: "✏️", label: "Do a bit more" },
      { emoji: "✅", label: "Pack it away — done!" },
    ],
  },
  leaving: {
    title: "Leaving the house",
    steps: [
      { emoji: "🚽", label: "Last toilet trip" },
      { emoji: "👟", label: "Shoes on" },
      { emoji: "🧥", label: "Coat on" },
      { emoji: "🎒", label: "Grab the bag" },
      { emoji: "🚪", label: "Out the door" },
    ],
  },
};

export function VisualRoutine({
  ageBand,
  onClose,
}: {
  ageBand: AgeBand;
  onClose: () => void;
}) {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  useEscape(onClose);

  const preset = presetId ? PRESETS[presetId] : null;

  function advance() {
    if (!preset) return;
    haptic(8);
    if (idx + 1 >= preset.steps.length) {
      setDone(true);
      const c = document.querySelector(".routine-cta");
      const r = c?.getBoundingClientRect();
      burstConfetti(
        r ? r.left + r.width / 2 : window.innerWidth / 2,
        r ? r.top : window.innerHeight / 2,
        18,
      );
      capture("kid_routine_run", { ageBand, preset: presetId });
    } else {
      setIdx(idx + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Visual routine"
    >
      <button
        type="button"
        onClick={onClose}
        className="m-4 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted"
      >
        ✕ close
      </button>

      {!preset && (
        <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
          <h1 className="font-display text-2xl font-semibold text-text">
            Pick a routine
          </h1>
          <p className="mt-2 text-muted">
            {ageBand === "13-17"
              ? "Pick one to run — you can tweak the steps as you go."
              : "Tap one and do it together, one step at a time."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {Object.entries(PRESETS).map(([id, p]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPresetId(id);
                  setIdx(0);
                  setDone(false);
                }}
                className="glass rounded-3xl p-6 text-center shadow-soft transition-transform active:scale-[0.97]"
              >
                <div className="text-3xl">{p.steps[0]?.emoji}</div>
                <p className="mt-2 font-semibold text-text">{p.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {preset && !done && (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted">
            {preset.title} · step {idx + 1} of {preset.steps.length}
          </p>
          <div className="mt-8 text-[6rem] leading-none">
            {preset.steps[idx]?.emoji}
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold text-text">
            {preset.steps[idx]?.label}
          </h1>
          {idx + 1 < preset.steps.length && (
            <p className="mt-4 text-muted">
              After this: {preset.steps[idx + 1]?.emoji}{" "}
              {preset.steps[idx + 1]?.label}
            </p>
          )}
          <button
            type="button"
            onClick={advance}
            className="grad-primary mt-10 w-full rounded-2xl px-6 py-5 text-xl font-semibold shadow-soft"
          >
            Done! Next →
          </button>
        </div>
      )}

      {done && (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-16 text-center animate-fade-in">
          <div className="text-[5rem]">🎉</div>
          <h1 className="mt-4 font-display text-3xl font-semibold text-text">
            You did the whole {preset?.title.toLowerCase()}!
          </h1>
          <p className="mt-3 text-muted">
            Every single step. That&apos;s huge.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="routine-cta grad-primary mt-8 w-full rounded-2xl px-6 py-4 text-lg font-semibold shadow-soft"
          >
            All done
          </button>
        </div>
      )}
    </div>
  );
}
