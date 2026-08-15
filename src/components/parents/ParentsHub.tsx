"use client";

import { useEffect, useMemo, useState } from "react";
import { FLASHPOINTS, type Flashpoint } from "@/lib/parentsContent";
import { capture } from "@/lib/analytics";
import type { Child } from "@/lib/parents";
import { CoachResult } from "./CoachResult";
import { CoachView } from "./CoachView";
import { WithChildView } from "./WithChildView";
import { JustForYouView } from "./JustForYouView";
import { SchoolView } from "./SchoolView";
import { PositivityView } from "./PositivityView";
import { MeltdownMode } from "./MeltdownMode";
import { CpsFlow } from "./CpsFlow";

/**
 * Parents Home — situation-first. "What's hard right now?" leads to a
 * concrete, age-tailored game plan; everything else lives one layer down.
 * Never a search bar, never a feature buffet.
 *
 * The five areas are grouped under three headings that answer **when** a
 * parent would use them — "Do it together", "Get better at this", "Look after
 * you" — rather than sitting in one flat grid of equally-weighted cards. Every
 * feature is still here; only the signposting changed. A parent reaching for
 * this at 7am on a school morning is in a very different state from one
 * reading it on a quiet evening, and the layout should say which is which.
 */

type Area = "hub" | "coach" | "child" | "you" | "school" | "praise";

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

  useEffect(() => {
    capture("parents_home_viewed", { ageBand: child.ageBand });
  }, [child.ageBand]);

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

  /**
   * Areas grouped by **when a parent would reach for them**, not by what they
   * contain.
   *
   * Previously these were five identical cards in a flat grid, described in
   * product language ("Bite-size skills + reframes", "Shared-screen kid
   * tools"). Everything looked equally urgent and nothing said when to use it,
   * so a tired parent had to read all five and guess. Nothing has been removed
   * — the same five areas, sorted into the three moments a parent is actually
   * in, with plain-language descriptions and a peek at what is inside so the
   * card is not a mystery box.
   */
  const GROUPS: {
    heading: string;
    hint: string;
    areas: {
      key: Area;
      emoji: string;
      title: string;
      body: string;
      peek: string;
    }[];
  }[] = [
    {
      heading: "Do it together",
      hint: "Open on the sofa, beside them",
      areas: [
        {
          key: "child",
          emoji: "🧒",
          title: "With your child",
          body: "Big, calm screens you guide them through.",
          peek: "Routines · Feelings · Calm corner · Homework +3",
        },
        {
          key: "praise",
          emoji: "💛",
          title: "Notice the good",
          body: "Catch them being brilliant — and keep the receipts.",
          peek: "Praise coach · Wins log",
        },
      ],
    },
    {
      heading: "Get better at this",
      hint: "For a quiet ten minutes",
      areas: [
        {
          key: "coach",
          emoji: "🧭",
          title: "Coach",
          body: "Short, practical skills that work with an ADHD brain.",
          peek: "Strategies · Reframes",
        },
        {
          key: "school",
          emoji: "🏫",
          title: "School",
          body: "Getting support, and messages that actually land.",
          peek: "Your rights · Email templates",
        },
      ],
    },
    {
      heading: "Look after you",
      hint: "You count too",
      areas: [
        {
          key: "you",
          emoji: "🫖",
          title: "Just for you",
          body: "Two minutes to put yourself back together.",
          peek: "Reset · Anti-burnout",
        },
      ],
    },
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
          {area === "praise" && <PositivityView child={child} />}
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

      {/* Everything else, grouped by when you'd reach for it. */}
      {GROUPS.map((g) => (
        <section key={g.heading} className="mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-base font-semibold text-text">
              {g.heading}
            </h3>
            <span className="eyebrow">{g.hint}</span>
          </div>
          <div className="rule-ornament mt-2" aria-hidden="true">
            <span />
          </div>

          <div className="mt-2.5 flex flex-col gap-2.5">
            {g.areas.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setArea(a.key)}
                className="glass flex w-full items-start gap-3.5 rounded-2xl p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {a.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-text">
                    {a.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {a.body}
                  </span>
                  {/* What's actually inside — so the card isn't a mystery. */}
                  <span className="mt-1.5 block truncate text-xs text-muted/75">
                    {a.peek}
                  </span>
                </span>
                <span className="mt-1 text-muted/60" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

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
