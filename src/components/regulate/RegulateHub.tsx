"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CoolDown } from "./CoolDown";
import { Decompress } from "./Decompress";
import { SpiralDefuser } from "./SpiralDefuser";
import { capture } from "@/lib/analytics";

type Tool = "cooldown" | "decompress" | "spiral" | null;

interface RegulateHubProps {
  isPro: boolean;
  /** Preselect a tool (e.g. from the header calm icon: ?tool=cooldown). */
  initial?: Tool;
}

const TOOLS: {
  key: Exclude<Tool, null>;
  emoji: string;
  title: string;
  body: string;
  pro: boolean;
}[] = [
  {
    key: "cooldown",
    emoji: "🌬️",
    title: "Cool-down",
    body: "A 90-second reset for a stress spike — breathe, ground, name it. Free, always.",
    pro: false,
  },
  {
    key: "decompress",
    emoji: "🫂",
    title: "Big feelings",
    body: "When it hits hard: let it out, get it reflected back, land on one small move.",
    pro: true,
  },
  {
    key: "spiral",
    emoji: "🌀",
    title: "Message spiral",
    body: "That text that stung. Check the story your brain built before you reply.",
    pro: true,
  },
];

export function RegulateHub({ isPro, initial = null }: RegulateHubProps) {
  const [tool, setTool] = useState<Tool>(null);

  useEffect(() => {
    if (initial) {
      // Cool-down is free; the AI tools need Pro.
      if (initial === "cooldown" || isPro) setTool(initial);
    }
  }, [initial, isPro]);

  function open(t: Exclude<Tool, null>, pro: boolean) {
    if (pro && !isPro) return;
    capture("regulate_opened", { tool: t });
    setTool(t);
  }

  if (tool === "cooldown") return <CoolDown onClose={() => setTool(null)} />;
  if (tool === "decompress")
    return <Decompress onClose={() => setTool(null)} />;
  if (tool === "spiral") return <SpiralDefuser onClose={() => setTool(null)} />;

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3">
      {TOOLS.map((t) => {
        const locked = t.pro && !isPro;
        return (
          <div key={t.key} className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{t.emoji}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-text">
                  {t.title}
                  {locked && (
                    <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                      Pro
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-sm text-muted">{t.body}</p>
                {locked ? (
                  <Link
                    href="/pricing"
                    className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
                  >
                    Unlock with Pro →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => open(t.key, t.pro)}
                    className="mt-3 rounded-full border border-accent/50 bg-surface px-4 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft"
                  >
                    Open
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
