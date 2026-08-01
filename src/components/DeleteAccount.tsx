"use client";

import { useState } from "react";
import { clearAllParentsLocal } from "@/lib/parentsLocal";

/** Delete my account & data — real, immediate, with one honest confirm. */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function del() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (res.ok) {
        // Server rows are gone; clear the device-only Parents data too.
        clearAllParentsLocal();
        window.location.href = "/";
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-muted underline-offset-4 transition-colors hover:text-accent hover:underline"
      >
        Delete my account &amp; data
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface p-4">
      <p className="text-sm text-text">
        This deletes your account and everything in it — tasks, plans, focus
        history — right now, for good. There&apos;s no undo.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void del()}
          disabled={busy}
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:brightness-105 disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Yes, delete everything"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-2xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/40"
        >
          Keep my account
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-accent" role="alert">
          Couldn&apos;t delete just now — try again, or email
          harryvarvel@gmail.com.
        </p>
      )}
    </div>
  );
}
