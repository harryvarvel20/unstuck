"use client";

import { useState } from "react";
import { useEscape } from "@/lib/hooks";
import { EMOTION_LEVELS } from "@/lib/parentsContent";
import type { AgeBand } from "@/lib/parents";

/**
 * Feelings thermometer (W4, kid-facing). Big tap-to-pick scale (Zones-style),
 * name-it-to-tame-it, then a co-regulation suggestion sized to the level.
 * Tap-only — no free text, so nothing needs capturing or screening. A red
 * level offers the Calm Corner.
 */
export function EmotionCheck({
  ageBand,
  onCalmCorner,
  onClose,
}: {
  ageBand: AgeBand;
  onCalmCorner: () => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  useEscape(onClose);
  const young = ageBand === "4-7";
  const level = EMOTION_LEVELS.find((l) => l.id === picked) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="How are you feeling?"
    >
      <button
        type="button"
        onClick={onClose}
        className="m-4 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted"
      >
        ✕ close
      </button>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-text">
          How are you feeling?
        </h1>
        <p className="mt-2 text-muted">Tap the one that fits right now.</p>

        <div className="mt-6 flex flex-col gap-3">
          {EMOTION_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                setPicked(l.id);
              }}
              aria-pressed={picked === l.id}
              className="flex items-center gap-4 rounded-3xl border-2 p-4 text-left transition-transform active:scale-[0.98]"
              style={{
                borderColor: picked === l.id ? l.color : "rgb(var(--border))",
                background:
                  picked === l.id ? `${l.color}22` : "rgb(var(--surface))",
              }}
            >
              <span className="text-4xl">{l.emoji}</span>
              <span
                className="h-10 w-2.5 rounded-full"
                style={{ background: l.color }}
                aria-hidden
              />
              <span className="text-xl font-semibold text-text">
                {young ? l.wordYoung : l.wordOlder}
              </span>
            </button>
          ))}
        </div>

        {level && (
          <div className="mt-6 rounded-3xl border border-border bg-surface p-5 text-left animate-fade-in">
            <p className="text-lg font-semibold text-text">
              {level.emoji} {young ? level.wordYoung : level.wordOlder}
            </p>
            <p className="mt-2 text-muted">{level.coreg}</p>
            {level.id === "red" || level.id === "yellow" ? (
              <button
                type="button"
                onClick={onCalmCorner}
                className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
              >
                Go to the Calm Corner
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
