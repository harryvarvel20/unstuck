"use client";

import { useState } from "react";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";
import type { AgeBand } from "@/lib/parents";

/**
 * Shared full-screen result surface for the AI coach flows (game plan +
 * reframe). Calls /api/parents/coach, shows a bounded, structured answer that
 * ends in ONE concrete step. Any child-safety concern routes to the signpost
 * instead of a plan.
 */

interface PlanResult {
  message?: string;
  steps?: { title: string; why?: string }[];
  firstStep?: string;
}
interface ReframeResult {
  reframe?: string;
  struggling?: string;
  tryThis?: string;
}

export function CoachResult({
  kind,
  situationLabel,
  ageBand,
  onClose,
  analyticsEvent,
}: {
  kind: "plan" | "reframe";
  situationLabel: string;
  ageBand: AgeBand;
  onClose: () => void;
  analyticsEvent?: string;
}) {
  const [detail, setDetail] = useState("");
  const [stage, setStage] = useState<"input" | "loading" | "done" | "safety">(
    kind === "reframe" ? "input" : "input",
  );
  const [result, setResult] = useState<PlanResult & ReframeResult>({});
  const [safety, setSafety] = useState("");
  const [error, setError] = useState(false);

  useEscape(onClose);

  async function run() {
    setStage("loading");
    setError(false);
    try {
      const res = await fetch("/api/parents/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          ageBand,
          text: kind === "plan" ? situationLabel : detail,
          detail: kind === "plan" ? detail : "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.childSafety) {
        capture("child_safety_routed", { surface: "coach" });
        setSafety(body.message as string);
        setStage("safety");
        return;
      }
      if (res.ok && body.result) {
        setResult(body.result as PlanResult & ReframeResult);
        if (analyticsEvent) capture(analyticsEvent, { ageBand });
        setStage("done");
      } else {
        setError(true);
        setStage("input");
      }
    } catch {
      setError(true);
      setStage("input");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={situationLabel}
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
          {stage === "safety" && (
            <div className="animate-fade-in">
              <div className="text-2xl">💛</div>
              <p className="mt-3 text-[1.05rem] leading-relaxed text-text">
                {safety}
              </p>
            </div>
          )}

          {kind === "reframe" && stage === "input" && (
            <div>
              <h2 className="font-display text-2xl font-semibold text-text">
                What&apos;s the behaviour?
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                Describe what&apos;s frustrating you. We&apos;ll look at it
                through “kids do well if they can” — what might be getting in
                their way.
              </p>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value.slice(0, 1000))}
                rows={4}
                autoFocus
                placeholder="e.g. he refuses to get off the tablet and it ends in a screaming match"
                className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="button"
                onClick={() => detail.trim() && void run()}
                disabled={!detail.trim()}
                className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
              >
                Help me see it differently
              </button>
            </div>
          )}

          {kind === "plan" && stage === "input" && !error && (
            <div>
              <h2 className="font-display text-2xl font-semibold text-text">
                {situationLabel}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                Anything specific about today? <span>(optional)</span>
              </p>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value.slice(0, 1000))}
                rows={3}
                className="mt-3 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="e.g. we're always late and it turns into shouting"
              />
              <button
                type="button"
                onClick={() => void run()}
                className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
              >
                Get a game plan
              </button>
            </div>
          )}

          {stage === "loading" && (
            <p className="mt-10 text-center text-muted">
              Thinking it through, calmly…
            </p>
          )}

          {error && (
            <p className="mt-4 text-sm text-accent" role="alert">
              Couldn&apos;t do that just now — try again in a moment.
            </p>
          )}

          {stage === "done" && kind === "plan" && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-semibold text-text">
                {situationLabel}
              </h2>
              {result.message && (
                <p className="mt-3 leading-relaxed text-muted">
                  {result.message}
                </p>
              )}
              <ol className="mt-5 flex flex-col gap-3">
                {(result.steps ?? []).map((s, i) => (
                  <li
                    key={i}
                    className="rounded-2xl border border-border bg-surface p-4"
                  >
                    <p className="font-medium text-text">
                      {i + 1}. {s.title}
                    </p>
                    {s.why && (
                      <p className="mt-1 text-sm text-muted">{s.why}</p>
                    )}
                  </li>
                ))}
              </ol>
              {result.firstStep && (
                <div className="mt-5 rounded-2xl bg-accent-soft/60 p-4">
                  <p className="text-sm font-semibold text-accent">
                    Try this in the next 5 minutes
                  </p>
                  <p className="mt-1 text-text">{result.firstStep}</p>
                </div>
              )}
            </div>
          )}

          {stage === "done" && kind === "reframe" && (
            <div className="animate-fade-in">
              <p className="text-[1.05rem] leading-relaxed text-text">
                {result.reframe}
              </p>
              {result.struggling && (
                <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    What might be going on
                  </p>
                  <p className="mt-1 text-text">{result.struggling}</p>
                </div>
              )}
              {result.tryThis && (
                <div className="mt-4 rounded-2xl bg-accent-soft/60 p-4">
                  <p className="text-sm font-semibold text-accent">
                    One thing to try
                  </p>
                  <p className="mt-1 text-text">{result.tryThis}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="pb-2 pt-6 text-center text-xs text-muted/70">
          ADHV Parents is a self-management and skills tool — not therapy,
          diagnosis, or medical advice.
        </p>
      </div>
    </div>
  );
}
