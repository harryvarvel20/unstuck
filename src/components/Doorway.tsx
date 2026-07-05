"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/design";

/**
 * The calm doorway — a full-screen, magazine-minimal threshold shown when you
 * arrive at the app, instead of dropping you straight onto a text box. One
 * considered breath, one tap ("Begin"), then into the app. Shown once per
 * browser session so it never nags mid-flow.
 */

const KEY = "adhv-doorway-seen";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late one";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Winding down";
}

export function Doorway() {
  const [state, setState] = useState<"hidden" | "open" | "closing">("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) setState("open");
  }, []);

  function begin() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode — fine, it just shows again next time */
    }
    if (prefersReducedMotion()) {
      setState("hidden");
      return;
    }
    setState("closing");
    window.setTimeout(() => setState("hidden"), 460);
  }

  useEffect(() => {
    if (state !== "open") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        begin();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (state === "hidden") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to ADHV"
      onClick={begin}
      className={`fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-bg px-6 ${
        state === "closing" ? "animate-door-out" : "animate-door-in"
      }`}
    >
      {/* A whisper of gold at the top — light on good paper, nothing busy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[45vmin]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgb(var(--gold) / 0.1) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-w-md flex-col items-center text-center">
        <p className="animate-fade-in text-xs font-medium uppercase tracking-[0.35em] text-muted">
          {greeting()}
        </p>

        <h1 className="mt-6 font-display text-6xl font-semibold tracking-[0.2em] text-text sm:text-7xl">
          ADHV
        </h1>

        <div aria-hidden className="mt-5 h-px w-16 bg-[rgb(var(--gold))]" />

        <p className="mt-6 max-w-xs text-[1.05rem] leading-relaxed text-muted">
          The app that gets you started — one thing at a time. That&apos;s the
          whole trick.
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            begin();
          }}
          className="grad-primary mt-10 rounded-full px-10 py-3.5 text-base font-semibold shadow-soft transition-transform active:scale-[0.98]"
        >
          Begin
        </button>

        <p className="mt-5 text-xs text-muted/70">
          tap anywhere, or press enter
        </p>
      </div>
    </div>
  );
}
