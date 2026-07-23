import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-4xl">🧦</div>
      <h1 className="text-2xl font-semibold text-text">
        This page wandered off.
      </h1>
      <p className="mt-3 text-muted">
        Like a sock in the wash, it&apos;s just not here. No big deal —
        let&apos;s get you back to the thing you actually came to do.
      </p>
      <Link
        href="/app"
        className="mt-7 rounded-2xl bg-accent px-7 py-3.5 font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99]"
      >
        Take me to the app
      </Link>
      <Link href="/" className="mt-3 text-sm text-muted hover:text-text">
        or back to the home page
      </Link>
      <p className="mt-10 text-xs text-muted/80">
        ADHV is a self-management tool, not therapy or medical advice.
      </p>
    </div>
  );
}
