"use client";

import { useState } from "react";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";
import type { AgeBand } from "@/lib/parents";

/**
 * Collaborative Problem-Solving (W5) — Ross Greene's Plan B, as a guided,
 * bounded 3-step conversation the parent runs WITH the child during a CALM
 * time: Empathy → Define the adult concern → Invitation to solve together.
 * AI offers age-appropriate example phrasings per step; the flow ends with
 * the tiny agreed experiment. Never coercive, never child-as-adversary.
 */

const STEPS = [
  {
    n: 1,
    title: "Empathy first",
    lead: "Understand their side. Stay curious, not fixing.",
    hint: "What's the concern behind the behaviour, in their words?",
  },
  {
    n: 2,
    title: "Your concern",
    lead: "Share your worry — briefly, without blame.",
    hint: "Name the impact, not a verdict on them.",
  },
  {
    n: 3,
    title: "Invitation",
    lead: "Brainstorm a solution together that works for both.",
    hint: "Let them go first. Aim for a tiny experiment to try.",
  },
] as const;

export function CpsFlow({
  ageBand,
  onClose,
}: {
  ageBand: AgeBand;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [concern, setConcern] = useState("");
  const [started, setStarted] = useState(false);
  const [openers, setOpeners] = useState<string[]>([]);
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(false);
  const [safety, setSafety] = useState("");
  const [agreed, setAgreed] = useState("");
  const [finished, setFinished] = useState(false);
  useEscape(onClose);

  async function loadStep(n: number, concernText: string) {
    setLoading(true);
    setOpeners([]);
    try {
      const res = await fetch("/api/parents/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "cps",
          ageBand,
          step: n,
          text: concernText,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.childSafety) {
        capture("child_safety_routed", { surface: "cps" });
        setSafety(body.message as string);
        return;
      }
      const r = body.result as { openers?: string[]; tip?: string };
      setOpeners(r?.openers ?? []);
      setTip(r?.tip ?? "");
    } finally {
      setLoading(false);
    }
  }

  async function begin() {
    if (!concern.trim()) return;
    setStarted(true);
    await loadStep(1, concern);
  }

  async function next() {
    if (step < 2) {
      const n = step + 1;
      setStep(n);
      await loadStep(STEPS[n]!.n, concern);
    } else {
      capture("cps_flow_completed", { ageBand });
      setFinished(true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Problem-solving together"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          className="self-start text-sm text-muted transition-colors hover:text-text"
        >
          ✕ close
        </button>

        <div className="flex-1 pt-5">
          {safety ? (
            <div className="animate-fade-in">
              <div className="text-2xl">💛</div>
              <p className="mt-3 leading-relaxed text-text">{safety}</p>
            </div>
          ) : !started ? (
            <div>
              <h1 className="font-display text-2xl font-semibold text-text">
                Problem-solving together
              </h1>
              <p className="mt-2 text-muted">
                A calm 3-step chat to have <em>with</em> your child — not
                mid-meltdown, but at a good moment. You&apos;ll work out a fix
                together. What&apos;s the recurring problem?
              </p>
              <textarea
                value={concern}
                onChange={(e) => setConcern(e.target.value.slice(0, 500))}
                rows={3}
                autoFocus
                placeholder="e.g. getting off screens for dinner turns into a fight every night"
                className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="button"
                onClick={() => void begin()}
                disabled={!concern.trim()}
                className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
              >
                Start step 1
              </button>
            </div>
          ) : finished ? (
            <div className="animate-fade-in">
              <div className="text-3xl">🤝</div>
              <h1 className="mt-3 font-display text-2xl font-semibold text-text">
                Your tiny experiment
              </h1>
              <p className="mt-2 text-muted">
                Write down what you both agreed to try. Small and specific beats
                perfect.
              </p>
              <textarea
                value={agreed}
                onChange={(e) => setAgreed(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="e.g. a 5-minute warning + they pick the “last thing” before dinner"
                className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
              >
                We&apos;ll try it
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <p className="text-sm font-medium uppercase tracking-widest text-muted">
                Step {STEPS[step]!.n} of 3
              </p>
              <h1 className="mt-2 font-display text-2xl font-semibold text-text">
                {STEPS[step]!.title}
              </h1>
              <p className="mt-2 text-muted">{STEPS[step]!.lead}</p>

              <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Try saying
                </p>
                {loading ? (
                  <p className="mt-2 text-muted">Finding the words…</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {openers.map((o, i) => (
                      <li key={i} className="text-text">
                        “{o}”
                      </li>
                    ))}
                  </ul>
                )}
                {tip && <p className="mt-3 text-sm text-accent">{tip}</p>}
              </div>

              <button
                type="button"
                onClick={() => void next()}
                disabled={loading}
                className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
              >
                {step < 2 ? "Next step" : "We found something to try"}
              </button>
            </div>
          )}
        </div>

        <p className="pb-2 pt-6 text-center text-xs text-muted/70">
          ADHV Parents is a skills tool — not therapy, diagnosis, or medical
          advice.
        </p>
      </div>
    </div>
  );
}
