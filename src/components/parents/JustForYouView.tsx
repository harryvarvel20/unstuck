"use client";

import { useState } from "react";
import { CoolDown } from "../regulate/CoolDown";
import { Decompress } from "../regulate/Decompress";
import { capture } from "@/lib/analytics";

/**
 * Just for you (W7) — parent regulation & anti-burnout, pointed at the PARENT.
 * Reuses ADHV's own cool-down (SOS) and Big Feelings Decompress. Names the
 * real experience without shame; ends in one grounding/self-care step.
 */
export function JustForYouView() {
  const [tool, setTool] = useState<"sos" | "decompress" | null>(null);

  return (
    <div className="animate-page-in">
      <h2 className="font-display text-xl font-semibold text-text">
        Just for you
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        You can&apos;t pour from empty. A hard day doesn&apos;t erase you as a
        parent.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setTool("sos");
            capture("parent_sos_used");
          }}
          className="glass rounded-2xl p-5 text-left shadow-soft transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🆘</span>
            <div>
              <p className="font-semibold text-text">I&apos;m in the red</p>
              <p className="mt-0.5 text-sm text-muted">
                About to snap, walking on eggshells? A 90-second reset.
                It&apos;s okay to say “I need two minutes” — and mean it.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTool("decompress")}
          className="glass rounded-2xl p-5 text-left shadow-soft transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🫂</span>
            <div>
              <p className="font-semibold text-text">Bad-day decompress</p>
              <p className="mt-0.5 text-sm text-muted">
                Let it out, get it reflected back, land on one tiny thing for
                yourself.
              </p>
            </div>
          </div>
        </button>
      </div>

      <p className="mt-4 text-xs text-muted/80">
        If it&apos;s been a lot for a while, that matters too — please reach out
        to your own people or a professional. Not therapy or medical advice.
      </p>

      {tool === "sos" && <CoolDown onClose={() => setTool(null)} />}
      {tool === "decompress" && <Decompress onClose={() => setTool(null)} />}
    </div>
  );
}
