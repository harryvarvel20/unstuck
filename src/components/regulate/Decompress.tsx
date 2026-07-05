"use client";

import { useState } from "react";
import { streamPost, ProRequiredError } from "@/lib/streamClient";
import { parseStreamingMessage } from "@/lib/parseBreakdown";
import { capture } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

/**
 * Big Feelings Decompress — a STRUCTURED 4-step flow, not open chat.
 * dump → reflect (AI, warm, normalises without amplifying) → choose ONE of
 * three moves → close with one tiny action. The session ends. No back-and-forth.
 */

type Stage = "dump" | "reflect" | "choose" | "close" | "crisis";

export function Decompress({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("dump");
  const [text, setText] = useState("");
  const [reflection, setReflection] = useState("");
  const [closing, setClosing] = useState("");
  const [crisisMsg, setCrisisMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscape(onClose);

  async function stream(action: "reflect" | "reframe" | "repair") {
    setBusy(true);
    setError(null);
    let got = "";
    try {
      await streamPost(
        "/api/regulate/decompress",
        { text, action },
        (buffer) => {
          const m = parseStreamingMessage(buffer);
          if (m.crisis) {
            setCrisisMsg(m.message);
            setStage("crisis");
            return;
          }
          got = m.message;
          if (action === "reflect") setReflection(m.message);
          else setClosing(m.message);
        },
      );
      return got;
    } catch (err) {
      if (err instanceof ProRequiredError) setError("This is a Pro tool.");
      else setError("Couldn't do that just now — try again in a moment.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function begin() {
    if (!text.trim()) return;
    capture("decompress_started");
    setStage("reflect");
    await stream("reflect");
  }

  async function choose(kind: "reframe" | "repair" | "park") {
    if (kind === "park") {
      void fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "parked", content: text }),
      }).catch(() => {});
      setClosing(
        "It's parked in your journal — out of your head, safe to revisit or not.",
      );
      capture("decompress_closed", { move: "park" });
      setStage("close");
      return;
    }
    capture("decompress_closed", { move: kind });
    setStage("close");
    await stream(kind);
  }

  if (stage === "crisis") {
    return (
      <Shell onClose={onClose}>
        <div className="text-2xl">💛</div>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-text">
          {crisisMsg ||
            "It sounds like you're carrying something really heavy. You don't have to hold it alone — please reach out to someone you trust, or call Samaritans free any time on 116 123."}
        </p>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose}>
      {stage === "dump" && (
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">
            Let it out.
          </h1>
          <p className="mt-2 text-muted">
            What happened? Type it however it comes — no judgement, no tidying.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 4000))}
            rows={7}
            autoFocus
            className="mt-5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Everything. As messy as it feels."
          />
          <button
            type="button"
            onClick={() => void begin()}
            disabled={!text.trim()}
            className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
          >
            I&apos;m done — read it back
          </button>
        </div>
      )}

      {stage === "reflect" && (
        <div>
          {reflection ? (
            <p className="text-[1.05rem] leading-relaxed text-text animate-fade-in">
              {reflection}
            </p>
          ) : (
            <p className="text-muted">Reading it…</p>
          )}
          {reflection && !busy && (
            <div className="mt-8 animate-fade-in">
              <p className="text-sm font-medium text-muted">
                Where do you want to leave this?
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                <Choice onClick={() => void choose("reframe")}>
                  Help me see it a kinder way
                </Choice>
                <Choice onClick={() => void choose("park")}>
                  Park it in the journal
                </Choice>
                <Choice onClick={() => void choose("repair")}>
                  Plan one tiny repair action
                </Choice>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === "close" && (
        <div className="animate-fade-in">
          {busy && !closing ? (
            <p className="text-muted">One moment…</p>
          ) : (
            <>
              <p className="text-[1.05rem] leading-relaxed text-text">
                {closing}
              </p>
              <p className="mt-6 text-sm text-muted">
                That&apos;s the flow done. Feelings handled — you can step away.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-2xl border border-border bg-surface px-5 py-3.5 font-medium text-text"
              >
                Close
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </Shell>
  );
}

function Shell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Decompress"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          className="self-start text-sm text-muted transition-colors hover:text-text"
        >
          ✕ close
        </button>
        <div className="flex-1 pt-6">{children}</div>
        <p className="pb-2 text-center text-xs text-muted/70">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </div>
    </div>
  );
}

function Choice({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-surface px-5 py-3.5 text-left font-medium text-text transition-colors hover:border-accent/50"
    >
      {children}
    </button>
  );
}
