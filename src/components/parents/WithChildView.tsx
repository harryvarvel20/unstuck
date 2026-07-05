"use client";

import { useState } from "react";
import type { Child } from "@/lib/parents";
import { VisualRoutine } from "./kid/VisualRoutine";
import { RewardChart } from "./kid/RewardChart";
import { FirstThen } from "./kid/FirstThen";
import { EmotionCheck } from "./kid/EmotionCheck";
import { BoostMenu } from "./kid/BoostMenu";
import { HomeworkHelper } from "./kid/HomeworkHelper";
import { CoolDown } from "../regulate/CoolDown";
import { capture } from "@/lib/analytics";

type Tool =
  | "routine"
  | "reward"
  | "firstthen"
  | "emotion"
  | "calm"
  | "boost"
  | "homework"
  | null;

/**
 * "With your child" (W4) — the shared-screen kid tools. Each opens full-screen.
 * Age-adaptive where it matters; the Calm Corner reuses ADHV's cool-down.
 * First–Then is most relevant for younger children.
 */
export function WithChildView({ child }: { child: Child }) {
  const [tool, setTool] = useState<Tool>(null);
  const young = child.ageBand === "4-7";

  const tiles: {
    key: Tool;
    emoji: string;
    title: string;
    body: string;
    show: boolean;
  }[] = [
    {
      key: "routine",
      emoji: "🗓️",
      title: "Visual routine",
      body: "Run the day one step at a time.",
      show: true,
    },
    {
      key: "reward",
      emoji: "⭐",
      title: "Reward chart",
      body:
        child.ageBand === "13-17"
          ? "Self-tracking they own."
          : "Earn tokens for goals you chose together.",
      show: true,
    },
    {
      key: "firstthen",
      emoji: "➡️",
      title: "First–Then",
      body: "First this, then the good thing.",
      show: young || child.ageBand === "8-12",
    },
    {
      key: "emotion",
      emoji: "🌡️",
      title: "Feelings check",
      body: "Name it to tame it, then co-regulate.",
      show: true,
    },
    {
      key: "calm",
      emoji: "🫧",
      title: "Calm Corner",
      body: "A calm space — never a time-out.",
      show: true,
    },
    {
      key: "boost",
      emoji: "⚡",
      title: "Boost menu",
      body: "Quick lifts for a flat or fidgety moment.",
      show: true,
    },
    {
      key: "homework",
      emoji: "📚",
      title: "Homework helper",
      body: "Shrink the dreaded task to tiny steps.",
      show: true,
    },
  ];

  return (
    <div className="animate-page-in">
      <h2 className="font-display text-xl font-semibold text-text">
        With your child
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Shared-screen tools to open beside {child.name || "your child"}. Big,
        calm, and yours to guide.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {tiles
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTool(t.key);
                if (t.key === "calm") capture("calm_corner_opened");
              }}
              className="glass rounded-2xl p-4 text-left shadow-soft transition-transform active:scale-[0.98]"
            >
              <div className="text-2xl">{t.emoji}</div>
              <p className="mt-2 font-semibold text-text">{t.title}</p>
              <p className="mt-0.5 text-xs text-muted">{t.body}</p>
            </button>
          ))}
      </div>

      {tool === "routine" && (
        <VisualRoutine ageBand={child.ageBand} onClose={() => setTool(null)} />
      )}
      {tool === "reward" && (
        <RewardChart child={child} onClose={() => setTool(null)} />
      )}
      {tool === "firstthen" && <FirstThen onClose={() => setTool(null)} />}
      {tool === "emotion" && (
        <EmotionCheck
          ageBand={child.ageBand}
          onCalmCorner={() => setTool("calm")}
          onClose={() => setTool(null)}
        />
      )}
      {tool === "calm" && <CoolDown onClose={() => setTool(null)} />}
      {tool === "boost" && <BoostMenu onClose={() => setTool(null)} />}
      {tool === "homework" && (
        <HomeworkHelper ageBand={child.ageBand} onClose={() => setTool(null)} />
      )}
    </div>
  );
}
