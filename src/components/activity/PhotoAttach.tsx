"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image";

/**
 * A small, reusable photo attacher for the Activity Center. Compresses +
 * strips EXIF client-side (via compressImage) and hands the parent a base64
 * JPEG. Controlled: pass `value` (base64|null); when the parent clears it
 * (e.g. after sending), the preview clears too.
 */
export function PhotoAttach({
  value,
  onChange,
  label = "Add a photo",
  compact = false,
}: {
  value: string | null;
  onChange: (base64: string | null) => void;
  label?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) setPreview(null);
  }, [value]);

  async function pick(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await compressImage(file);
      setPreview(`data:image/jpeg;base64,${img.base64}`);
      onChange(img.base64);
    } catch {
      setError("Couldn't read that image — try another.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clear() {
    onChange(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Your attached photo"
            className={`rounded-2xl border border-border object-cover ${
              compact ? "max-h-24" : "max-h-44"
            }`}
          />
          <button
            type="button"
            onClick={clear}
            aria-label="Remove photo"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-xs text-text shadow-soft transition-transform active:scale-90"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {busy ? "Reading…" : label}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
