"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface NavigateResponse {
  route?: string;
  reason?: string;
  crisis?: boolean;
  message?: string;
  error?: string;
}

const EXAMPLES = [
  "I keep putting off my taxes",
  "I'm completely overwhelmed",
  "help with my kid's homework meltdown",
  "I can't switch my brain off tonight",
];

/**
 * The Navigator — type what you want to solve, land on the right tool.
 * Intent in, an in-app route out (chosen + validated server-side). Crisis
 * language is screened server-side and shows a signpost instead of routing.
 */
export function Navigator() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "idle" | "thinking" | "going" | "crisis" | "error"
  >("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [crisisMessage, setCrisisMessage] = useState<string | null>(null);

  const trimmed = query.trim();
  const busy = status === "thinking" || status === "going";

  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    if (!trimmed || busy) return;
    setStatus("thinking");
    setReason(null);
    setCrisisMessage(null);
    try {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const body = (await res.json()) as NavigateResponse;

      if (body.crisis && body.message) {
        setCrisisMessage(body.message);
        setStatus("crisis");
        return;
      }
      if (res.status === 429) {
        setReason(
          "Just a moment — that's a lot of searches at once. Try again shortly.",
        );
        setStatus("error");
        return;
      }
      if (res.ok && body.route) {
        setStatus("going");
        if (body.reason) setReason(body.reason);
        router.push(body.route);
        return;
      }
      setReason("Couldn't work that one out — try the toolkit below.");
      setStatus("error");
    } catch {
      setReason("Couldn't reach the Navigator — try the toolkit below.");
      setStatus("error");
    }
  }

  return (
    <div>
      <form onSubmit={go}>
        <div className="glass rounded-3xl p-2.5 shadow-soft transition-colors focus-within:border-accent/60">
          <label htmlFor="navigator-input" className="sr-only">
            What would you like to solve today?
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="navigator-input"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 300))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void go();
                }
              }}
              placeholder="What would you like to solve today?"
              rows={2}
              maxLength={300}
              disabled={busy}
              className="w-full resize-none rounded-2xl bg-transparent px-3.5 py-3 text-[1.05rem] text-text placeholder:text-muted/60 focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!trimmed || busy}
              aria-label="Take me there"
              className="mb-1 mr-1 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  className="animate-spin"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Example chips — one tap to try the Navigator */}
      {status === "idle" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
              }}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-text"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {status === "going" && reason && (
        <p
          className="mt-3 text-sm text-accent animate-fade-in"
          aria-live="polite"
        >
          {reason}
        </p>
      )}

      {status === "error" && reason && (
        <p className="mt-3 text-sm text-muted animate-fade-in" role="alert">
          {reason}
        </p>
      )}

      {status === "crisis" && crisisMessage && (
        <div
          className="mt-4 animate-fade-in rounded-3xl border border-accent/40 bg-accent-soft/70 p-5"
          role="status"
        >
          <div className="mb-2 text-2xl">💛</div>
          <p className="text-[1.02rem] leading-relaxed text-text">
            {crisisMessage}
          </p>
        </div>
      )}
    </div>
  );
}
