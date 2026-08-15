"use client";

import { useState } from "react";

/**
 * Share a parenting win to the Activity Center's **parents** space, tagged
 * with the tool that produced it.
 *
 * Offered after a shared-screen tool closes — never during, and never on a
 * kid-facing surface. The child is not the audience for this and must not be
 * present in it.
 *
 * The post records **which feature was used** as a tag, so the parents space
 * becomes a record of what actually worked for real families rather than a
 * generic feed. Nothing about the child is sent: no name, no age, no photo —
 * only what the parent chooses to type. That is the same zero-child-data line
 * the rest of Parents Mode holds (migration 0023).
 *
 * Sharing is always explicit. There is no default, no pre-tick, and closing
 * without posting is a completely normal outcome.
 */

/** Tool title → tag slug. Kept explicit so a renamed tile cannot silently
 *  fragment the tag history in the feed. */
const TOOL_TAGS: Record<string, string> = {
  "Visual routine": "visual-routine",
  "Reward chart": "reward-chart",
  "First–Then": "first-then",
  "Feelings check": "feelings-check",
  "Calm Corner": "calm-corner",
  "Boost menu": "boost-menu",
  "Homework helper": "homework-helper",
};

interface Props {
  /** Title of the tool just used, e.g. "Visual routine". */
  tool: string;
  onClose: () => void;
}

type State = "idle" | "sending" | "done" | "error";

export function ShareParentWin({ tool, onClose }: Props) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"private" | "friends">(
    "friends",
  );
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const tag = TOOL_TAGS[tool] ?? "parents";

  async function share() {
    const winText = text.trim();
    if (!winText) return;

    setState("sending");
    setMessage(null);

    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          winText,
          tags: [tag],
          visibility,
          space: "parents",
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        crisis?: boolean;
        message?: string;
        error?: string;
      };

      // Safeguarding gate fires BEFORE anything is stored. Show its words
      // exactly and stop — never soften or wrap a signpost.
      if (body.crisis) {
        setState("error");
        setMessage(body.message ?? null);
        return;
      }

      if (!res.ok) {
        setState("error");
        setMessage(
          body.error === "handle_required"
            ? "Pick a username in the Activity Center first — it takes a second."
            : body.error === "rate_limited"
              ? "You've shared a lot just now. Give it a minute?"
              : "That didn't send. Try again in a moment?",
        );
        return;
      }

      setState("done");
    } catch {
      setState("error");
      setMessage("That didn't send. Try again in a moment?");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Share how ${tool} went`}
    >
      <div className="mx-auto w-full max-w-md px-5 py-8">
        {state === "done" ? (
          <div className="glass rounded-3xl p-6 text-center shadow-soft">
            <div className="text-3xl">💛</div>
            <h2 className="mt-3 font-display text-xl font-semibold text-text">
              Shared.
            </h2>
            <p className="mt-2 text-sm text-muted">
              It&apos;s in the Parents space. Someone having the same week will
              be glad you did.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="glass rounded-3xl p-6 shadow-soft">
            <h2 className="font-display text-xl font-semibold text-text">
              How did that go?
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Share it with other parents — tagged{" "}
              <span className="text-text">{tool}</span> so they can find what
              worked. Only what you type is shared.
            </p>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="We got through the morning without shouting. First time in weeks."
              className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />

            <div className="mt-3 flex gap-2">
              {(
                [
                  ["friends", "Friends"],
                  ["private", "Just me"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  aria-pressed={visibility === v}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    visibility === v
                      ? "border-accent bg-accent-soft text-text"
                      : "border-border bg-surface text-muted hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {message && (
              <p className="mt-3 text-sm text-accent" role="alert">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={() => void share()}
              disabled={state === "sending" || !text.trim()}
              className="mt-4 w-full rounded-2xl bg-accent px-5 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "sending" ? "Sharing…" : "Share it"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-2 text-sm text-muted transition-colors hover:text-text"
            >
              Not this time
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
