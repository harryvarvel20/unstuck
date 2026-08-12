"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export type PaywallVariant = "breakdowns" | "focus";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  variant?: PaywallVariant;
}

const COPY: Record<
  PaywallVariant,
  { emoji: string; title: string; body: string }
> = {
  breakdowns: {
    emoji: "🌱",
    title: "That's three for today — nicely done.",
    body: "You've used your free breakdowns for today. Come back tomorrow, or go Pro: an AI body double, a plan that knows how you really use time, and a reset button for bad days.",
  },
  focus: {
    emoji: "🕯️",
    title: "You've used today's focus session.",
    body: "One a day is the free taster. Pro makes them unlimited — your body double whenever the wall shows up, plus plans that learn your real pace.",
  },
};

/** Soft paywall. Warm, no pressure, no shame. */
export function PaywallModal({
  open,
  onClose,
  variant = "breakdowns",
}: PaywallModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const copy = COPY[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-2xl">
          {copy.emoji}
        </div>
        <h2 id="paywall-title" className="text-xl font-semibold text-text">
          {copy.title}
        </h2>
        <p className="mt-3 text-muted">{copy.body}</p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/pricing"
            className="w-full rounded-2xl bg-accent px-5 py-3 text-center font-semibold text-accent-ink transition-all hover:brightness-105"
          >
            See Pro — 4-day free trial
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-border bg-surface-2 px-5 py-3 font-medium text-text transition-colors hover:border-accent/40"
          >
            Maybe tomorrow
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-muted">
          No pressure. You showed up today, and that counts.
        </p>
      </div>
    </div>
  );
}
