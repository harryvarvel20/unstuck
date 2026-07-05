"use client";

import { useEffect, useRef, useState } from "react";
import { streamPost, ProRequiredError } from "@/lib/streamClient";
import {
  parseStreamingMessage,
  parseStringsArray,
  parseStringField,
} from "@/lib/parseBreakdown";
import { capture } from "@/lib/analytics";
import { useEscape } from "@/lib/hooks";

/**
 * Message Spiral Defuser (RSD). Structured sequence — never open chat, never
 * decides the other person is guilty, always ends pointing at a real calm
 * conversation. The app CANNOT send anything; the draft box is local only.
 */

type Stage = "input" | "story" | "wait" | "opener" | "crisis";

const WAIT_MS = 30 * 60 * 1000;
const APPETISERS = [
  "put one song on and actually listen to it",
  "step outside for 3 minutes",
  "make a drink, slowly",
  "10 star jumps — shake the adrenaline out",
  "wash your face with cold water",
];

const STORAGE = "adhv-spiral-wait";

export function SpiralDefuser({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [explanations, setExplanations] = useState<string[]>([]);
  const [evidence, setEvidence] = useState("");
  const [opener, setOpener] = useState("");
  const [crisisMsg, setCrisisMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [remaining, setRemaining] = useState(WAIT_MS);
  useEscape(onClose);

  const appetiser = useRef(
    APPETISERS[Math.floor(Math.random() * APPETISERS.length)],
  );

  // Resume a running wait across reloads.
  useEffect(() => {
    if (stage !== "wait") return;
    let endAt = 0;
    try {
      const stored = Number(localStorage.getItem(STORAGE));
      endAt = stored && stored > Date.now() ? stored : Date.now() + WAIT_MS;
      localStorage.setItem(STORAGE, String(endAt));
    } catch {
      endAt = Date.now() + WAIT_MS;
    }
    const tick = () => setRemaining(Math.max(0, endAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  async function analyse() {
    if (!text.trim()) return;
    capture("spiral_started");
    setBusy(true);
    setError(null);
    setStage("story");
    try {
      await streamPost("/api/regulate/spiral", { text }, (buffer) => {
        const m = parseStreamingMessage(buffer);
        if (m.crisis) {
          setCrisisMsg(m.message);
          setStage("crisis");
          return;
        }
        setExplanations(parseStringsArray(buffer, "explanations"));
        setEvidence(parseStringField(buffer, "evidence") ?? "");
        setOpener(parseStringField(buffer, "opener") ?? "");
      });
    } catch (err) {
      if (err instanceof ProRequiredError) setError("This is a Pro tool.");
      else setError("Couldn't do that just now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function startWait() {
    try {
      localStorage.setItem(STORAGE, String(Date.now() + WAIT_MS));
    } catch {
      /* noop */
    }
    setRemaining(WAIT_MS);
    setStage("wait");
  }

  function revealOpener() {
    try {
      localStorage.removeItem(STORAGE);
    } catch {
      /* noop */
    }
    if (draft.trim()) {
      void fetch("/api/journal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "draft", content: draft }),
      }).catch(() => {});
    }
    capture("spiral_defused");
    setStage("opener");
  }

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  if (stage === "crisis") {
    return (
      <Shell onClose={onClose}>
        <div className="text-2xl">💛</div>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-text">
          {crisisMsg ||
            "It sounds really heavy right now. Please reach out to someone you trust, or call Samaritans free any time on 116 123."}
        </p>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose}>
      {stage === "input" && (
        <div>
          <h1 className="font-display text-2xl font-semibold text-text">
            That message that stung.
          </h1>
          <p className="mt-2 text-muted">
            Paste it, or describe what happened. Your feelings are real —
            sometimes the story your brain builds isn&apos;t. Let&apos;s check.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 3000))}
            rows={5}
            autoFocus
            className="mt-5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="e.g. she just replied 'k.' and nothing else"
          />
          <button
            type="button"
            onClick={() => void analyse()}
            disabled={!text.trim()}
            className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
          >
            Check the story
          </button>
        </div>
      )}

      {stage === "story" && (
        <div>
          <h2 className="font-display text-xl font-semibold text-text">
            What&apos;s the story your brain is telling?
          </h2>
          {busy && explanations.length === 0 ? (
            <p className="mt-4 text-muted">Thinking it through…</p>
          ) : (
            <div className="mt-4 animate-fade-in">
              <p className="text-sm font-medium text-muted">
                Three other explanations that are just as likely:
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {explanations.map((e, i) => (
                  <li
                    key={i}
                    className="rounded-2xl border border-border bg-surface p-3.5 text-text"
                  >
                    {e}
                  </li>
                ))}
              </ul>
              {evidence && (
                <div className="mt-4 rounded-2xl bg-accent-soft/50 p-3.5">
                  <p className="text-sm font-medium text-accent">
                    Evidence check
                  </p>
                  <p className="mt-1 text-text">{evidence}</p>
                </div>
              )}
              {!busy && (
                <button
                  type="button"
                  onClick={startWait}
                  className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft"
                >
                  Start the 30-minute wait
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {stage === "wait" && (
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted">
            The wait protocol
          </p>
          <p className="mt-4 text-5xl font-bold tabular-nums text-accent">
            {mm}:{ss.toString().padStart(2, "0")}
          </p>
          <p className="mt-4 text-muted">
            No reply for now. Give the spike time to pass. While you wait:{" "}
            <span className="text-text">{appetiser.current}</span>.
          </p>

          <div className="mt-6 text-left">
            <label className="text-sm font-medium text-text">
              Feelings can go here (never sent — the app can&apos;t send
              anything):
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Say the whole thing here. It stays with you."
            />
          </div>

          <button
            type="button"
            onClick={revealOpener}
            disabled={remaining > 0}
            className="grad-primary mt-5 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:opacity-50"
          >
            {remaining > 0 ? "Waiting…" : "The wait's done"}
          </button>
          {remaining > 0 && (
            <button
              type="button"
              onClick={revealOpener}
              className="mt-2 text-xs text-muted underline-offset-2 hover:text-text"
            >
              I&apos;ve genuinely waited — show me the opener
            </button>
          )}
        </div>
      )}

      {stage === "opener" && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-semibold text-text">
            Still feels real? Then it deserves a calm conversation — not a text
            battle.
          </h2>
          {opener && (
            <div className="mt-4 rounded-2xl border border-accent/40 bg-surface p-4">
              <p className="text-sm font-medium text-accent">
                One way to open it
              </p>
              <p className="mt-1 text-text">{opener}</p>
            </div>
          )}
          <p className="mt-4 text-sm text-muted">
            Talk to the actual person, not the story. And if it&apos;s faded —
            that&apos;s allowed too.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl border border-border bg-surface px-5 py-3.5 font-medium text-text"
          >
            Close
          </button>
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
      aria-label="Message spiral defuser"
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
