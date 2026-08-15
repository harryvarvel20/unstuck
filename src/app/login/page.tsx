"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

// NOTE: `@/lib/supabase/client` is imported dynamically inside onSubmit, not
// here. A static import pulls the whole Supabase browser client into this
// page's initial bundle — which measured at 66.5 kB, making /login 172 kB
// first-load and the heaviest page in the app by 40 kB. It is also the first
// page a new user ever loads. The client is only needed once they actually
// submit the form, by which point they have already typed an email address
// and a chunk fetch is invisible next to the auth round trip.

type State = "idle" | "sending" | "sent" | "error";

/**
 * Supabase rate-limits OTP sends per address. Requesting again inside that
 * window returns an error and sends nothing — leaving the previous, now
 * expired, email as the only one in the inbox, which reads to the user as
 * "it keeps sending me the same dead link". The cooldown makes the wait
 * visible instead of letting them hammer a button that silently fails.
 */
const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [next, setNext] = useState("/app");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const n = params.get("next");
    if (n && n.startsWith("/")) setNext(n);
    if (params.get("error")) {
      setState("error");
      setErrorMsg(
        "That link didn't work — they expire, and each one only works once. Send a fresh one and use the newest email.",
      );
    }
  }, []);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendLink() {
    const address = email.trim();
    if (!address) return;

    setState("sending");
    setErrorMsg(null);

    try {
      // Code-split: see the note by the imports.
      const { createSupabaseBrowser } = await import("@/lib/supabase/client");
      const supabase = createSupabaseBrowser();
      if (!supabase) {
        setState("error");
        setErrorMsg(
          "Sign-in isn't set up yet. Add Supabase keys to enable it.",
        );
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        next,
      )}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setState("error");
        // A rate-limit rejection is the common case and has a real remedy —
        // waiting — so say that rather than "something went wrong".
        const rateLimited = /rate|limit|too many|seconds/i.test(error.message);
        setErrorMsg(
          rateLimited
            ? "We've just sent one — please wait a minute before asking for another."
            : "Something went wrong sending the link. Try again?",
        );
      } else {
        setState("sent");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      // The chunk fetch itself can fail (offline, or a deploy mid-session).
      // Without this the form would sit on "sending" forever.
      setState("error");
      setErrorMsg("Something went wrong sending the link. Try again?");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendLink();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/app"
          className="text-xl font-bold tracking-tight text-text"
        >
          ADH<span className="text-accent">V</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center">
        {state === "sent" ? (
          <section className="animate-fade-in rounded-3xl border border-border bg-surface p-6 sm:p-8">
            <div className="mb-3 text-3xl">📬</div>
            <h1 className="text-2xl font-semibold text-text">
              Check your email
            </h1>
            <p className="mt-3 text-muted">
              We&apos;ve sent a magic link to{" "}
              <strong className="text-text">{email}</strong>. Tap it and
              you&apos;re in — no password to remember.
            </p>
            <p className="mt-3 text-sm text-muted/90">
              Always open the <strong className="text-text">newest</strong>{" "}
              email — asking for another link stops the older ones working, and
              some inboxes tuck them into the same thread.
            </p>

            <button
              type="button"
              onClick={() => void sendLink()}
              disabled={cooldown > 0}
              className="mt-6 w-full rounded-2xl border border-border bg-surface-2 px-5 py-3 font-medium text-text transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0
                ? `Send another in ${cooldown}s`
                : "Didn't arrive? Send another"}
            </button>

            {errorMsg && (
              <p className="mt-3 text-sm text-accent" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setState("idle");
                setErrorMsg(null);
              }}
              className="mt-4 text-sm text-accent hover:underline"
            >
              Use a different email
            </button>
          </section>
        ) : (
          <section>
            <h1 className="text-2xl font-semibold leading-tight text-text sm:text-3xl">
              Sign in to ADHV
            </h1>
            <p className="mt-2 text-muted">
              Enter your email and we&apos;ll send a magic link. No passwords,
              ever.
            </p>

            <form onSubmit={onSubmit} className="mt-6">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-[1.05rem] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />

              {errorMsg && (
                <p className="mt-3 text-sm text-accent" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={state === "sending" || !email.trim()}
                className="mt-4 w-full rounded-2xl bg-accent px-5 py-3.5 text-[1.05rem] font-semibold text-accent-ink transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "sending" ? "Sending…" : "Send magic link"}
              </button>

              <p className="mt-3 text-center text-xs text-muted/80">
                By continuing you confirm you&apos;re 18 or over and agree to
                our{" "}
                <Link href="/terms" className="underline hover:text-text">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline hover:text-text">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>

            <p className="mt-6 text-sm text-muted">
              You can keep using ADHV without an account —{" "}
              <Link href="/app" className="text-accent hover:underline">
                back to the app
              </Link>
              .
            </p>
          </section>
        )}
      </main>

      <footer className="pt-10">
        <p className="text-center text-xs text-muted/80">
          ADHV is a self-management tool, not therapy or medical advice.
        </p>
      </footer>
    </div>
  );
}
