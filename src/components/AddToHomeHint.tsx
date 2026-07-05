"use client";

import { useEffect, useState } from "react";
import { isTouchDevice } from "@/lib/design";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/**
 * Gentle, PLATFORM-AWARE install hint. One app, one URL — the device decides
 * what "install" means, never the user:
 * - Windows/Mac (Edge/Chrome): one-click "Install as an app".
 * - Android/Chrome: one-tap "Add to home screen".
 * - iPhone/iPad Safari: a soft how-to (Apple allows no prompt).
 * Dismissible, remembered, never nags twice.
 */
export function AddToHomeHint() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("adhv-a2hs") === "dismissed") return;
    } catch {
      return;
    }

    // Already installed?
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;

    setDesktop(!isTouchDevice());

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari has no beforeinstallprompt — detect + soft hint.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios/i.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem("adhv-a2hs", "dismissed");
    } catch {
      /* noop */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 animate-fade-in">
      <span className="text-xl" aria-hidden="true">
        {desktop ? "💻" : "📲"}
      </span>
      <p className="flex-1 text-sm text-muted">
        {iosHint ? (
          <>
            Add ADHV to your home screen: tap Share, then “Add to Home Screen”.
          </>
        ) : desktop ? (
          <>Keep ADHV one click away — install it as its own app window.</>
        ) : (
          <>Keep ADHV one tap away — add it to your home screen.</>
        )}
      </p>
      {!iosHint && deferred && (
        <button
          type="button"
          onClick={install}
          className="flex-shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-ink"
        >
          {desktop ? "Install" : "Add"}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 rounded-full p-1.5 text-muted transition-colors hover:text-text"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
