"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useEscape } from "@/lib/hooks";
import { capture } from "@/lib/analytics";

/**
 * Mobile floating action button: two-tap idea capture from anywhere in the
 * app ("it's safe here — stop holding it"). One action only, mobile only —
 * desktop reaches ideas through the rail/Toolkit.
 */

const HIDDEN_PREFIXES = ["/privacy", "/terms", "/login", "/auth", "/welcome"];

export function QuickCapture() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "signin">(
    "idle",
  );

  useEscape(() => setOpen(false), open);

  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  async function save() {
    if (!text.trim()) return;
    setState("saving");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.status === 401 || res.status === 503) {
        setState("signin");
        return;
      }
      if (!res.ok) throw new Error("save failed");
      capture("idea_captured", { via: "fab" });
      setText("");
      setState("saved");
      window.setTimeout(() => {
        setOpen(false);
        setState("idle");
      }, 1200);
    } catch {
      setState("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState("idle");
        }}
        aria-label="Capture an idea"
        title="Capture an idea"
        className="grad-primary fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold shadow-float md:hidden"
      >
        +
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Capture an idea"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass w-full max-w-md rounded-3xl p-5 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            {state === "saved" ? (
              <p className="py-4 text-center text-text">
                Caught. 💡 It&apos;s safe in your vault — stop holding it.
              </p>
            ) : state === "signin" ? (
              <p className="py-4 text-center text-muted">
                Sign in to keep ideas —{" "}
                <a href="/login" className="text-accent hover:underline">
                  takes one email
                </a>
                .
              </p>
            ) : (
              <>
                <label
                  htmlFor="fab-idea"
                  className="text-sm font-medium text-text"
                >
                  Idea, before it escapes
                </label>
                <textarea
                  id="fab-idea"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 2000))}
                  rows={3}
                  autoFocus
                  placeholder="as messy as you like…"
                  className="mt-2 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!text.trim() || state === "saving"}
                  className="grad-primary mt-3 w-full rounded-2xl px-5 py-3 font-semibold shadow-soft disabled:opacity-50"
                >
                  {state === "saving" ? "Catching…" : "Catch it"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
