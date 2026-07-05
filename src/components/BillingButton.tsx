"use client";

import { useState } from "react";

/** Opens the Stripe customer portal. Cancelling must always be this easy. */
export function BillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function open() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const body = (await res.json()) as { url?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="rounded-2xl border border-border bg-surface px-5 py-3 font-medium text-text transition-colors hover:border-accent/40 disabled:opacity-60"
      >
        {loading ? "Opening…" : "Manage billing"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-accent" role="alert">
          Couldn&apos;t open billing just now — try again in a moment.
        </p>
      )}
    </div>
  );
}
