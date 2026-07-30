"use client";

import { useEffect, useRef, useState } from "react";
import { capture } from "@/lib/analytics";
import { suggestHandle, HANDLE_MAX } from "@/lib/username";

type Avail =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; handle: string }
  | { state: "bad"; message: string };

interface HandlePickerProps {
  mode: "first" | "change";
  /** Called after the name is saved. */
  onDone: () => void;
  /** Change mode only: dismiss without saving. */
  onCancel?: () => void;
}

/**
 * Pick a name for the Activity Center (Y1). One input, live availability, one
 * primary action. The name is what appears on shared wins and comments; the
 * real name is never shown unless the person types it as their display name.
 */
export function HandlePicker({ mode, onDone, onCancel }: HandlePickerProps) {
  const [value, setValue] = useState(() =>
    mode === "first" ? suggestHandle() : "",
  );
  const [avail, setAvail] = useState<Avail>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // Debounced live availability check — server is authoritative.
  useEffect(() => {
    const handle = value.trim();
    if (!handle) {
      setAvail({ state: "idle" });
      return;
    }
    setAvail({ state: "checking" });
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/social/handle?handle=${encodeURIComponent(handle)}`,
        );
        const body = (await res.json()) as {
          available?: boolean;
          handle?: string;
          error?: string;
        };
        if (mine !== seq.current) return; // a newer keystroke won
        if (body.available && body.handle) {
          setAvail({ state: "ok", handle: body.handle });
        } else {
          setAvail({
            state: "bad",
            message: body.error ?? "That name isn't available.",
          });
        }
      } catch {
        if (mine === seq.current) setAvail({ state: "idle" });
      }
    }, 320);
    return () => clearTimeout(t);
  }, [value]);

  async function submit() {
    if (avail.state !== "ok" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/social/handle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: value.trim() }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        capture(mode === "first" ? "username_set" : "username_changed");
        onDone();
        return;
      }
      setError(body.error ?? "Couldn't save that name — try again.");
    } catch {
      setError("Couldn't save that name — try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = avail.state === "ok" && !busy;

  return (
    <div className="glass rounded-3xl p-6 shadow-soft">
      <div className="text-2xl" aria-hidden>
        ✍️
      </div>
      <h2 className="mt-3 font-display text-xl font-semibold text-text">
        {mode === "first"
          ? "Pick a name for the Activity Center"
          : "Change your name"}
      </h2>
      <p className="mt-2 text-sm text-muted">
        This is what appears on wins you share and comments you leave. Your real
        name is never shown unless you set it as your display name.
        {mode === "change" && " You can change it once every 30 days."}
      </p>

      <label htmlFor="handle-input" className="sr-only">
        Your Activity Center name
      </label>
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 focus-within:border-accent">
        <span className="text-muted" aria-hidden>
          @
        </span>
        <input
          id="handle-input"
          value={value}
          onChange={(e) =>
            setValue(
              e.target.value
                .toLowerCase()
                .replace(/\s+/g, "")
                .slice(0, HANDLE_MAX),
            )
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) void submit();
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          aria-describedby="handle-status"
          className="min-w-0 flex-1 bg-transparent py-3 text-text placeholder:text-muted/60 focus:outline-none"
          placeholder="yourname"
        />
        {mode === "first" && (
          <button
            type="button"
            onClick={() => setValue(suggestHandle())}
            className="flex-shrink-0 text-xs font-medium text-muted transition-colors hover:text-accent"
          >
            shuffle
          </button>
        )}
      </div>

      <p
        id="handle-status"
        aria-live="polite"
        className="mt-2 min-h-[1.25rem] text-sm"
      >
        {avail.state === "checking" && (
          <span className="text-muted">Checking…</span>
        )}
        {avail.state === "ok" && (
          <span className="text-accent">@{avail.handle} is free ✓</span>
        )}
        {avail.state === "bad" && (
          <span className="text-[rgb(var(--accent-3))]">{avail.message}</span>
        )}
      </p>

      {error && (
        <p className="mt-1 text-sm text-[rgb(var(--accent-3))]" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="grad-primary mt-4 w-full rounded-2xl px-5 py-3.5 font-semibold shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Saving…" : mode === "first" ? "Continue" : "Save name"}
      </button>

      {mode === "change" && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 block w-full text-center text-sm text-muted underline-offset-4 hover:underline"
        >
          cancel
        </button>
      )}

      <p className="mt-3 text-xs text-muted/80">
        3–20 characters · letters, numbers, dots and underscores.
      </p>
    </div>
  );
}
