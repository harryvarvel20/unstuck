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
import { ShareParentWin } from "../parents/ShareParentWin";
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
  /** Tool title just closed — offers a share, does not force one. */
  const [justUsed, setJustUsed] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
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

  /** Close the open tool and remember which it was, so a share can be offered. */
  function closeTool() {
    const t = tiles.find((x) => x.key === tool);
    setTool(null);
    setJustUsed(t?.title ?? null);
  }

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

      {/*
        Offered AFTER a tool closes, never during — the child may still be
        beside them, and this is a conversation between adults. A dismissible
        card rather than an automatic modal: a parent who just got through a
        hard bedtime should not have to fight a dialog to put the phone down.
      */}
      {justUsed && !tool && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
          <span className="text-xl" aria-hidden="true">
            💛
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text">
              Did <span className="font-medium">{justUsed}</span> help? Other
              parents would love to know.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => setSharing(justUsed)}
                className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.98]"
              >
                Share it
              </button>
              <button
                type="button"
                onClick={() => setJustUsed(null)}
                className="rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:text-text"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {tool === "routine" && (
        <VisualRoutine ageBand={child.ageBand} onClose={closeTool} />
      )}
      {tool === "reward" && <RewardChart child={child} onClose={closeTool} />}
      {tool === "firstthen" && <FirstThen onClose={closeTool} />}
      {tool === "emotion" && (
        <EmotionCheck
          ageBand={child.ageBand}
          onCalmCorner={() => setTool("calm")}
          onClose={closeTool}
        />
      )}
      {tool === "calm" && <CoolDown onClose={closeTool} />}
      {tool === "boost" && <BoostMenu onClose={closeTool} />}
      {tool === "homework" && (
        <HomeworkHelper ageBand={child.ageBand} onClose={closeTool} />
      )}

      {sharing && (
        <ShareParentWin
          tool={sharing}
          onClose={() => {
            setSharing(null);
            setJustUsed(null);
          }}
        />
      )}
    </div>
  );
}
