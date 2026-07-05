"use client";

import { useMemo, useState } from "react";
import { MICRO_LESSONS } from "@/lib/parentsContent";
import { capture } from "@/lib/analytics";
import { CoachResult } from "./CoachResult";
import type { Child } from "@/lib/parents";

/**
 * Coach (W3) — bite-size Behavioral Parent Training, surfaced ONE lesson at a
 * time (never a course wall) and age-filtered, plus the "kids do well if they
 * can" reframe tool.
 */
export function CoachView({ child }: { child: Child }) {
  const lessons = useMemo(
    () => MICRO_LESSONS.filter((l) => l.bands.includes(child.ageBand)),
    [child.ageBand],
  );
  const [i, setI] = useState(0);
  const [reframe, setReframe] = useState(false);
  const lesson = lessons[i];

  return (
    <div className="animate-page-in">
      <h2 className="font-display text-xl font-semibold text-text">Coach</h2>
      <p className="mt-1.5 text-sm text-muted">
        Small, evidence-based skills — one at a time. Built on “kids do well if
        they can.”
      </p>

      {/* Reframe tool */}
      <button
        type="button"
        onClick={() => setReframe(true)}
        className="glass mt-4 flex w-full items-center gap-3 rounded-2xl p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
      >
        <span className="text-2xl">🧠</span>
        <span>
          <span className="block font-semibold text-text">
            Reframe a behaviour
          </span>
          <span className="block text-xs text-muted">
            See a frustrating behaviour as a lagging skill, plus one thing to
            try.
          </span>
        </span>
      </button>

      {/* Micro-lesson, one at a time */}
      {lesson && (
        <div className="mt-4 glass rounded-3xl p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Micro-lesson · {i + 1} of {lessons.length}
          </p>
          <h3 className="mt-2 font-display text-xl font-semibold text-text">
            {lesson.title}
          </h3>
          <p className="mt-2 leading-relaxed text-muted">{lesson.body}</p>
          <div className="mt-4 rounded-2xl bg-accent-soft/60 p-4">
            <p className="text-sm font-semibold text-accent">Try it today</p>
            <p className="mt-1 text-text">{lesson.tryIt}</p>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setI((v) => Math.max(0, v - 1))}
              disabled={i === 0}
              className="text-sm text-muted disabled:opacity-40"
            >
              ← back
            </button>
            <button
              type="button"
              onClick={() => {
                const next = (i + 1) % lessons.length;
                setI(next);
                capture("parent_lesson_viewed", { lesson: lessons[next]?.id });
              }}
              className="rounded-full border border-accent/50 bg-surface px-4 py-1.5 text-sm font-semibold text-accent"
            >
              Another one →
            </button>
          </div>
        </div>
      )}

      {reframe && (
        <CoachResult
          kind="reframe"
          situationLabel="Reframe a behaviour"
          ageBand={child.ageBand}
          analyticsEvent="reframe_used"
          onClose={() => setReframe(false)}
        />
      )}
    </div>
  );
}
