"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-4xl">🌫️</div>
      <h1 className="text-2xl font-semibold text-text">
        Something wobbled — and it&apos;s on us, not you.
      </h1>
      <p className="mt-3 text-muted">
        That page hit a snag. Nothing you did caused it. Try again, or head back
        to somewhere solid.
      </p>
      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-accent px-6 py-3 font-semibold text-accent-ink transition-all hover:brightness-105"
        >
          Try again
        </button>
        <Link
          href="/app"
          className="rounded-2xl border border-border bg-surface px-6 py-3 font-medium text-text transition-colors hover:border-accent/40"
        >
          Back to the app
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted/80">
        ADHV is a productivity tool, not medical advice or treatment.
      </p>
    </div>
  );
}
