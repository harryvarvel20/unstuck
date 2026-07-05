"use client";

import { useMemo, useState } from "react";
import { FLASHPOINTS, type Flashpoint } from "@/lib/parentsContent";
import { capture } from "@/lib/analytics";
import type { Child } from "@/lib/parents";
import { CoachResult } from "./CoachResult";
import { CoachView } from "./CoachView";
import { WithChildView } from "./WithChildView";
import { JustForYouView } from "./JustForYouView";
import { SchoolView } from "./SchoolView";
import { MeltdownMode } from "./MeltdownMode";
import { CpsFlow } from "./CpsFlow";

/**
 * Parents Home (W2) — situation-first. "What's hard right now?" leads to a
 * concrete, age-tailored game plan; everything else lives one layer down in
 * grouped areas (Coach / With your child / Just for you / School). Never a
 * search bar, never a feature buffet.
 */

type Area = "hub" | "coach" | "child" | "you" | "school";

export function ParentsHub({ child }: { child: Child }) {
  const [area, setArea] = useState<Area>("hub");
  const [plan, setPlan] = useState<{
    kind: "plan" | "reframe";
    label: string;
  } | null>(null);
  const [overlay, setOverlay] = useState<"meltdown" | "cps" | null>(null);

  const flashpoints = useMemo(
    () => FLASHPOINTS.filter((f) => f.bands.includes(child.ageBand)),
    [child.ageBand],
  );

  function pick(f: Flashpoint) {
    if (f.action === "plan") {
      capture("situation_plan_opened", {
        situation: f.id,
        ageBand: child.ageBand,
      });
      setPlan({ kind: "plan", label: f.label });
    } else if (f.action === "reframe") {
      setPlan({ kind: "reframe", label: "A specific behaviour" });
    } else if (f.action === "meltdown") {
      setOverlay("meltdown");
    } else if (f.action === "parent") {
      setArea("you");
    } else if (f.action === "school") {
      setArea("school");
    }
  }

  const AREAS: { key: Area; emoji: string; title: string; body: string }[] = [
    {
      key: "coach",
      emoji: "🧭",
      title: "Coach",
      body: "Bite-size skills + reframes",
    },
    {
      key: "child",
      emoji: "🧒",
      title: "With your child",
      body: "Shared-screen kid tools",
    },
    {
      key: "you",
      emoji: "🫖",
      title: "Just for you",
      body: "Reset & anti-burnout",
    },
    { key: "school", emoji: "🏫", title: "School", body: "Support & messages" },
  ];

  if (area !== "hub") {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setArea("hub")}
          className="text-sm text-muted transition-colors hover:text-text"
        >
          ← back
        </button>
        <div className="mt-3">
          {area === "coach" && <CoachView child={child} />}
          {area === "child" && <WithChildView child={child} />}
          {area === "you" && <JustForYouView />}
          {area === "school" && <SchoolView />}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Situation-first */}
      <div className="glass rounded-3xl p-6 shadow-soft">
        <h2 className="font-display text-xl font-semibold text-text">
          What&apos;s hard right now?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Tap it. You&apos;ll get one concrete thing to try — sized for{" "}
          {child.name || "your child"}.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {flashpoints.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => pick(f)}
              className={`rounded-2xl border p-3.5 text-center transition-transform active:scale-[0.97] ${
                f.action === "meltdown"
                  ? "border-accent/50 bg-accent-soft/50"
                  : "border-border bg-surface hover:border-accent/40"
              }`}
            >
              <div className="text-2xl">{f.emoji}</div>
              <p className="mt-1.5 text-sm font-medium text-text">{f.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* One gentle contextual card */}
      {child.hardest && (
        <button
          type="button"
          onClick={() => {
            capture("situation_plan_opened", { situation: "hardest" });
            setPlan({ kind: "plan", label: child.hardest as string });
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4 text-left transition-colors hover:bg-accent-soft"
        >
          <span className="text-xl">💡</span>
          <span className="text-sm text-text">
            You said <span className="font-medium">“{child.hardest}”</span> is
            hard — want a plan for that?
          </span>
        </button>
      )}

      {/* Grouped areas — one layer down */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {AREAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setArea(a.key)}
            className="glass rounded-2xl p-4 text-left shadow-soft transition-transform active:scale-[0.98]"
          >
            <div className="text-2xl">{a.emoji}</div>
            <p className="mt-2 font-semibold text-text">{a.title}</p>
            <p className="mt-0.5 text-xs text-muted">{a.body}</p>
          </button>
        ))}
      </div>

      {/* Overlays */}
      {plan && (
        <CoachResult
          kind={plan.kind}
          situationLabel={plan.label}
          ageBand={child.ageBand}
          analyticsEvent={plan.kind === "reframe" ? "reframe_used" : undefined}
          onClose={() => setPlan(null)}
        />
      )}
      {overlay === "meltdown" && (
        <MeltdownMode
          onClose={() => setOverlay(null)}
          onProblemSolve={() => setOverlay("cps")}
        />
      )}
      {overlay === "cps" && (
        <CpsFlow ageBand={child.ageBand} onClose={() => setOverlay(null)} />
      )}
    </div>
  );
}
