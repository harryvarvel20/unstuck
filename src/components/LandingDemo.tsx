"use client";

import { useState } from "react";
import Link from "next/link";
import { streamBreakdown, LimitReachedError } from "@/lib/streamClient";
import type { BreakdownStep } from "@/lib/types";
import { MAX_INPUT_CHARS } from "@/lib/constants";

type Status = "idle" | "loading" | "done" | "crisis" | "error" | "limit";

/** The landing hero's live demo — first breakdown free, no email wall. */
export function LandingDemo() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [steps, setSteps] = useState<BreakdownStep[]>([]);
  const [crisisMsg, setCrisisMsg] = useState<string | null>(null);

  async function run() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setStatus("loading");
    setSteps([]);
    setCrisisMsg(null);
    try {
      const final = await streamBreakdown({
        input: trimmed,
        mode: "normal",
        onUpdate: (p) => {
          if (p.crisis) {
            setCrisisMsg(p.crisisMessage);
            setStatus("crisis");
          } else {
            setSteps(p.steps);
          }
        },
      });
      setStatus(final.crisis ? "crisis" : "done");
    } catch (err) {
      if (err instanceof LimitReachedError) setStatus("limit");
      else setStatus("error");
    }
  }

  return (
    <div className="glass rounded-3xl p-5 shadow-float sm:p-6">
      <label htmlFor="demo" className="sr-only">
        What are you avoiding?
      </label>
      <textarea
        id="demo"
        value={input}
        onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_CHARS))}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void run();
        }}
        placeholder="What are you avoiding? e.g. reply to that email I've been dreading"
        rows={2}
        className="w-full resize-none rounded-2xl border border-border bg-bg px-4 py-3 text-[1.05rem] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <button
        type="button"
        onClick={() => void run()}
        disabled={!input.trim() || status === "loading"}
        className="grad-primary mt-3 w-full rounded-2xl px-5 py-3.5 text-[1.05rem] font-semibold shadow-soft transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "loading" ? "Working on it…" : "Make it doable — free"}
      </button>

      {status === "crisis" && (
        <div
          className="mt-4 rounded-2xl border border-accent/40 bg-accent-soft/60 p-4"
          role="status"
        >
          <p className="text-text">
            {crisisMsg ??
              "It sounds heavy right now. Please reach out to someone you trust, or call Samaritans free any time on 116 123."}
          </p>
        </div>
      )}

      {status === "error" && (
        <p className="mt-4 text-sm text-muted">
          Something hiccupped — try again in a moment.
        </p>
      )}

      {status === "limit" && (
        <p className="mt-4 text-sm text-muted">
          That&apos;s the free demo used up for today.{" "}
          <Link href="/login" className="text-accent hover:underline">
            Make a free account
          </Link>{" "}
          for more.
        </p>
      )}

      {steps.length > 0 && status !== "crisis" && (
        <div className="mt-4">
          <ul className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-border bg-bg p-3.5 animate-card-in"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    i === 0
                      ? "bg-accent text-accent-ink"
                      : "border border-border text-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-text">{s.title}</p>
                  <p className="text-xs text-muted">{s.minutes} min</p>
                </div>
              </li>
            ))}
          </ul>
          {status === "done" && (
            <div className="mt-4 rounded-2xl bg-accent-soft/60 p-4 text-center">
              <p className="text-sm text-text">
                That&apos;s the idea. Do the first one with an AI body double,
                save your progress, and more —
              </p>
              <Link
                href="/app"
                className="mt-3 inline-block rounded-2xl bg-accent px-5 py-2.5 font-semibold text-accent-ink transition-colors hover:brightness-105"
              >
                Open the full app
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
